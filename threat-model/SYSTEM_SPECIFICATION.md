# MACI Data Flows — System-Level Specification  

---

## 1. Purpose

This document describes the **data flows in the MACI protocol** as explicitly defined in its published documentation.  
It covers how information moves between on-chain and off-chain components — from user signup and vote submission to coordinator tallying and proof publication.

All flows below are factual summaries of official MACI docs; any implementation detail not present in the docs is clearly marked as **unspecified**.

---

## 2. Roles and Components

| Role | Responsibility | Documentation Source |
|------|----------------|----------------------|
| **User (Voter)** | Signs up, joins polls, submits encrypted votes. | Workflow: “Users, who vote on polls” |
| **Coordinator** | Deploys contracts and polls, decrypts and tallies votes, generates zk-SNARK proofs, publishes results. | Workflow; Coordinator Service |
| **Relayer (Off-chain)** | Allows gasless voting, batches messages, uploads to IPFS, submits message hashes on-chain. | Off-chain Relayer |
| **Smart Contracts (including Verifier contracts)** | Manage user signups and polls, record encrypted votes, and verify zk-SNARK proofs for message processing and tally correctness. | Workflow, Technical References |
| **IPFS / Off-chain Storage** | Holds encrypted message batches submitted by the relayer. | Off-chain Relayer |
| **zkSNARK Circuits** | Define proofs for `processMessages` and `tallyVotes`. | Technical References |
| **Ethereum / L2** | Provides canonical ledger for state commitments and proof verification. | General docs |

---

## 3. Poll Lifecycle and Data Flow Overview

Each **Poll** progresses through **three stages**:  
1. **Open** — users can sign up, join, and vote.  
2. **Closed** — voting ends; coordinator processes messages.  
3. **Finalized** — coordinator tallies results and publishes verified proofs.

MACI’s workflow is a data-driven state machine where messages flow between **users**, **relayer**, **on-chain contracts**, **off-chain coordinator**, and **verifiers**.

---

## 4. Detailed Data Flows

### A. Setup and Deployment

**Coordinator → Blockchain**

1. Deploy `MACI.sol` and dependent contracts (`PollFactory`, `Gatekeeper`, `Verifier`, etc.).  
   - Sets gatekeeper policy (who can sign up).  
   - Defines state tree depth (max voters).  
   - Specifies voting mode (e.g., quadratic funding).  
   _Source: Coordinator Service._

2. Deploy a **Poll** via `MACI.deployPoll()`.  
   - Poll parameters include: gatekeeper, start/end dates, vote options, and voting mode.  
   _Source: Workflow → Poll Lifecycle._

3. Initialize **trusted setup parameters** for proof verification (Groth16 keys).  
   _Source: Trusted Setup docs._

---

### B. User Sign Up

**User/Wallet → MACI.sol**

1. Generate MACI keypair (distinct from Ethereum key).  
2. Call `signUp()` on the MACI contract with the **public key**.  
   - This key becomes the voter’s MACI identity.  
   - The gatekeeper policy enforces Sybil resistance (e.g., NFT, EAS attestation, proof-of-personhood).  
   _Source: Workflow → “Sign up.”_

**Data artifacts created:**
- `signUp()` event (public).  
- User’s MACI public key (on-chain state tree leaf).  
- Associated private key (off-chain only, user-held).

---

### C. Poll Joining

**User/Wallet → Poll.sol**

1. Call poll’s **join** function, providing:  
   - ZK proof of knowledge of a MACI public key in the state tree, a new key to vote on the poll and a nullifier without revealing which keys they are  
   - Any poll-specific gatekeeper credentials.  
   _Source: Workflow → “Poll Joining.”_

2. On success, user is registered to vote in that poll instance.

**Data artifacts created:**
- On-chain proof of poll eligibility.  
- Internal state tree update linking user to poll.

---

### D. Vote Command and Message Creation

**User/Wallet (local)**

1. Build a **command** (fields per docs):  
   - `maciPublicKey`, `voteOption`, `voteWeight`, `nonce`, `pollId`, `salt`  
   _Source: Workflow → “Vote.”_

2. **Sign** the command with the MACI private key.  
3. **Encrypt** the command and signature with a shared key between user and coordinator.  
   - Each user–coordinator pair uses a distinct encryption key.  
   - This ensures only the coordinator can decrypt the message.  
   _Source: Workflow → “Before sending their vote on-chain…”_

