pragma circom 2.0.0;

// circomlib import
include "./mux1.circom";
// zk-kit imports
include "./safe-comparators.circom";
// local imports
include "../../utils/hashers.circom";
include "../../utils/messageToCommand.circom";
include "../../utils/privToPubKey.circom";
include "../../utils/processMessagesInputHasher.circom";
include "../../utils/qv/stateLeafAndBallotTransformer.circom";
include "../../trees/incrementalQuinaryTree.circom";
include "../../trees/incrementalMerkleTree.circom";

/**
 * Proves the correctness of processing a batch of MACI messages.
 * This template supports the Quadratic Voting (QV).
 */
template ProcessMessages(
    stateTreeDepth,
    batchSize,
    voteOptionTreeDepth
) {
    // Must ensure that the trees have a valid structure.
    assert(stateTreeDepth > 0);
    assert(batchSize > 0);
    assert(voteOptionTreeDepth > 0);

    // Default for IQT (quinary trees).
    var VOTE_OPTION_TREE_ARITY = 5;
    // Default for binary trees.
    var STATE_TREE_ARITY = 2;
    var MSG_LENGTH = 10;
    var PACKED_CMD_LENGTH = 4;
    var STATE_LEAF_LENGTH = 4;
    var BALLOT_LENGTH = 2;
    var BALLOT_NONCE_IDX = 0;
    var BALLOT_VO_ROOT_IDX = 1;
    var STATE_LEAF_PUB_X_IDX = 0;
    var STATE_LEAF_PUB_Y_IDX = 1;
    var STATE_LEAF_VOICE_CREDIT_BALANCE_IDX = 2;
    var STATE_LEAF_TIMESTAMP_IDX = 3;
    var msgTreeZeroValue = 8370432830353022751713833565135785980866757267633941821328460903436894336785;

    // nb. The usage of SHA-256 hash is necessary to save some gas costs at verification time
    // at the cost of more constraints for the prover.
    // Basically, some values from the contract are passed as private inputs and the hash as a public input.

    // The SHA-256 hash of values provided by the contract.
    signal input inputHash;
    signal input packedVals;
    // Number of users that have completed the sign up.
    signal numSignUps;
    // Number of options for this poll.
    signal maxVoteOptions;
    // Value of chainHash at beginning of batch
    signal input inputBatchHash;
    // Value of chainHash at end of batch
    signal input outputBatchHash;
    // The messages.
    signal input msgs[batchSize][MSG_LENGTH];
    // The coordinator's private key.
    signal input coordPrivKey;
    // The cooordinator's public key (derived from the contract).
    signal input coordPubKey[2];
    // The ECDH public key per message.
    signal input encPubKeys[batchSize][2];
    // The current state root (before the processing).
    signal input currentStateRoot;
    // The actual tree depth (might be <= stateTreeDepth).
    // @note it is a public input to ensure fair processing from 
    // the coordinator (no censoring)
    signal input actualStateTreeDepth;

    // The state leaves upon which messages are applied.
    //    transform(currentStateLeaf[4], message5) => newStateLeaf4
    //    transform(currentStateLeaf[3], message4) => newStateLeaf3
    //    transform(currentStateLeaf[2], message3) => newStateLeaf2
    //    transform(currentStateLeaf[1], message1) => newStateLeaf1
    //    transform(currentStateLeaf[0], message0) => newStateLeaf0
    //    ...

    signal input currentStateLeaves[batchSize][STATE_LEAF_LENGTH];
    // The Merkle path to each incremental new state root.
    signal input currentStateLeavesPathElements[batchSize][stateTreeDepth][STATE_TREE_ARITY - 1];
    // The salted commitment to the state and ballot roots.
    signal input currentSbCommitment;
    signal input currentSbSalt;
    // The salted commitment to the new state and ballot roots.
    signal input newSbCommitment;
    signal input newSbSalt;
    // The current ballot root before batch processing.
    signal input currentBallotRoot;
    // Intermediate ballots.
    signal input currentBallots[batchSize][BALLOT_LENGTH];
    signal input currentBallotsPathElements[batchSize][stateTreeDepth][STATE_TREE_ARITY - 1];
    // Intermediate vote weights.
    signal input currentVoteWeights[batchSize];
    signal input currentVoteWeightsPathElements[batchSize][voteOptionTreeDepth][VOTE_OPTION_TREE_ARITY - 1];

    // nb. The messages are processed in REVERSE order.
    // Therefore, the index of the first message to process does not match the index of the
    // first message (e.g., [msg1, msg2, msg3] => first message to process has index 3).

    // The index of the first message in the batch, inclusive.
    signal batchStartIndex;
    
    // The index of the last message in the batch to process, exclusive.
    // This value may be less than batchSize if this batch is
    // the last batch and the total number of messages is not a multiple of the batch size.
    signal batchEndIndex;

    // The history of state and ballot roots and temporary intermediate
    // signals (for processing purposes).
    signal stateRoots[batchSize + 1];
    signal ballotRoots[batchSize + 1];

    // Must verify the current sb commitment.
    var computedCurrentSbCommitment = PoseidonHasher(3)([currentStateRoot, currentBallotRoot, currentSbSalt]);
    computedCurrentSbCommitment === currentSbCommitment;

    // Verify public inputs and assign unpacked values.
    var (
        computedMaxVoteOptions, 
        computedNumSignUps, 
        computedBatchStartIndex, 
        computedBatchEndIndex, 
        computedHash
    ) = ProcessMessagesInputHasher()(
        packedVals,
        coordPubKey,
        outputBatchHash,
        currentSbCommitment,
        newSbCommitment,
        actualStateTreeDepth
    );

    // The unpacked values from packedVals.
    computedMaxVoteOptions ==> maxVoteOptions;
    computedNumSignUps ==> numSignUps;
    computedBatchStartIndex ==> batchStartIndex;
    computedBatchEndIndex ==> batchEndIndex;
    // Matching constraints.
    computedHash === inputHash;

    // 0. Ensure that the maximum vote options signal is valid and if
    // the maximum users signal is valid.
    var maxVoValid = LessEqThan(32)([maxVoteOptions, VOTE_OPTION_TREE_ARITY ** voteOptionTreeDepth]);
    maxVoValid === 1;

    // Check numSignUps <= the max number of users (i.e., number of state leaves
    // that can fit the state tree).
    var numSignUpsValid = LessEqThan(32)([numSignUps, STATE_TREE_ARITY ** stateTreeDepth]);
    numSignUpsValid === 1;

    // Hash each Message to check their existence in the Message tree.
    var computedMessageHashers[batchSize];
    var computedChainHashes[batchSize];
    var chainHash[batchSize + 1];
    chainHash[0] = inputBatchHash;
    for (var i = 0; i < batchSize; i++) {
        // calculate message hash
        computedMessageHashers[i] = MessageHasher()(msgs[i], encPubKeys[i]);
        // check if message is valid or not (if index of message is less than index of last valid message in batch)
        var batchStartIndexValid = SafeLessThan(32)([batchStartIndex + i, batchEndIndex]);
        // calculate chain hash if message is valid
        computedChainHashes[i] = PoseidonHasher(2)([chainHash[i], computedMessageHashers[i]]);
        // choose between old chain hash value and new chain hash value depending if message is valid or not
        chainHash[i + 1] = Mux1()([chainHash[i], computedChainHashes[i]], batchStartIndexValid);
    }

    // If batchEndIndex < batchStartIndex + i, the remaining
    // message hashes should be the zero value.
    // e.g. [m, z, z, z, z] if there is only 1 real message in the batch
    // This makes possible to have a batch of messages which is only partially full.

    chainHash[batchSize] === outputBatchHash;

    // Decrypt each Message to a Command.
    // MessageToCommand derives the ECDH shared key from the coordinator's
    // private key and the message's ephemeral public key. Next, it uses this
    // shared key to decrypt a Message to a Command.

    // Ensure that the coordinator's public key from the contract is correct
    // based on the given private key - that is, the prover knows the
    // coordinator's private key.
    var derivedPubKey[2] = PrivToPubKey()(coordPrivKey);
    derivedPubKey === coordPubKey;

    // Decrypt each Message into a Command.
    // The command i-th is composed by the following fields.
    // e.g., command 0 is made of commandsStateIndex[0], 
    // commandsNewPubKey[0], ..., commandsPackedCommandOut[0]
    var computedCommandsStateIndex[batchSize];
    var computedCommandsNewPubKey[batchSize][2];
    var computedCommandsVoteOptionIndex[batchSize];
    var computedCommandsNewVoteWeight[batchSize];
    var computedCommandsNonce[batchSize];
    var computedCommandsPollId[batchSize];
    var computedCommandsSalt[batchSize];
    var computedCommandsSigR8[batchSize][2];
    var computedCommandsSigS[batchSize];
    var computedCommandsPackedCommandOut[batchSize][PACKED_CMD_LENGTH];

    for (var i = 0; i < batchSize; i++) {
        var message[MSG_LENGTH];
        for (var j = 0; j < MSG_LENGTH; j++) {
            message[j] = msgs[i][j];
        }

        (
            computedCommandsStateIndex[i],
            computedCommandsNewPubKey[i],
            computedCommandsVoteOptionIndex[i],
            computedCommandsNewVoteWeight[i],
            computedCommandsNonce[i],
            computedCommandsPollId[i],
            computedCommandsSalt[i],
            computedCommandsSigR8[i],
            computedCommandsSigS[i],
            computedCommandsPackedCommandOut[i]
        ) = MessageToCommand()(message, coordPrivKey, encPubKeys[i]);
    }

    // Process messages in reverse order.
    // Assign current state and ballot roots.
    stateRoots[batchSize] <== currentStateRoot;
    ballotRoots[batchSize] <== currentBallotRoot;

    // Define vote type message processors.
    var computedNewVoteStateRoot[batchSize];
    var computedNewVoteBallotRoot[batchSize];

    // Start from batchSize and decrement for process in reverse order.
    for (var i = batchSize - 1; i >= 0; i--) {
        // Process as vote type message.
        var currentStateLeavesPathElement[stateTreeDepth][STATE_TREE_ARITY - 1];
        var currentBallotPathElement[stateTreeDepth][STATE_TREE_ARITY - 1];
        var currentVoteWeightsPathElement[voteOptionTreeDepth][VOTE_OPTION_TREE_ARITY - 1];
        
        for (var j = 0; j < stateTreeDepth; j++) {
            for (var k = 0; k < STATE_TREE_ARITY - 1; k++) {
                currentStateLeavesPathElement[j][k] = currentStateLeavesPathElements[i][j][k];
                currentBallotPathElement[j][k] = currentBallotsPathElements[i][j][k];
            }
        }

        for (var j = 0; j < voteOptionTreeDepth; j++) {
            for (var k = 0; k < VOTE_OPTION_TREE_ARITY - 1; k++) {
                currentVoteWeightsPathElement[j][k] = currentVoteWeightsPathElements[i][j][k];
            }
        }
        
        (computedNewVoteStateRoot[i], computedNewVoteBallotRoot[i]) = ProcessOne(stateTreeDepth, voteOptionTreeDepth)(
            numSignUps,
            maxVoteOptions,
            stateRoots[i + 1],
            ballotRoots[i + 1],
            actualStateTreeDepth,
            currentStateLeaves[i],
            currentStateLeavesPathElement,
            currentBallots[i],
            currentBallotPathElement,
            currentVoteWeights[i],
            currentVoteWeightsPathElement,
            computedCommandsStateIndex[i],
            computedCommandsNewPubKey[i],
            computedCommandsVoteOptionIndex[i],
            computedCommandsNewVoteWeight[i],
            computedCommandsNonce[i],
            computedCommandsPollId[i],
            computedCommandsSalt[i],
            computedCommandsSigR8[i],
            computedCommandsSigS[i],
            computedCommandsPackedCommandOut[i]
        );

        stateRoots[i] <== computedNewVoteStateRoot[i];
        ballotRoots[i] <== computedNewVoteBallotRoot[i];
    }

    var computedNewSbCommitment = PoseidonHasher(3)([stateRoots[0], ballotRoots[0], newSbSalt]);
    computedNewSbCommitment === newSbCommitment;
}

