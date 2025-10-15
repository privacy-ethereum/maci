# MACI Threat Model — L2 Deployment Addendum  
*(Extends the base MACI threat model for Layer-2 environments such as Optimism, Arbitrum, or Base.)*

---

## 1. Purpose

This addendum supplements the **MACI Threat Model** to account for deployment on **Layer-2 (L2)** rollups.  
It defines additional trust boundaries, assumptions, adversaries, and known weaknesses introduced by using an L2 execution and settlement environment.  

The core MACI invariants — privacy of votes, correctness of tallies, and anti-collusion guarantees — **remain unchanged**, but **availability and liveness** become conditional on the L2’s behavior and settlement guarantees.

---

## 2. System Overview & Trust Boundaries (L2 Context)

### Extended Components
- **L2 Sequencer** – Orders and batches transactions; short-term source of inclusion/censorship risk.  
- **Rollup Bridge / Settlement Contracts** – Enforce settlement and state correctness between L2 and Ethereum L1.  
- **Data Availability (DA) Layer** – Stores message and proof data required for L2 verification.  
- **Rollup Prover / Aggregator** – Generates proofs for L2 state transitions.

### Additional Trust Boundaries
| Boundary | Description | Risk |
|-----------|--------------|------|
| Wallet ↔ L2 Sequencer | Submission and ordering of L2 transactions | Sequencer censorship or delay |
| L2 ↔ L1 Bridge | Settlement and fraud/challenge verification | Potential prover or bridge bugs |
| L2 ↔ DA Layer | Data posting and retrieval | Data withholding or DA downtime |
| Coordinator ↔ L2 | Proof publication | Sequencer delays or reorgs before settlement |

---

## 3. Security and Privacy Invariants (Clarified for L2)

- **Privacy** – Unchanged. Votes remain encrypted; only the coordinator can decrypt.  
- **Integrity** – Unchanged. If the proof verifies on-chain (L1 or L2 verifier), the tally is correct.  
- **Availability/Liveness (Conditional)** –  
  *If I submit a valid message before the deadline, the system aims to have it included and processed, subject to L2 inclusion, settlement, and DA guarantees.*  
  (This invariant is weaker than L1 availability because it depends on L2 sequencer and DA uptime.)

---

## 4. Adversaries Considered (Extended Catalog)

- [ ] **L2 Sequencer (censor/reorder/withhold)** — May delay inclusion or order messages unfairly; cannot forge settled state.  
- [ ] **Rollup Prover / Bridge Attacker** — Exploits vulnerabilities in proof generation or L1 settlement contracts.  
- [ ] **Data Availability Operator / Committee** — Can withhold or delete message data, blocking verification or recovery.  
- [ ] **Cross-domain Reorg Actor** — Attempts to exploit differences between L2 provisional and L1 finalized states.  

*(These extend the base adversaries list in the main threat model.)*

---

## 5. Assumptions about Dependencies (L2-Specific)

- **L2 Inclusion and Settlement**  
  - Assume L2 will eventually include valid transactions or provide forced-inclusion mechanisms.  
  - Assume settlement to L1 is accurate after the challenge window.  
  - Do *not* assume the sequencer is uncensorable in the short term.

- **Bridge and Prover Correctness**  
  - Assume rollup bridge and prover logic correctly enforce valid state transitions.  
  - A bug or backdoor here may invalidate the entire security model.

- **Data Availability (DA)**  
  - Assume that the data required to verify proofs is posted on L1 (calldata) or available through a trusted DA provider.  
  - A DA failure means MACI proofs cannot be verified.

- **Deadlines and Time Sensitivity**  
  - Assume poll deadlines and inclusion windows may shift due to sequencer delays or reorgs.  
  - Liveness promises must be framed in block-based rather than wall-clock terms when possible.

---

## 6. Known Weaknesses (L2-Specific)

| Weakness | Description | Impact |
|-----------|--------------|--------|
| **Sequencer Censorship / Downtime** | Temporary censorship or downtime delays message inclusion. | Affects liveness only |
| **Challenge-Window Reorgs** | States before L1 finality may be reverted. | UX inconsistency; replay protection required |
| **DA Withholding** | Missing or unavailable batches block verification and finalization. | Blocks correctness verification |
| **Bridge / Prover Bugs** | Settlement logic errors can invalidate proofs or allow incorrect rollup states. | Catastrophic integrity failure |
| **Sequencer Ordering Bias (MEV)** | Preferential ordering could leak metadata or manipulate timestamps. | Privacy metadata risk |

---

## 7. Version Anchors (Recommended Additions)

When tagging this model alongside software releases, also record:

- **Deployment target:** `Ethereum L1 | <RollupName>`  
- **Settlement contract address:** `<L1 bridge contract>`  
- **Rollup software version:** `<commit or release>`  
- **Data Availability mode:** `L1 calldata | Alt-DA (provider)`  
- **Challenge window duration:** `<N blocks or minutes>`  

---

## 8. Alignment with Core Threat Model

| Category | Base Model | L2 Addendum Change |
|-----------|-------------|--------------------|
| Privacy | Unchanged | Same guarantees hold |
| Integrity | Unchanged | Still enforced by zk-SNARK verification |
| Availability | Weakened | Conditional on L2 sequencing, DA, settlement |
| Assumptions | Expanded | Bridge, DA, sequencer correctness added |
| Adversaries | Expanded | Sequencer, prover, DA operators |
| Weaknesses | Expanded | L2-specific liveness and censorship cases |

---

## 9. References

- [Optimism Bedrock Spec](https://specs.optimism.io/)
- [Arbitrum Protocol Docs](https://docs.arbitrum.io/)
- [Ethereum.org – Rollup Security Model](https://ethereum.org/en/developers/docs/scaling/rollups/)
- [MACI Documentation – Workflow](https://maci.pse.dev/docs/introduction)
- [MACI Technical References](https://maci.pse.dev/docs/technical-references/)
