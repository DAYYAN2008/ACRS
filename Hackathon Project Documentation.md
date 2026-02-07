# Anonymous Campus Rumor System (ACRS)

**Day 1 Strategy Document — Design Only (No Stack Specified)**

---

## 1. Problem Framing

We aim to build a **serverless, peer-to-peer, anonymous rumor system** for a university campus. There is **no central authority** deciding truth. Instead, trust emerges from **peer interaction, verification, and network structure**. The system must:

* Sync rumors **in real time** across peers
* Preserve **anonymity** (no accounts, no identities)
* Prevent **Sybil attacks** (1 person → many fake peers)
* Prevent **vote manipulation** and **historical score corruption**
* Be **simple enough to prototype in one day**

This document defines the **architecture and algorithms**, not the implementation stack.

---

## 2. Core Idea (The "Winning" Twist)

> **Influence without identity, uniqueness without surveillance.**

The system separates *participation* from *identity* using cryptographic proofs.

* **Zero-Knowledge Uniqueness:** Each student can act only once per rumor, provably.
* **Anonymity by Design:** No peer or authority can link actions to a real person.
* **Decentralized Verification:** Double-voting is prevented without accounts or admins.

Truth is not enforced by moderation, but by **mathematical constraints on influence**.

---

## 3. System Overview

Each peer (student device) runs the same three modules:

```
Peer
 ├── Local Data Store (rumors + scores)
 ├── Transport Layer (peer discovery + sync)
 └── Core Algorithms (trust, scoring, pruning)
```

There is **no global view** of the network. Each peer computes results **locally**, but converges probabilistically through syncing.

---

## 4. Transport & Sync Model (P2P)

### Presence

* On startup, a peer announces: *"I am here"*
* Peers discover nearby peers and form temporary connections

### Sync Primitive (Minimal)

Peers exchange only metadata first:

* Known rumor IDs
* Lightweight trust summaries

Full rumor content is exchanged **only if missing**.

### Propagation Rule (Gossip)

* New rumors are forwarded to **a small random subset** of peers
* Each rumor carries a **hop limit (TTL)**
* This prevents flooding and mirrors real rumor spread

---

## 5. Rumor Object (Conceptual)

Each rumor is immutable and append-only:

* `rumor_id` (hash of content)
* `content`
* `created_at`
* `status_votes` (verify / dispute)

Rumors are **never edited** — only new signals are added.

---

## 6. Trust Model (Sybil Resistance)

### Goal

Prevent a single actor from gaining large influence by spawning many fake peers.

### Key Insight

> Fake identities are cheap; *provable uniqueness* is not.

### Strategy: Trust-Limited Influence

* The system does **not** try to prove who someone is.
* It only limits **how much influence** any cluster of peers can exert.

Trust emerges from:

* Network structure (who can connect to whom)
* Participation history (time-scoped)

Each peer maintains a **local trust graph** of recently observed peers and connections.

### Trust Flow (Intuition)

* A small set of seed-trusted peers initialize trust
* Trust propagates through connections with **capacity limits**
* Sparse connections act as bottlenecks

As a result:

* Large Sybil clusters receive near-zero trust
* Honest regions accumulate influence naturally

This approximates the effect of **max-flow / min-cut** without global computation.

---

### Connectivity, Convergence, and Bounded Influence (Proof Sketch)

**Bounded Convergence.** The total voting influence of any coordinated group does not grow linearly with its size. As the group expands, its aggregate effective trust **mathematically converges to a fixed upper bound**, rather than increasing indefinitely.

**The Connectivity Bottleneck.** This upper bound is determined solely by the *width of the cut* separating the group from the rest of the network — i.e., the number and strength of trust connections from outside peers. Internal activity, volume of votes, or the number of nodes inside the group do not increase this bound.

**Capped Impact.** As a result, even if a coordinated or malicious cluster grows arbitrarily large, its collective influence remains capped to a minority fraction of the system (for example, converging to a fixed ~15% ceiling). This guarantees that no isolated group can ever dominate outcomes singlehandedly.

This property follows directly from flow conservation: trust entering a region is limited by its incoming edges, and cannot be amplified internally.

---

## 7. Rumor Scoring (No Simple Voting)

Votes are **weighted**, not counted.

```
Effective Impact = Vote × Trust(peer)
```

* High-trust peers influence more
* Low-trust peers can participate but cannot dominate

Rumor credibility emerges from **who supports it**, not how many.

---

## 8. Solving Identity & Double-Voting (The ZK-Shield)

### Problem

How to enforce *one student, one vote per rumor* **without collecting identities**.

