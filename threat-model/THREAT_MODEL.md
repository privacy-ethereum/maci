# MACI THREAT_MODEL

---

## 1. Introduction

This document describes the security and privacy threat model for **MACI (Minimum Anti-Collusion Infrastructure)**.  
It follows an *invariant-centric* approach: we define the properties that must always hold for users (invariants), the assumptions these guarantees rely on, and any known weaknesses.  

This model is versioned with the codebase and anchored to the system-level data flow specification in  
[`threat-model/SYSTEM_SPECIFICATION.md`](../threat-model/SYSTEM_SPECIFICATION.md) and [`threat-model/sequences.md`](../threat-model/sequences.md).  
Any change to circuits, contracts, coordinator logic, or data flow that affects guarantees requires an update here.

---

## 2. System Overview & Trust Boundaries

### System Overview

The MACI protocol enables **collusion-resistant voting and funding** through zero-knowledge proofs and controlled decryption by a coordinator.  

For a detailed end-to-end description of message flow, proof generation, and poll lifecycle, see  
[`threat-model/SYSTEM_SPECIFICATION.md`](../threat-model/SYSTEM_SPECIFICATION.md) and [`threat-model/sequences.md`](../threat-model/sequences.md).

**Core Components (as defined in data-flow doc):**
- **Users / Voters** – generate MACI keypairs, sign up, join polls, and submit encrypted votes.
- **Wallets / Clients** – manage keys and submit transactions or messages via RPC or relayers.
- **Coordinator Service** – deploys polls, decrypts and tallies votes, generates zk-SNARK proofs, and publishes verified results.
- **Off-chain Relayer** – batches encrypted messages, uploads to IPFS, and submits hashes to on-chain Poll contracts.
- **Smart Contracts** – record signups, accept votes, and verify zk proofs (`MACI.sol`, `Poll.sol`, `MessageProcessor`, `Tally`, `Verifier`).
- **Verifier Contracts** – validate the correctness of message and tally proofs.
- **IPFS / Off-chain Storage** – stores message batches.
- **zkSNARK Circuits** – define proof constraints for processing and tally correctness.
- **Ethereum / L2** – provides canonical inclusion, finality, and data availability.

---

### Trust Boundaries

The following trust boundaries are derived directly from the system-level data flow:

| Boundary | Data Flow Context | Description / Dependence |
|-----------|------------------|---------------------------|
| **User ↔ Wallet/Client** | Key generation & signing | Out of scope but affects user key secrecy; wallet compromise exposes MACI identity. |
| **Wallet ↔ Relayer / RPC** | Off-chain submission | Relayer correctness and metadata privacy are not guaranteed. |
| **Relayer ↔ IPFS** | Batch persistence | If IPFS batches are missing or corrupted, poll finalization is blocked. |
| **Coordinator ↔ Blockchain** | Proof publication | Coordinator can halt or censor proof publication (affecting liveness). |
| **Coordinator ↔ Verifier** | Proof checking | Assumes verifier contract and circuits match and are sound. |
| **Coordinator ↔ IPFS** | Message retrieval | Coordinator depends on IPFS data integrity to decrypt and process votes. |

> These boundaries define where **invariants stop** and **assumptions begin**.  
> Cross-boundary behavior (e.g., relayer, RPC, or coordinator behavior) cannot be guaranteed within MACI’s cryptographic design.

---

## 3. Security and Privacy Invariants

### Privacy & Anti-Collusion Invariants

**I1 — Vote privacy from on-chain data**  
If I submit a valid encrypted vote/command, no one can learn its contents from on-chain data alone.  
_Source: MACI Docs — “users cannot prove how they voted.”_

**I2 — Anti-proof-of-vote**  
Even if I try to prove to a briber how I voted, the system gives the briber no reliable evidence.  
_Source: MACI Docs — prevents users from being able to prove how they voted._

### Integrity Invariants

**I3 — Tally correctness if proof verifies**  
If the on-chain verifier accepts the zero-knowledge proof, the published tally equals the correct result of all valid user messages.  
_Source: MACI Docs — “proof is posted on-chain to verify correctness.”_

**I4 — Vote unforgeability**  
Only the holder of a registered MACI private key can cast or update a vote tied to its public key.  
_Source: MACI specification: “MACI provides unforgeability.”_

**I5 — Non-repudiation / Correct execution**  
Once a vote is cast, no one may modify or delete it except the original voter, who can override it with a newer valid vote.  
_Source: MACI specification: “MACI provides non-repudiation” and “Correct execution.”_

### Availability / Liveness / Censorship-Resistance Invariants

**I6 — Inclusion before deadline (best-effort)**  
If I post a valid command before the poll deadline and pay gas, the system aims to include it in the processed set.  
MACI does not claim unconditional liveness; progress depends on coordinator and network availability.  
_Source: MACI Docs — coordinator processes all messages and posts proofs._

