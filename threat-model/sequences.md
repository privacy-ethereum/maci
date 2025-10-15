sequenceDiagram
    autonumber
    %% MACI — End-to-End Data Flow (with Relayer path + Key Change)

    participant U as User / Wallet
    participant M as MACI.sol
    participant P as Poll.sol
    participant R as Off-chain Relayer
    participant I as IPFS
    participant C as Coordinator Service
    participant MP as MessageProcessor
    participant T as Tally
    participant V as Verifier

    %% ────────────── Setup & Deployment ──────────────
    Note over C,M: Setup and deployment
    C->>M: deploy MACI and dependencies
    C->>M: deployPoll(params) creates P

    %% ────────────── Registration & Join ─────────────
    Note over U,M: Registration and join on-chain
    U->>M: signUp(MACI_public_key)
    Note over U,P: Join the poll
    U->>P: joinPoll(ZK proof of MACI key + gatekeeper checks)

    %% ────────────── Vote Submission (two paths) ─────
    Note over U,P: Vote submission paths
    par Direct on-chain
        U->>P: publishMessage(encrypted_vote_message)
    and Via Off-chain Relayer
        U->>R: submit encrypted_vote_message off-chain
        R-->>R: verify user authorization via ZK
        R->>I: batch messages and upload to IPFS (CID)
        R->>P: publishBatch(batch_hash, IPFS_CID)
        Note over R,P: If CID is missing/invalid, finalization is impossible
    end

    %% ────────────── Key Change (optional, during Open) ─────────────
    Note over U,P: Key change (rotate MACI key)
    U->>U: generate new MACI keypair (new MACI pubkey)
    par Direct on-chain
        U->>P: publishMessage(encrypted_key_change)
    and Via Off-chain Relayer
        U->>R: submit encrypted_key_change off-chain
        R-->>R: verify authorization via ZK
        R->>I: batch key-change msgs to IPFS (CID)
        R->>P: publishBatch(batch_hash, IPFS_CID)
    end
    Note over C: During processing, latest valid key per user wins (state tree updated)

    %% ────────────── Poll Closed → Processing ────────
    Note over P,C: Poll closed then processing
    P-->>C: on-chain references visible (including CIDs)
    C->>I: fetch batches by CID
    C->>C: decrypt and validate messages (votes & key-changes)
    C->>C: apply latest-wins per voter (key & vote)
    C->>C: update state tree
    C->>MP: processMessages(stateTreeHash, zkProof)
    MP->>V: verify zkProof
    V-->>MP: true or false
    Note over MP,C: Repeat until all batches processed

    %% ────────────── Tally & Finalization ────────────
    Note over C,T: Tally and finalize
    C->>C: compute tally over valid state
    C->>T: tallyVotes(tallyHash, zkProof)
    T->>V: verify zkProof
    V-->>T: true or false
    T-->>P: mark Finalized and emit result commitments

    %% ────────────── Notes / Guarantees ──────────────
    Note over C,P: Coordinator trusted for liveness, not for correctness
    Note over U,P: Individual vote contents remain private