/**
 * Processes one message and updates the state accordingly. 
 * This template involves complex interactions, including transformations based on message type, 
 * validations against current states like voice credit balances or vote weights, 
 * and updates to Merkle trees representing state and ballot information. 
 * This is a critical building block for ensuring the integrity and correctness of MACI state.
 * This template supports the Quadratic Voting (QV).
 */
template ProcessOne(stateTreeDepth, voteOptionTreeDepth) {
    // Constants defining the structure and size of state and ballots.
    var STATE_LEAF_LENGTH = 4;
    var BALLOT_LENGTH = 2;
    var MSG_LENGTH = 10;
    var PACKED_CMD_LENGTH = 4;
    var VOTE_OPTION_TREE_ARITY = 5;
    var STATE_TREE_ARITY = 2;
    var BALLOT_NONCE_IDX = 0;
    // Ballot vote option (VO) root index.
    var BALLOT_VO_ROOT_IDX = 1;

    // Indices for elements within a state leaf.
    // Public key.
    var STATE_LEAF_PUB_X_IDX = 0;
    var STATE_LEAF_PUB_Y_IDX = 1;
    // Voice Credit balance.
    var STATE_LEAF_VOICE_CREDIT_BALANCE_IDX = 2;
    // Timestamp.
    var STATE_LEAF_TIMESTAMP_IDX = 3;
    var N_BITS = 252;

    // Inputs representing the message and the current state.
    signal input numSignUps;
    signal input maxVoteOptions;

    // The current value of the state tree root.
    signal input currentStateRoot;
    // The current value of the ballot tree root.
    signal input currentBallotRoot;
    // The actual tree depth (might be <= stateTreeDepth).
    signal input actualStateTreeDepth;

    // The state leaf and related path elements.
    signal input stateLeaf[STATE_LEAF_LENGTH];
    // Sibling nodes at each level of the state tree to verify the specific state leaf.
    signal input stateLeafPathElements[stateTreeDepth][STATE_TREE_ARITY - 1];

    // The ballot and related path elements.
    signal input ballot[BALLOT_LENGTH];
    signal input ballotPathElements[stateTreeDepth][STATE_TREE_ARITY - 1];

    // The current vote weight and related path elements.
    signal input currentVoteWeight;
    signal input currentVoteWeightsPathElements[voteOptionTreeDepth][VOTE_OPTION_TREE_ARITY - 1];

    // Inputs related to the command being processed.
    signal input cmdStateIndex;
    signal input cmdNewPubKey[2];
    signal input cmdVoteOptionIndex;
    signal input cmdNewVoteWeight;
    signal input cmdNonce;
    signal input cmdPollId;
    signal input cmdSalt;
    signal input cmdSigR8[2];
    signal input cmdSigS;
    signal input packedCmd[PACKED_CMD_LENGTH];

    signal output newStateRoot;
    signal output newBallotRoot;

    // Intermediate signals.
    // currentVoteWeight * currentVoteWeight.
    signal b;
    // cmdNewVoteWeight * cmdNewVoteWeight.
    signal c;
    // equal to newBallotVoRootMux (Mux1).
    signal newBallotVoRoot;

    // 1. Transform a state leaf and a ballot with a command.
    // The result is a new state leaf, a new ballot, and an isValid signal (0 or 1).
    var computedNewSlPubKey[2], computedNewBallotNonce, computedIsValid;
    (computedNewSlPubKey, computedNewBallotNonce, computedIsValid) = StateLeafAndBallotTransformer()(
        numSignUps,
        maxVoteOptions,
        [stateLeaf[STATE_LEAF_PUB_X_IDX], stateLeaf[STATE_LEAF_PUB_Y_IDX]],
        stateLeaf[STATE_LEAF_VOICE_CREDIT_BALANCE_IDX],
        // stateLeaf[STATE_LEAF_TIMESTAMP_IDX],
        ballot[BALLOT_NONCE_IDX],
        currentVoteWeight,
        cmdStateIndex,
        cmdNewPubKey,
        cmdVoteOptionIndex,
        cmdNewVoteWeight,
        cmdNonce,
        cmdPollId,
        cmdSalt,
        cmdSigR8,
        cmdSigS,
        packedCmd
    );

    // 2. If isValid is equal to zero, generate indices for leaf zero.
    // Otherwise, generate indices for command.stateIndex.
    var stateLeafIndexValid = SafeLessThan(N_BITS)([cmdStateIndex, numSignUps]);
    var stateIndexMux = Mux1()([0, cmdStateIndex], stateLeafIndexValid);
    var computedStateLeafPathIndices[stateTreeDepth] = MerkleGeneratePathIndices(stateTreeDepth)(stateIndexMux);

    // 3. Verify that the original state leaf exists in the given state root.
    var stateLeafHash = PoseidonHasher(4)(stateLeaf);
    var stateLeafQip = BinaryMerkleRoot(stateTreeDepth)(
        stateLeafHash,
        actualStateTreeDepth,
        computedStateLeafPathIndices,
        stateLeafPathElements
    );

    stateLeafQip === currentStateRoot;

    // 4. Verify that the original ballot exists in the given ballot root.
    var computedBallot = PoseidonHasher(2)([
        ballot[BALLOT_NONCE_IDX], 
        ballot[BALLOT_VO_ROOT_IDX]
    ]);

    var computedBallotQip = MerkleTreeInclusionProof(stateTreeDepth)(
        computedBallot,
        computedStateLeafPathIndices,
        ballotPathElements
    );

    computedBallotQip === currentBallotRoot;

    // 5. Verify that currentVoteWeight exists in the ballot's vote option root
    // at cmdVoteOptionIndex.
    b <== currentVoteWeight * currentVoteWeight;
    c <== cmdNewVoteWeight * cmdNewVoteWeight;

    var voiceCreditAmountValid = SafeGreaterEqThan(252)([
        stateLeaf[STATE_LEAF_VOICE_CREDIT_BALANCE_IDX] + b,
        c
    ]);

    var computedIsMessageEqual = IsEqual()([2, computedIsValid + voiceCreditAmountValid]);
    var voteOptionIndexValid = SafeLessThan(N_BITS)([cmdVoteOptionIndex, maxVoteOptions]);
    var cmdVoteOptionIndexMux = Mux1()([0, cmdVoteOptionIndex], voteOptionIndexValid);
    var computedCurrentVoteWeightPathIndices[voteOptionTreeDepth] = QuinGeneratePathIndices(voteOptionTreeDepth)(cmdVoteOptionIndexMux);

    var computedCurrentVoteWeightQip = QuinTreeInclusionProof(voteOptionTreeDepth)(
        currentVoteWeight,
        computedCurrentVoteWeightPathIndices,
        currentVoteWeightsPathElements
    );

    computedCurrentVoteWeightQip === ballot[BALLOT_VO_ROOT_IDX];

    var voteWeightMux = Mux1()([currentVoteWeight, cmdNewVoteWeight], computedIsMessageEqual);
    var newSlVoiceCreditBalanceMux = Mux1()(
        [
            stateLeaf[STATE_LEAF_VOICE_CREDIT_BALANCE_IDX],
            stateLeaf[STATE_LEAF_VOICE_CREDIT_BALANCE_IDX] + b - c
        ],
        voiceCreditAmountValid
    );
    var voiceCreditBalanceMux = Mux1()(
        [
            stateLeaf[STATE_LEAF_VOICE_CREDIT_BALANCE_IDX],
            newSlVoiceCreditBalanceMux
        ],
        computedIsMessageEqual
    );

    // 5.1. Update the ballot's vote option root with the new vote weight.
    var computedNewVoteOptionTreeQip = QuinTreeInclusionProof(voteOptionTreeDepth)(
        voteWeightMux,
        computedCurrentVoteWeightPathIndices,
        currentVoteWeightsPathElements
    );

    // The new vote option root in the ballot
    var newBallotVoRootMux = Mux1()(
        [ballot[BALLOT_VO_ROOT_IDX], computedNewVoteOptionTreeQip],
        computedIsMessageEqual
    );

    newBallotVoRoot <== newBallotVoRootMux;

    // 6. Generate a new state root.
    var computedNewStateLeafhash = PoseidonHasher(4)([
        computedNewSlPubKey[STATE_LEAF_PUB_X_IDX],
        computedNewSlPubKey[STATE_LEAF_PUB_Y_IDX],
        voiceCreditBalanceMux,
        stateLeaf[STATE_LEAF_TIMESTAMP_IDX]
    ]);

    var computedNewStateLeafQip = BinaryMerkleRoot(stateTreeDepth)(
        computedNewStateLeafhash,
        actualStateTreeDepth,
        computedStateLeafPathIndices,
        stateLeafPathElements
    );

    newStateRoot <== computedNewStateLeafQip;
 
    // 7. Generate a new ballot root.    
    var newBallotNonceMux = Mux1()([ballot[BALLOT_NONCE_IDX], computedNewBallotNonce], computedIsMessageEqual);
    var computedNewBallot = PoseidonHasher(2)([newBallotNonceMux, newBallotVoRoot]);
    var computedNewBallotQip = MerkleTreeInclusionProof(stateTreeDepth)(
        computedNewBallot,
        computedStateLeafPathIndices,
        ballotPathElements
    );

    newBallotRoot <== computedNewBallotQip;
}