### Strategy: Zero-Knowledge Proofs with Nullifiers

We introduce a **cryptographic uniqueness layer** that is external to the P2P network logic.

#### 1. Registration (One-Time)

* A student authenticates using a **campus-controlled channel** (e.g., email)
* They receive a one-time **secret**
* From this secret, the student generates a **zero-knowledge commitment**
* This commitment is published publicly

At this point:

* The university knows *someone* registered
* No one can link the commitment back to the email

#### 2. Anonymity Guarantee

* After registration, the secret never leaves the student’s device
* All future actions are proven via **zero-knowledge proofs**
* No peer learns who voted, only that the vote is valid

#### 3. Voting via Nullifiers

For each rumor:

```
Nullifier = Hash(Student_Secret + Rumor_ID)
```

* The nullifier is revealed during voting
* It proves *this secret has not voted on this rumor before*

#### 4. Double-Vote Prevention

* The network (or shared verification layer) checks if the nullifier already exists
* If yes → vote rejected
* If no → vote accepted and recorded

Crucially:

* The nullifier cannot be reversed to reveal identity
* A student cannot generate two different nullifiers for the same rumor

### Result

* One student → one vote
* Zero identities stored
* No behavioral tracking

This layer is orthogonal to trust scoring and cleanly composes with it.

---

## 9. Handling Deletions & Score Corruption

### Problem

Deleted rumors affecting new ones.

### Solution

* Trust is **time-scoped**
* Each rumor contributes to trust **only within its epoch**

When a rumor expires or is deleted:

* Its influence naturally decays
* No retroactive corruption occurs

This avoids complex cleanup logic.

---

## 10. Resistance to Coordinated Lying

Even if a group coordinates:

* Their total influence is capped by **incoming trust flow**
* Adding more fake peers does **not increase total trust**

This is a direct consequence of **flow conservation** in sparse cuts.

---

## 11. Why This Is Buildable in One Day

* No servers
* No cryptography-heavy protocols
* No global consensus
* No identity system

Only:

* Local graphs
* Iterative trust updates
* Gossip-based syncing

Each module is **small, testable, and explainable**.

---

## 12. What This Proves

* Truth can be **emergent**, not imposed
* Anonymity and abuse-resistance can coexist
* Mathematical constraints can replace moderation

> The system does not decide what is true.
> It decides **who is hard to fake**.

---

---

## 13. Deployment Pragmatics & Progressive Realization

The architecture described above is **theoretically sound and modular**, but its realization benefits from a staged deployment model. Certain components are computationally or operationally heavier than others and are therefore designed to be **progressively realized** without altering the core guarantees.

The key design principle is a clean separation between **logical correctness** and **infrastructure realization**.

---

## 14. Layered Execution Model

The system is intentionally decomposed into two orthogonal layers:

### Gossip Layer (Information Propagation)

* Responsible for real-time dissemination of rumors and signals
* Ensures responsiveness and availability
* Operates as a decentralized pub/sub substrate

### Consensus Layer (Integrity & Uniqueness)

* Responsible for enforcing vote uniqueness and auditability
* Serves as a durable, append-only source of truth
* Anchors critical invariants without participating in high-frequency messaging

This separation allows each layer to evolve independently while preserving system correctness.

---

## 15. Practical ZK-Shield Realization

While the conceptual model employs full zero-knowledge proofs, the design allows for **cryptographic substitutes** that preserve the same security properties.

### Nullifier-Based Uniqueness

* Each participant derives a private secret locally
* For a rumor ( R ), a vote reveals a nullifier:

```
Hash(Secret + R)
```

* A shared verification layer ensures each nullifier is used at most once

This mechanism enforces *one-participant-one-vote-per-rumor* without revealing identity and is fully compatible with future zero-knowledge upgrades.

---

## 16. Immutability, Revocation, and Historical Integrity

### Append-Only State

All system events are modeled as append-only records. Rumors are never deleted.

### Revocation Semantics

* A rumor may be marked as revoked via a revocation event
* User interfaces respect revocation while preserving historical continuity

### Trust Stability

* Trust scores are checkpointed periodically
* Historical states remain auditable and comparable

This prevents silent score drift and preserves long-term integrity.

---

## 17. System Resilience (Condensed Proof Sketch)

The campus network is modeled as a **sparse trust graph**:

* Honest participants form a well-connected region
* Coordinated adversaries form dense but weakly connected clusters

By flow conservation:

* Trust entering any region is bounded by its external connectivity
* Internal amplification is mathematically impossible

Consequently, no coordinated group can exceed a fixed influence ceiling, regardless of size.

---

**End of Strategy Document**
