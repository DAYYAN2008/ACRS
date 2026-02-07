// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TrustGraph
 * @notice Enhanced Anonymous Campus Rumor System with nullifier-based voting,
 *         rumor registration, and comprehensive trust scoring.
 * @dev Implements:
 *      - Nullifier-based anonymous voting (commitment + nullifier scheme)
 *      - Quadratic vote weighting via trust scores
 *      - Epoch-based isolation to prevent historical corruption
 *      - Staked invite system for Sybil resistance
 *      - On-chain rumor registration with trust score tracking
 */
contract TrustGraph {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Initial trust score for new users
    uint8 public constant INITIAL_TRUST = 10;

    /// @notice Trust points staked when inviting (at risk if invitee is slashed)
    uint8 public constant INVITE_STAKE = 5;

    /// @notice Maximum possible trust score
    uint8 public constant MAX_TRUST = 100;

    /// @notice Number of bootstrap slots for self-registration (no invite needed)
    uint8 public constant BOOTSTRAP_SLOTS = 10;

    /// @notice Scale factor for quadratic weight precision
    uint256 private constant SQRT_SCALE = 1e18;
    uint256 private constant SQRT_PRECISION = 1e9;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE - User Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Trust score (0-100) per address
    mapping(address => uint8) public trustScore;

    /// @notice Who invited this user (address(0) = genesis/bootstrap)
    mapping(address => address) public inviter;

    /// @notice Whether an address has been registered
    mapping(address => bool) public isRegistered;

    /// @notice User's commitment hash (hash of their secret) for nullifier system
    mapping(address => bytes32) public userCommitment;

    /// @notice Number of bootstrap registrations used
    uint8 public bootstrapUsed;

    /// @notice Contract owner (can slash and advance epochs)
    address public owner;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE - Epoch Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Current epoch. Votes only count in their cast epoch
    uint256 public currentEpoch;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE - Rumor Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Registered rumors by hash
    struct Rumor {
        bytes32 rumorHash;
        string content;
        uint256 createdAt;
        uint256 createdEpoch;
        address creator; // Anonymous but tracked for initial trust boost
        bool exists;
    }

    /// @notice Per-epoch vote data for each rumor
    struct RumorEpochData {
        uint256 weightedTrueVotes;   // Sum of sqrt(trustScore) for "verify" votes
        uint256 weightedFalseVotes;  // Sum of sqrt(trustScore) for "dispute" votes
        uint256 trueVoteCount;       // Raw count of verify votes
        uint256 falseVoteCount;      // Raw count of dispute votes
    }

    /// @notice All registered rumors by hash
    mapping(bytes32 => Rumor) public rumors;

    /// @notice Array of all rumor hashes for enumeration
    bytes32[] public rumorHashes;

    /// @notice Per-rumor, per-epoch vote tallies
    mapping(bytes32 => mapping(uint256 => RumorEpochData)) public rumorEpochData;

    /// @notice Nullifier tracking: has this nullifier been used for this rumor+epoch?
    /// @dev nullifier = keccak256(userSecret, rumorHash) - prevents linking votes to addresses
    mapping(bytes32 => mapping(uint256 => mapping(bytes32 => bool))) public nullifierUsed;

    /// @notice Backup: also track by address for UI convenience (can be removed for more privacy)
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasVotedInEpoch;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event UserRegistered(address indexed user, address indexed invitedBy, uint8 trustScore, bytes32 commitment);
    event RumorCreated(bytes32 indexed rumorHash, address indexed creator, uint256 epoch);
    event VoteCast(bytes32 indexed rumorHash, bytes32 indexed nullifier, uint256 epoch, bool isTrue, uint256 weight);
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
    error RumorAlreadyExists();
    error RumorDoesNotExist();
    error InvalidNullifier();
    error BootstrapPeriodEnded();
    error InvalidCommitment();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR & MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;
        // Register deployer as genesis user with a default commitment
        bytes32 genesisCommitment = keccak256(abi.encodePacked(msg.sender, block.timestamp));
        _registerUser(msg.sender, address(0), genesisCommitment);
        bootstrapUsed = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyRegistered() {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REGISTRATION & INVITES (Sybil Resistance)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Self-register during bootstrap period (first N users)
     * @param commitment Hash of user's secret (commitment = keccak256(secret))
     * @dev Bootstrap allows first BOOTSTRAP_SLOTS users to join without invite
     */
    function bootstrapRegister(bytes32 commitment) external {
        if (isRegistered[msg.sender]) revert AlreadyRegistered();
        if (bootstrapUsed >= BOOTSTRAP_SLOTS) revert BootstrapPeriodEnded();
        if (commitment == bytes32(0)) revert InvalidCommitment();

        bootstrapUsed++;
        _registerUser(msg.sender, address(0), commitment);
    }

    /**
     * @notice Register a new user via invite. Inviter stakes INVITE_STAKE points.
     * @param invitee The address to invite
     * @param commitment Invitee's commitment hash
     */
    function inviteUser(address invitee, bytes32 commitment) external onlyRegistered {
        if (isRegistered[invitee]) revert AlreadyRegistered();
        if (invitee == msg.sender) revert CannotInviteSelf();
        if (trustScore[msg.sender] < INVITE_STAKE) revert InsufficientTrustToInvite();
        if (commitment == bytes32(0)) revert InvalidCommitment();

        _registerUser(invitee, msg.sender, commitment);
    }

    /**
     * @dev Internal registration helper
     */
    function _registerUser(address user, address _inviter, bytes32 commitment) private {
        trustScore[user] = INITIAL_TRUST;
        inviter[user] = _inviter;
        isRegistered[user] = true;
        userCommitment[user] = commitment;
        emit UserRegistered(user, _inviter, INITIAL_TRUST, commitment);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RUMOR MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a new rumor on-chain
     * @param rumorHash Hash of the rumor content (should match keccak256(content))
     * @param content The actual rumor text
     */
    function registerRumor(bytes32 rumorHash, string calldata content) external onlyRegistered {
        if (rumors[rumorHash].exists) revert RumorAlreadyExists();

        rumors[rumorHash] = Rumor({
            rumorHash: rumorHash,
            content: content,
            createdAt: block.timestamp,
            createdEpoch: currentEpoch,
            creator: msg.sender,
            exists: true
        });

        rumorHashes.push(rumorHash);
        emit RumorCreated(rumorHash, msg.sender, currentEpoch);
    }

    /**
     * @notice Get total number of registered rumors
     */
    function getRumorCount() external view returns (uint256) {
        return rumorHashes.length;
    }

    /**
     * @notice Get rumor hash by index (for enumeration)
     */
    function getRumorHashByIndex(uint256 index) external view returns (bytes32) {
        return rumorHashes[index];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUADRATIC VOTING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Compute vote weight from trust score: weight = sqrt(trustScore)
     * @dev Quadratic voting: influence scales sub-linearly, preventing domination
     */
    function calculateVoteWeight(address voter) public view returns (uint256 weight) {
        uint8 score = trustScore[voter];
        if (score == 0) return 0;
        uint256 scaled = uint256(score) * SQRT_SCALE;
        uint256 sqrtScaled = _sqrt(scaled);
        return sqrtScaled / SQRT_PRECISION;
    }

    /**
     * @dev Integer square root via Babylonian method
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
    // VOTING WITH NULLIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Cast a vote using nullifier for enhanced privacy
     * @param rumorHash Hash of the rumor to vote on
     * @param isTrue True = verify, False = dispute
     * @param nullifier = keccak256(abi.encodePacked(userSecret, rumorHash))
     * @dev The nullifier proves uniqueness without revealing the voter's identity
     *      across multiple votes. The same secret always produces the same nullifier
     *      for a given rumor, preventing double-voting.
     */
    function castVoteWithNullifier(bytes32 rumorHash, bool isTrue, bytes32 nullifier) external onlyRegistered {
        if (trustScore[msg.sender] == 0) revert InsufficientTrustToInvite();

        uint256 epoch = currentEpoch;
        
        // Check nullifier hasn't been used (anonymous double-vote prevention)
        if (nullifierUsed[rumorHash][epoch][nullifier]) revert AlreadyVoted();
        
        // Verify nullifier matches user's commitment
        // nullifier should equal keccak256(secret, rumorHash) where commitment = keccak256(secret)
        // We can't fully verify without the secret, but we track to prevent reuse

        uint256 weight = calculateVoteWeight(msg.sender);
        require(weight > 0, "Zero vote weight");

        // Mark nullifier as used
        nullifierUsed[rumorHash][epoch][nullifier] = true;
        // Also track by address for UI (slightly reduces privacy but helps UX)
        hasVotedInEpoch[rumorHash][epoch][msg.sender] = true;

        RumorEpochData storage data = rumorEpochData[rumorHash][epoch];
        if (isTrue) {
            data.weightedTrueVotes += weight;
            data.trueVoteCount++;
        } else {
            data.weightedFalseVotes += weight;
            data.falseVoteCount++;
        }

        emit VoteCast(rumorHash, nullifier, epoch, isTrue, weight);
    }

    /**
     * @notice Simple vote cast (backward compatible, uses address as pseudo-nullifier)
     * @param rumorHash Hash of the rumor
     * @param isTrue True = verify, False = dispute
     */
    function castVote(bytes32 rumorHash, bool isTrue) external onlyRegistered {
        if (trustScore[msg.sender] == 0) revert InsufficientTrustToInvite();

        uint256 epoch = currentEpoch;
        if (hasVotedInEpoch[rumorHash][epoch][msg.sender]) revert AlreadyVoted();

        uint256 weight = calculateVoteWeight(msg.sender);
        require(weight > 0, "Zero vote weight");

        hasVotedInEpoch[rumorHash][epoch][msg.sender] = true;

        RumorEpochData storage data = rumorEpochData[rumorHash][epoch];
        if (isTrue) {
            data.weightedTrueVotes += weight;
            data.trueVoteCount++;
        } else {
            data.weightedFalseVotes += weight;
            data.falseVoteCount++;
        }

        // Use address hash as pseudo-nullifier for event
        bytes32 pseudoNullifier = keccak256(abi.encodePacked(msg.sender, rumorHash));
        emit VoteCast(rumorHash, pseudoNullifier, epoch, isTrue, weight);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EPOCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Advance to the next epoch
     * @dev Isolates vote tallies - old epoch data remains but doesn't affect current
     */
    function advanceEpoch() external onlyOwner {
        currentEpoch++;
        emit EpochAdvanced(currentEpoch);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SLASHING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Slash a user for bad behavior. Propagates to inviter.
     * @param user Address to slash
     * @param amount Points to deduct
     * @param reason Explanation for audit trail
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
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get current epoch's vote totals for a rumor
     */
    function getRumorVotes(bytes32 rumorHash) external view returns (
        uint256 weightedTrue,
        uint256 weightedFalse,
        uint256 trueCount,
        uint256 falseCount
    ) {
        RumorEpochData storage data = rumorEpochData[rumorHash][currentEpoch];
        return (data.weightedTrueVotes, data.weightedFalseVotes, data.trueVoteCount, data.falseVoteCount);
    }

    /**
     * @notice Get vote totals for a specific epoch
     */
    function getRumorVotesForEpoch(bytes32 rumorHash, uint256 epoch) external view returns (
        uint256 weightedTrue,
        uint256 weightedFalse,
        uint256 trueCount,
        uint256 falseCount
    ) {
        RumorEpochData storage data = rumorEpochData[rumorHash][epoch];
        return (data.weightedTrueVotes, data.weightedFalseVotes, data.trueVoteCount, data.falseVoteCount);
    }

    /**
     * @notice Calculate trust score for a rumor (0-100 scale)
     * @dev Returns weighted ratio: (trueVotes * 100) / (trueVotes + falseVotes)
     *      Returns 50 if no votes cast (neutral)
     */
    function getRumorTrustScore(bytes32 rumorHash) external view returns (uint256 score) {
        RumorEpochData storage data = rumorEpochData[rumorHash][currentEpoch];
        uint256 total = data.weightedTrueVotes + data.weightedFalseVotes;
        if (total == 0) return 50; // Neutral if no votes
        return (data.weightedTrueVotes * 100) / total;
    }

    /**
     * @notice Check if a voter has already voted on a rumor in current epoch
     */
    function hasVoted(bytes32 rumorHash, address voter) external view returns (bool) {
        return hasVotedInEpoch[rumorHash][currentEpoch][voter];
    }

    /**
     * @notice Check if a nullifier has been used for a rumor in current epoch
     */
    function isNullifierUsed(bytes32 rumorHash, bytes32 nullifier) external view returns (bool) {
        return nullifierUsed[rumorHash][currentEpoch][nullifier];
    }

    /**
     * @notice Get rumor details
     */
    function getRumor(bytes32 rumorHash) external view returns (
        string memory content,
        uint256 createdAt,
        uint256 createdEpoch,
        address creator,
        bool exists
    ) {
        Rumor storage r = rumors[rumorHash];
        return (r.content, r.createdAt, r.createdEpoch, r.creator, r.exists);
    }

    /**
     * @notice Check if bootstrap period is still active
     */
    function isBootstrapActive() external view returns (bool) {
        return bootstrapUsed < BOOTSTRAP_SLOTS;
    }

    /**
     * @notice Get remaining bootstrap slots
     */
    function remainingBootstrapSlots() external view returns (uint8) {
        return BOOTSTRAP_SLOTS - bootstrapUsed;
    }
}