**I7 — Censorship-resistance (aspirational)**  
No entity, including the coordinator, should be able to prevent valid votes from being included during an open poll.  
MACI aims for this but cannot guarantee it if the coordinator halts or an L1/L2 censor occurs.  
_Source: MACI specification: “MACI is uncensorable.”_

---

## 4. Adversaries Considered

> Base catalog, extended for MACI-specific actors.

- [x] **Network observer / manipulator** — may monitor, reorder, or delay transactions.  
- [x] **Sybil farm** — may register many fake identities if gatekeeping fails.  
- [x] **Rogue coordinator** — can censor or withhold processing but cannot falsify proofs.  
- [x] **Rogue relayer** — can drop or misreport IPFS batches.  
- [x] **Infra insider** — may access logs (RPC, IPFS, CI).  
- [x] **L1/L2 censor/reorg attacker** — may delay finality.  
- [x] **Trusted setup cheater** — could retain toxic waste.  
- [x] **Endpoint deanonymizer** — may correlate IPs and MACI public keys.  
- [x] **Data-hoarder (harvest-now, decrypt-later)** — records encrypted messages for future decryption.  
- [ ] **Social engineer / phishing** — risks out of scope for MACI core but relevant for users.

---

## 5. Assumptions About Dependencies

Derived from data flow trust boundaries:

- **Relayer honesty & IPFS persistence**  
  We assume relayer correctly uploads and references valid IPFS batches.  
  Missing or corrupted IPFS data prevents poll finalization.  
  _(Data Flow §E, §F.)_

- **Verifier correctness**  
  We assume on-chain verifier contracts accurately validate proofs produced by corresponding circuits.  
  Any mismatch or deployment error may cause false rejections or acceptance of invalid proofs.  
  _(Data Flow §G, §H.)_

- **Coordinator liveness (not integrity)**  
  We assume coordinator eventually decrypts and processes messages and submits proofs.  
  Integrity remains preserved even if liveness fails.  
  _(Workflow: “Trust assumptions.”)_

- **Ethereum / L2 availability**  
  We assume eventual inclusion of valid transactions and proof submissions.  
  _(General assumption.)_

- **Wallet / RPC correctness**  
  We assume RPC responses and transaction propagation are correct.  
  Privacy at RPC layer is not assumed.

---

## 6. Known Weaknesses

This section must remain non-empty.

- Coordinator can halt or censor poll finalization (liveness failure).  
- Poll finalization can be blocked if IPFS batches are missing or corrupted.  
- Relayer metadata or IPFS logs may leak participation patterns or timing.  
- On-chain metadata (gas price, sender, timestamp) can reveal voting activity.  
- Trusted setup compromise (if Groth16) could allow proof forgery.  
- PQ risk — “harvest now, decrypt later” applies to encrypted votes.
- Uncensorability is **not absolute**; a malicious or halted coordinator can prevent inclusion until replaced.  
- Collusion resistance assumes that encryption keys and coordinator private key remain secret; full compromise breaks privacy.  
---

## 7. Version Anchor

This threat model applies to:
- **Software / Protocol release:** `v3.x`  
- **Data Flow specification:** [`docs/data-flows-maci.md`](../docs/data-flows-maci.md) @ commit `<hash>`  
- **Artifacts:**  
  - Circuit hash: `<commit_or_zkey>`  
  - Verifier bytecode hash: `<contract_hash>`  
  - Trusted setup CID: `<cid>`

---

## 8. Change Log

- **v0.1 (YYYY-MM-DD):** Initial threat model derived from MACI docs.  
- **v0.2 (YYYY-MM-DD):** Integrated with `docs/data-flows-maci.md`; added Relayer/IPFS boundaries and dependencies.  
- **v0.3 (YYYY-MM-DD):** Added verifier correctness and liveness dependency; clarified known weaknesses.

---

## 9. Relationship to Data Flow Model

This threat model and `docs/data-flows-maci.md` form complementary artifacts:

| Artifact | Purpose |
|-----------|----------|
| **Data Flow Model** | Describes *how* data moves and where control is handed off. |
| **Threat Model** | Defines *what must hold true* (invariants) and *what we assume* at each trust boundary. |

Every flow segment listed in the data-flow document maps to either:  
- an **Invariant** (inside MACI’s control), or  
- an **Assumption / Known Weakness** (cross-boundary or external).

Maintainers must ensure that all new boundaries, relayers, or circuit variants added in data flows are reflected here.

---

### References
- [MACI Workflow](https://maci.pse.dev/docs/introduction)  
- [Coordinator Service](https://maci.pse.dev/docs/technical-references/coordinator-service/)  
- [Off-chain Relayer](https://maci.pse.dev/docs/technical-references/offchain-relayer/)  
- [Trusted Setup](https://maci.pse.dev/docs/trusted-setup)
