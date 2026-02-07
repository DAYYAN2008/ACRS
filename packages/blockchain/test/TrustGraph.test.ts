import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("TrustGraph", function () {
  async function deployTrustGraphFixture() {
    const [owner, user1, user2, user3] = await hre.ethers.getSigners();

    const TrustGraph = await hre.ethers.getContractFactory("TrustGraph");
    const trustGraph = await TrustGraph.deploy();

    return { trustGraph, owner, user1, user2, user3 };
  }

  describe("Deployment", function () {
    it("Should set the deployer as owner", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      expect(await trustGraph.owner()).to.equal(owner.address);
    });

    it("Should register deployer as genesis user with initial trust", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      expect(await trustGraph.isRegistered(owner.address)).to.be.true;
      expect(await trustGraph.trustScore(owner.address)).to.equal(10);
    });

    it("Should have bootstrap slots available minus the deployer", async function () {
      const { trustGraph } = await loadFixture(deployTrustGraphFixture);
      expect(await trustGraph.remainingBootstrapSlots()).to.equal(9);
    });
  });

  describe("Bootstrap Registration", function () {
    it("Should allow self-registration during bootstrap period", async function () {
      const { trustGraph, user1 } = await loadFixture(deployTrustGraphFixture);
      const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user1secret"));
      
      await trustGraph.connect(user1).bootstrapRegister(commitment);
      
      expect(await trustGraph.isRegistered(user1.address)).to.be.true;
      expect(await trustGraph.trustScore(user1.address)).to.equal(10);
    });

    it("Should reject duplicate registration", async function () {
      const { trustGraph, user1 } = await loadFixture(deployTrustGraphFixture);
      const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user1secret"));
      
      await trustGraph.connect(user1).bootstrapRegister(commitment);
      
      await expect(
        trustGraph.connect(user1).bootstrapRegister(commitment)
      ).to.be.revertedWithCustomError(trustGraph, "AlreadyRegistered");
    });

    it("Should reject empty commitment", async function () {
      const { trustGraph, user1 } = await loadFixture(deployTrustGraphFixture);
      
      await expect(
        trustGraph.connect(user1).bootstrapRegister(hre.ethers.ZeroHash)
      ).to.be.revertedWithCustomError(trustGraph, "InvalidCommitment");
    });
  });

  describe("Invite System", function () {
    it("Should allow registered users to invite others", async function () {
      const { trustGraph, owner, user1 } = await loadFixture(deployTrustGraphFixture);
      const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user1secret"));
      
      await trustGraph.connect(owner).inviteUser(user1.address, commitment);
      
      expect(await trustGraph.isRegistered(user1.address)).to.be.true;
      expect(await trustGraph.inviter(user1.address)).to.equal(owner.address);
    });

    it("Should reject invite from unregistered user", async function () {
      const { trustGraph, user1, user2 } = await loadFixture(deployTrustGraphFixture);
      const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("secret"));
      
      await expect(
        trustGraph.connect(user1).inviteUser(user2.address, commitment)
      ).to.be.revertedWithCustomError(trustGraph, "NotRegistered");
    });

    it("Should reject self-invite", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("secret"));
      
      await expect(
        trustGraph.connect(owner).inviteUser(owner.address, commitment)
      ).to.be.revertedWithCustomError(trustGraph, "CannotInviteSelf");
    });
  });

  describe("Voting", function () {
    it("Should allow registered users to vote", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test rumor"));
      
      await trustGraph.connect(owner).castVote(rumorHash, true);
      
      const [weightedTrue, weightedFalse, trueCount, falseCount] = await trustGraph.getRumorVotes(rumorHash);
      expect(trueCount).to.equal(1);
      expect(weightedTrue).to.be.gt(0);
    });

    it("Should prevent double voting", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test rumor"));
      
      await trustGraph.connect(owner).castVote(rumorHash, true);
      
      await expect(
        trustGraph.connect(owner).castVote(rumorHash, false)
      ).to.be.revertedWithCustomError(trustGraph, "AlreadyVoted");
    });

    it("Should calculate vote weight using quadratic formula", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      
      // Trust score 10 -> weight should be approximately sqrt(10) ≈ 3
      const weight = await trustGraph.calculateVoteWeight(owner.address);
      expect(weight).to.be.gte(3);
      expect(weight).to.be.lte(4);
    });

    it("Should correctly tally verify and dispute votes", async function () {
      const { trustGraph, owner, user1, user2 } = await loadFixture(deployTrustGraphFixture);
      
      // Register users
      const c1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("s1"));
      const c2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("s2"));
      await trustGraph.connect(user1).bootstrapRegister(c1);
      await trustGraph.connect(user2).bootstrapRegister(c2);
      
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Controversial rumor"));
      
      await trustGraph.connect(owner).castVote(rumorHash, true);
      await trustGraph.connect(user1).castVote(rumorHash, true);
      await trustGraph.connect(user2).castVote(rumorHash, false);
      
      const [, , trueCount, falseCount] = await trustGraph.getRumorVotes(rumorHash);
      expect(trueCount).to.equal(2);
      expect(falseCount).to.equal(1);
    });
  });

  describe("Rumor Registration", function () {
    it("Should register rumors on-chain", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      const content = "Breaking news on campus!";
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(content));
      
      await trustGraph.connect(owner).registerRumor(rumorHash, content);
      
      const [storedContent, , , creator, exists] = await trustGraph.getRumor(rumorHash);
      expect(exists).to.be.true;
      expect(storedContent).to.equal(content);
      expect(creator).to.equal(owner.address);
    });

    it("Should track rumor count", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      
      expect(await trustGraph.getRumorCount()).to.equal(0);
      
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Rumor 1"));
      await trustGraph.connect(owner).registerRumor(rumorHash, "Rumor 1");
      
      expect(await trustGraph.getRumorCount()).to.equal(1);
    });
  });

  describe("Trust Scores", function () {
    it("Should calculate rumor trust score correctly", async function () {
      const { trustGraph, owner, user1 } = await loadFixture(deployTrustGraphFixture);
      
      const c1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("s1"));
      await trustGraph.connect(user1).bootstrapRegister(c1);
      
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test"));
      
      // Both verify -> should be 100
      await trustGraph.connect(owner).castVote(rumorHash, true);
      await trustGraph.connect(user1).castVote(rumorHash, true);
      
      expect(await trustGraph.getRumorTrustScore(rumorHash)).to.equal(100);
    });

    it("Should return 50 for rumors with no votes", async function () {
      const { trustGraph } = await loadFixture(deployTrustGraphFixture);
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Unvoted"));
      
      expect(await trustGraph.getRumorTrustScore(rumorHash)).to.equal(50);
    });
  });

  describe("Epoch Isolation", function () {
    it("Should isolate votes by epoch", async function () {
      const { trustGraph, owner } = await loadFixture(deployTrustGraphFixture);
      const rumorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test"));
      
      await trustGraph.connect(owner).castVote(rumorHash, true);
      
      // Advance epoch
      await trustGraph.connect(owner).advanceEpoch();
      
      // Check old epoch still has vote
      const [, , trueCountOld, ] = await trustGraph.getRumorVotesForEpoch(rumorHash, 0);
      expect(trueCountOld).to.equal(1);
      
      // New epoch should have no votes
      const [, , trueCountNew, ] = await trustGraph.getRumorVotes(rumorHash);
      expect(trueCountNew).to.equal(0);
      
      // Should be able to vote again in new epoch
      await trustGraph.connect(owner).castVote(rumorHash, false);
      expect(await trustGraph.hasVoted(rumorHash, owner.address)).to.be.true;
    });
  });

  describe("Slashing", function () {
    it("Should reduce trust score when slashed", async function () {
      const { trustGraph, owner, user1 } = await loadFixture(deployTrustGraphFixture);
      const c1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("s1"));
      await trustGraph.connect(user1).bootstrapRegister(c1);
      
      await trustGraph.connect(owner).slash(user1.address, 5, "Bad behavior");
      
      expect(await trustGraph.trustScore(user1.address)).to.equal(5);
    });

    it("Should propagate slash to inviter", async function () {
      const { trustGraph, owner, user1 } = await loadFixture(deployTrustGraphFixture);
      const c1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("s1"));
      
      // Owner invites user1
      await trustGraph.connect(owner).inviteUser(user1.address, c1);
      
      const ownerTrustBefore = await trustGraph.trustScore(owner.address);
      await trustGraph.connect(owner).slash(user1.address, 3, "Bad behavior");
      
      // Owner should lose INVITE_STAKE (5) points
      expect(await trustGraph.trustScore(owner.address)).to.equal(ownerTrustBefore - BigInt(5));
    });
  });
});
