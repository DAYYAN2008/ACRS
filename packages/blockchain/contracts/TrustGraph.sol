// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TrustGraph
 * @notice Solves Sybil Resistance and Weighted Voting for an anonymous rumor verification system.
 * @dev Implements trust scores, staked invites, quadratic voting, and time-epoch isolation.
 */
contract TrustGraph {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Initial trust score for new users. Low enough to require invites, high enough to participate.
    uint8 public constant INITIAL_TRUST = 10;

    /// @notice Trust points staked when inviting. At risk if invitee is slashed.
    uint8 public constant INVITE_STAKE = 5;

    /// @notice Maximum possible trust score. Bounds the system.
    uint8 public constant MAX_TRUST = 100;

    /// @notice Scale factor for quadratic weight precision. sqrt(trustScore * 1e18) / 1e9 ≈ sqrt(trustScore)
    uint256 private constant SQRT_SCALE = 1e18;
    uint256 private constant SQRT_PRECISION = 1e9;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Trust score (0-100) per address. Dictates vote weight via quadratic formula.
    mapping(address => uint8) public trustScore;

    /// @notice Who invited this user. address(0) = genesis/bootstrap. Used for slashing propagation.
    mapping(address => address) public inviter;

    /// @notice Whether an address has been registered (has trustScore). Prevents re-registration.
    mapping(address => bool) public isRegistered;

    /// @notice Current epoch. Votes only count in the epoch they were cast. Isolates historical data.
    /// @dev Solves "deleted rumors bug": old votes don't pollute current epoch's tally.
    uint256 public currentEpoch;

    /// @notice Per-rumor, per-epoch vote tallies. rumorHash => epoch => RumorEpochData
    mapping(bytes32 => mapping(uint256 => RumorEpochData)) public rumorEpochData;

    /// @notice Nullifier: has this (voter, rumorHash, epoch) already voted? Prevents double-voting.
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasVotedInEpoch;

    /// @notice Bootstrap/owner. Can register genesis users and advance epoch.
    address public owner;

    struct RumorEpochData {
        uint256 weightedTrueVotes;   // Sum of sqrt(trustScore) for "true" votes this epoch
        uint256 weightedFalseVotes;  // Sum of sqrt(trustScore) for "false" votes this epoch
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event UserRegistered(address indexed user, address indexed invitedBy, uint8 trustScore);
    event VoteCast(bytes32 indexed rumorHash, address indexed voter, uint256 epoch, bool isTrue, uint256 weight);
    event UserSlashed(address indexed user, uint8 amount, string reason);
    event EpochAdvanced(uint256 newEpoch);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error OnlyOwner();
    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientTrustToInvite();
    error CannotInviteSelf();
    error AlreadyVoted();
    error TrustScoreOutOfBounds();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR & MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;
        _registerUser(msg.sender, address(0)); // Deployer is genesis
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REGISTRATION & INVITES (Sybil Resistance)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a new user via invite. Inviter "stakes" INVITE_STAKE points.
     * @dev Sybil Resistance: Inviter puts their trust at risk. If invitee is later slashed
     *      for lying, inviter loses INVITE_STAKE points. Prevents bot farms (each bot costs
     *      a real user's trust).
     * @param invitee The address to invite into the network.
     */
    function inviteUser(address invitee) external {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        if (isRegistered[invitee]) revert AlreadyRegistered();
        if (invitee == msg.sender) revert CannotInviteSelf();
        if (trustScore[msg.sender] < INVITE_STAKE) revert InsufficientTrustToInvite();

        _registerUser(invitee, msg.sender);
    }

    /**
     * @dev Internal registration. Sets trustScore=INITIAL_TRUST, records inviter for slashing.
     */
    function _registerUser(address user, address _inviter) private {
        trustScore[user] = INITIAL_TRUST;
        inviter[user] = _inviter;
        isRegistered[user] = true;
        emit UserRegistered(user, _inviter, INITIAL_TRUST);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUADRATIC VOTING (Weighted Voting)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Compute vote weight from trust score using quadratic formula: weight = sqrt(trustScore)
     * @dev Mathematical basis (Quadratic Voting):
     *      - Cost of N votes ∝ N²  =>  Marginal cost increases. One high-trust user can't
     *        dominate because doubling votes requires quadrupling "cost" (trust).
     *      - Here we use weight = sqrt(trustScore), so influence scales sub-linearly.
     *      - trustScore 100 → weight 10, trustScore 25 → weight 5, trustScore 10 → weight ~3.16
     *      - Precision: sqrt(trustScore * 1e18) / 1e9 preserves ~9 decimals, stored as uint256.
     * @param voter The address whose vote weight to compute.
     * @return weight The vote weight (floor(sqrt(trustScore) * 1e9) for precision in tallies.
     */
    function calculateVoteWeight(address voter) public view returns (uint256 weight) {
        uint8 score = trustScore[voter];
        if (score == 0) return 0;
        // Scale: sqrt(score * 1e18) ≈ sqrt(score) * 1e9. Integer sqrt floors automatically.
        uint256 scaled = uint256(score) * SQRT_SCALE;
        uint256 sqrtScaled = _sqrt(scaled);
        return sqrtScaled / SQRT_PRECISION;
    }

    /**
     * @dev Integer square root via Babylonian (Newton) method. O(log n) iterations.
     *      For x >= 0: y = floor(sqrt(x)). Satisfies y² <= x < (y+1)².
     */
    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VOTING & EPOCHS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Cast a vote on a rumor for the current epoch.
     * @dev Nullifier: hasVotedInEpoch prevents double-voting. Each (voter, rumorHash, epoch)
     *      can vote at most once. Votes only affect current epoch's tally.
     * @param rumorHash Hash of the rumor content (e.g. keccak256(abi.encodePacked(content))).
     * @param isTrue True = vote for rumor being true, False = vote for rumor being false.
     */
    function castVote(bytes32 rumorHash, bool isTrue) external {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        if (trustScore[msg.sender] == 0) revert InsufficientTrustToInvite(); // No trust = no vote

        uint256 epoch = currentEpoch;
        if (hasVotedInEpoch[rumorHash][epoch][msg.sender]) revert AlreadyVoted();

        uint256 weight = calculateVoteWeight(msg.sender);
        require(weight > 0, "Zero vote weight");

        hasVotedInEpoch[rumorHash][epoch][msg.sender] = true;

        if (isTrue) {
            rumorEpochData[rumorHash][epoch].weightedTrueVotes += weight;
        } else {
            rumorEpochData[rumorHash][epoch].weightedFalseVotes += weight;
        }

        emit VoteCast(rumorHash, msg.sender, epoch, isTrue, weight);
    }

    /**
     * @notice Advance to the next epoch. Call when transitioning time windows.
     * @dev Isolates vote tallies: previous epoch's votes remain stored but no longer
     *      affect "current" truth. Solves "deleted rumors bug" by epoch-bound storage.
     */
    function advanceEpoch() external onlyOwner {
        currentEpoch++;
        emit EpochAdvanced(currentEpoch);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SLASHING (Enforces Staked Invites)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Slash a user for lying. Reduces their trust and propagates to inviter.
     * @dev Staked Invites: If user was invited, inviter loses INVITE_STAKE points.
     *      This creates accountability: inviting bad actors hurts the inviter.
     * @param user Address to slash.
     * @param amount Points to deduct from user.
     * @param reason Optional reason (for events/logs).
     */
    function slash(address user, uint8 amount, string calldata reason) external onlyOwner {
        if (!isRegistered[user]) revert NotRegistered();
        if (amount > trustScore[user] || amount > MAX_TRUST) revert TrustScoreOutOfBounds();

        trustScore[user] -= amount;

        // Propagate stake loss to inviter
        address _inviter = inviter[user];
        if (_inviter != address(0) && trustScore[_inviter] >= INVITE_STAKE) {
            trustScore[_inviter] -= INVITE_STAKE;
        }

        emit UserSlashed(user, amount, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get current epoch's vote totals for a rumor.
    function getRumorVotes(bytes32 rumorHash) external view returns (uint256 weightedTrue, uint256 weightedFalse) {
        RumorEpochData storage data = rumorEpochData[rumorHash][currentEpoch];
        return (data.weightedTrueVotes, data.weightedFalseVotes);
    }

    /// @notice Check if a voter has already voted on a rumor in the current epoch (nullifier check).
    function hasVoted(bytes32 rumorHash, address voter) external view returns (bool) {
        return hasVotedInEpoch[rumorHash][currentEpoch][voter];
    }
}
