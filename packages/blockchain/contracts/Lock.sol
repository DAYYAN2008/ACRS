// packages/blockchain/contracts/CampusTrust.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CampusTrust {
    // Trusted students (White-list)
    mapping(address => bool) public isStudent;
    // Track if a student has voted on a specific Rumor ID
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    
    // Invite system
    mapping(address => uint256) public invitesLeft;

    event StudentJoined(address indexed newStudent, address indexed invitedBy);
    event VoteCast(bytes32 indexed rumorId, address indexed voter);

    constructor() {
        // The deployer (YOU) is the first student and has infinite invites (for demo)
        isStudent[msg.sender] = true;
        invitesLeft[msg.sender] = 999; 
    }

    // Function 1: Join via Invite
    function joinNetwork(address _friend) external {
        require(isStudent[msg.sender], "Only students can invite");
        require(invitesLeft[msg.sender] > 0, "No invites left");
        require(!isStudent[_friend], "Already a student");

        isStudent[_friend] = true;
        invitesLeft[_friend] = 3; // New students get 3 invites
        invitesLeft[msg.sender]--;

        emit StudentJoined(_friend, msg.sender);
    }

    // Function 2: Verify & Record Vote (The "Nullifier" Check)
    function verifyVote(string memory _rumorContentHash) external returns (bool) {
        require(isStudent[msg.sender], "Not a verified student");
        
        bytes32 rumorId = keccak256(abi.encodePacked(_rumorContentHash));
        require(!hasVoted[rumorId][msg.sender], "Double vote detected!");

        hasVoted[rumorId][msg.sender] = true;
        emit VoteCast(rumorId, msg.sender);
        return true;
    }
}