4. Resulting ciphertext = **Message**.

---

### E. Message Submission (Two Paths)

#### Path 1 — On-chain (direct)

**User/Wallet → Poll.sol**  
- Call `publishMessage()` with encrypted message.  
- Message stored directly on-chain.  
_Source: Workflow → “Vote on a poll.”_

#### Path 2 — Off-chain Relayer (privacy/gasless)

**User/Wallet → Relayer**  
1. Send encrypted message off-chain.  
2. Relayer verifies user authorization via ZK proof (user must know pre-image to a state leaf).  
3. Relayer batches messages and uploads them to IPFS.  
4. Relayer submits **batch hash + IPFS CID** to `Poll.sol`.  
_Source: Off-chain Relayer/Core Concepts:Offchain Voting._

> ⚠️ If batch hashes are submitted without valid IPFS storage, polls cannot be finalized.  
> _Source: Off-chain Relayer._

**Data artifacts created:**
- IPFS batch (off-chain)  
- On-chain reference (CID + hash)

---

### F. Poll Closing

**Blockchain → Coordinator**

1. Once poll duration elapses, Poll transitions from **Open → Closed**.  
2. No further messages accepted.  
3. Coordinator begins off-chain processing.  
_Source: Workflow → “Closed.”_

---

### G. Message Processing

**Coordinator (local)**

1. Fetch all IPFS batches using on-chain CIDs.  
2. Decrypt and validate each message.  
3. Apply valid messages to the **state tree**, ignoring superseded votes (only the latest per voter counts).  
   _Source: Workflow → “Process Messages.”_

4. Create ZK proof showing:  
   - Correct decryption of messages.  
   - Correct state tree transitions.

**Coordinator → Blockchain**  
5. Call `MessageProcessor.processMessages()` with:  
   - State tree hash  
   - zk-SNARK proof

**Verifier Contract**  
6. Verifies proof validity.  
   - If returns `true`, the processed batch is confirmed correct.  
   - Repeat until all messages are processed.  
   _Source: Workflow → “Process Messages.”_

**Data artifacts:**  
- Updated state tree (off-chain)  
- Batch proofs (on-chain)  
- Message proofs (verifier output)

---

### H. Tally Results

**Coordinator (local)**

1. Compute tally from valid votes in state tree.  
2. Generate ZK proof that tally corresponds to valid votes.  
   _Source: Workflow → “Tally Results.”_

**Coordinator → Blockchain**  
3. Call `Tally.tallyVotes()` with:  
   - Tally hash  
   - zk-SNARK proof

**Verifier Contract**  
4. Validates tally proof.  
   - If valid, Poll moves to **Finalized** state.

**Data artifacts:**  
- Tally proof + hash  
- On-chain event `PollFinalized`

---

### I. Finalization and Verification

**Blockchain (public)**

- The poll’s final state, tally hash, and ZK proof are now visible.  
- Any user can verify that the results were correctly computed from valid encrypted votes.  
- Individual votes remain private.  
_Source: Workflow → “Finalized.”_

---

## 5. Trust Boundaries (per flow segment)

| Flow Segment | Trust Boundary | Possible Weakness |
|---------------|----------------|-------------------|
| User ↔ Wallet | Key generation & signing | Key leakage compromises user’s MACI identity |
| Wallet ↔ Relayer | Off-chain submission | Relayer may log metadata or fail to upload IPFS batches |
| Relayer ↔ IPFS | Data persistence | Missing batches block finalization |
| Coordinator ↔ Blockchain | Proof publication | Coordinator may halt, delaying results |
| Coordinator ↔ Verifier | Proof correctness | Circuit mismatch or setup corruption may invalidate verification |

---

## 6. Failure and Liveness Scenarios (as documented)

| Failure Mode | Effect | Source |
|---------------|--------|--------|
| Coordinator halts / offline | Poll never finalized; results not published. | Workflow → “Trust assumptions” |
| Coordinator decrypts votes | Privacy loss but not integrity failure. | Workflow → “Trust assumptions” |
| Relayer pushes invalid IPFS hash | Poll cannot be finalized. | Off-chain Relayer |
| zk-SNARK setup compromised | Fake proofs accepted. | Trusted Setup |
| L1/L2 censorship | Delays proof publication; no permanent forgery. | General assumption |

---
