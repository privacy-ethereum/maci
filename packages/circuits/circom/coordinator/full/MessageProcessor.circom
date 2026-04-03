pragma circom 2.0.0;

// circomlib import
include "./mux1.circom";
// zk-kit imports
include "./safe-comparators.circom";
// local imports
include "../../utils/PoseidonHasher.circom";
include "../../utils/MessageHasher.circom";
include "../../utils/MessageToCommand.circom";
include "../../utils/PrivateToPublicKey.circom";
include "./SingleMessageProcessor.circom";

/**
 * Proves the correctness of processing a batch of MACI messages.
 * This template supports fully spent voice credits mode.
 */
 template MessageProcessorFull(
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
    // Default for Binary trees.
    var STATE_TREE_ARITY = 2;
    var MESSAGE_LENGTH = 10;
    var PACKED_COMMAND_LENGTH = 4;
    var STATE_LEAF_LENGTH = 3;
    var BALLOT_LENGTH = 2;

    // Number of users that have completed the sign up.
    signal input totalSignups;
    // Value of chainHash at beginning of batch
    signal input inputBatchHash;
    // Value of chainHash at end of batch
    signal input outputBatchHash;
    // The messages.
    signal input messages[batchSize][MESSAGE_LENGTH];
    // The coordinator's private key.
    signal input coordinatorPrivateKey;
    // The ECDH public key per message.
    signal input encryptionPublicKeys[batchSize][2];
    // The current state root (before the processing).
    signal input currentStateRoot;
    // The actual tree depth (might be <= stateTreeDepth).
    // @note it is a public input to ensure fair processing from
    // the coordinator (no censoring)
    signal input actualStateTreeDepth;
    // The coordinator public key hash
    signal input coordinatorPublicKeyHash;
    // The number of valid vote options for the poll.
    signal input voteOptions;

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
    signal input index;

    // The index of the last message in the batch to process, exclusive.
    // This value may be less than index + batchSize if this batch is
    // the last batch and the total number of messages is not a multiple of the batch size.
    signal input batchEndIndex;

    // The history of state and ballot roots and temporary intermediate
    // signals (for processing purposes).
    signal stateRoots[batchSize + 1];
    signal ballotRoots[batchSize + 1];

    // Must verify the current sb commitment.
    var computedCurrentSbCommitment = PoseidonHasher(3)([currentStateRoot, currentBallotRoot, currentSbSalt]);
    computedCurrentSbCommitment === currentSbCommitment;

    //  -----------------------------------------------------------------------
    // 0. Ensure that the maximum vote options signal is valid and if
    // the maximum users signal is valid
    var voteOptionsValid = LessEqThan(32)([voteOptions, VOTE_OPTION_TREE_ARITY ** voteOptionTreeDepth]);
    voteOptionsValid === 1;

    // Check totalSignups <= the max number of users (i.e., number of state leaves
    // that can fit the state tree).
    var totalSignupsValid = LessEqThan(32)([totalSignups, STATE_TREE_ARITY ** stateTreeDepth]);
    totalSignupsValid === 1;

    // Hash each Message to check their existence in the Message chain hash.
    var computedMessageHashers[batchSize];
    var computedChainHashes[batchSize];
    var chainHash[batchSize + 1];
    chainHash[0] = inputBatchHash;

    for (var i = 0; i < batchSize; i++) {
        // calculate message hash
        computedMessageHashers[i] = MessageHasher()(messages[i], encryptionPublicKeys[i]);
        // check if message is valid or not (if index of message is less than index of last valid message in batch)
        var batchStartIndexValid = SafeLessThan(32)([index + i, batchEndIndex]);
        // calculate chain hash if message is valid
        computedChainHashes[i] = PoseidonHasher(2)([chainHash[i], computedMessageHashers[i]]);
        // choose between old chain hash value and new chain hash value depending if message is valid or not
        chainHash[i + 1] = Mux1()([chainHash[i], computedChainHashes[i]], batchStartIndexValid);
    }

    // If batchEndIndex < index + i, the remaining
    // message hashes should be the zero value.
    // e.g. [m, z, z, z, z] if there is only 1 real message in the batch
    // This makes possible to have a batch of messages which is only partially full.

    // Ensure that right output batch hash was sent to circuit
    chainHash[batchSize] === outputBatchHash;

    // Decrypt each Message to a Command.
    // MessageToCommand derives the ECDH shared key from the coordinator's
    // private key and the message's ephemeral public key. Next, it uses this
    // shared key to decrypt a Message to a Command.

    // Ensure that the coordinator's public key from the contract is correct
    // based on the given private key - that is, the prover knows the
    // coordinator's private key.
    var derivedPublicKey[2] = PrivateToPublicKey()(coordinatorPrivateKey);
    var derivedPublicKeyHash = PoseidonHasher(2)(derivedPublicKey);
    derivedPublicKeyHash === coordinatorPublicKeyHash;

    // Decrypt each Message into a Command.
    // The command i-th is composed by the following fields.
    // e.g., command 0 is made of commandsStateIndex[0],
    // commandsNewPublicKey[0], ..., commandsPackedCommandOut[0]
    var computedCommandsStateIndex[batchSize];
    var computedCommandsNewPublicKey[batchSize][2];
    var computedCommandsVoteOptionIndex[batchSize];
    var computedCommandsNewVoteWeight[batchSize];
    var computedCommandsNonce[batchSize];
    var computedCommandsPollId[batchSize];
    var computedCommandsSalt[batchSize];
    var computedCommandsSignaturePoint[batchSize][2];
    var computedCommandsSignatureScalar[batchSize];
    var computedCommandsPackedCommandOut[batchSize][PACKED_COMMAND_LENGTH];

    for (var i = 0; i < batchSize; i++) {
        (
            computedCommandsStateIndex[i],
            computedCommandsNewPublicKey[i],
            computedCommandsVoteOptionIndex[i],
            computedCommandsNewVoteWeight[i],
            computedCommandsNonce[i],
            computedCommandsPollId[i],
            computedCommandsSalt[i],
            computedCommandsSignaturePoint[i],
            computedCommandsSignatureScalar[i],
            computedCommandsPackedCommandOut[i]
        ) = MessageToCommand()(messages[i], coordinatorPrivateKey, encryptionPublicKeys[i]);
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
        var computedCurrentStateLeavesPathElements[stateTreeDepth][STATE_TREE_ARITY - 1];
        var computedCurrentBallotPathElements[stateTreeDepth][STATE_TREE_ARITY - 1];
        var computedCurrentVoteWeightsPathElements[voteOptionTreeDepth][VOTE_OPTION_TREE_ARITY - 1];

        for (var j = 0; j < stateTreeDepth; j++) {
            for (var k = 0; k < STATE_TREE_ARITY - 1; k++) {
                computedCurrentStateLeavesPathElements[j][k] = currentStateLeavesPathElements[i][j][k];
                computedCurrentBallotPathElements[j][k] = currentBallotsPathElements[i][j][k];
            }
        }

        for (var j = 0; j < voteOptionTreeDepth; j++) {
            for (var k = 0; k < VOTE_OPTION_TREE_ARITY - 1; k++) {
                computedCurrentVoteWeightsPathElements[j][k] = currentVoteWeightsPathElements[i][j][k];
            }
        }

        (computedNewVoteStateRoot[i], computedNewVoteBallotRoot[i]) = SingleMessageProcessorFull(stateTreeDepth, voteOptionTreeDepth)(
            totalSignups,
            stateRoots[i + 1],
            ballotRoots[i + 1],
            actualStateTreeDepth,
            currentStateLeaves[i],
            computedCurrentStateLeavesPathElements,
            currentBallots[i],
            computedCurrentBallotPathElements,
            currentVoteWeights[i],
            computedCurrentVoteWeightsPathElements,
            computedCommandsStateIndex[i],
            computedCommandsNewPublicKey[i],
            computedCommandsVoteOptionIndex[i],
            computedCommandsNewVoteWeight[i],
            computedCommandsNonce[i],
            computedCommandsPollId[i],
            computedCommandsSalt[i],
            computedCommandsSignaturePoint[i],
            computedCommandsSignatureScalar[i],
            computedCommandsPackedCommandOut[i],
            voteOptions
        );

        stateRoots[i] <== computedNewVoteStateRoot[i];
        ballotRoots[i] <== computedNewVoteBallotRoot[i];
    }

    var computedNewSbCommitment = PoseidonHasher(3)([stateRoots[0], ballotRoots[0], newSbSalt]);

    computedNewSbCommitment === newSbCommitment;
}
