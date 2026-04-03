pragma circom 2.0.0;

// circomlib import
include "./mux1.circom";
// local import
include "./MessageValidator.circom";

/**
 * Processes a command by verifying its validity and updates the state leaf and ballot accordingly. 
 * If the message is correct, updates the public key in the state leaf and the nonce 
 * in the ballot using multiplexer components.
 * This template supports the full mode (all credits are spent on one option)
 */
template StateLeafAndBallotTransformerFull() {
    // Length of the packed command.
    var PACKED_COMMAND_LENGTH = 4;

    // Number of user sign-ups in the state tree.
    signal input totalSignups;
    // Number of valid vote options for the poll.
    signal input voteOptions;

    // The following signals represents a state leaf (signed up user).
    // Public key.
    signal input stateLeafPublicKey[2];
    // Current voice credit balance.
    signal input stateLeafVoiceCreditBalance;

    // The following signals represents a ballot.
    // Nonce.
    signal input ballotNonce;
    // Current number of votes for specific option. 
    signal input ballotCurrentVotesForOption;

    // The following signals represents a command.
    // State index of the user.
    signal input commandStateIndex;
    // Public key of the user.
    signal input commandPublicKey[2];
    // Vote option index.
    signal input commandVoteOptionIndex;
    // Vote weight.
    signal input commandNewVoteWeight;
    // Nonce.
    signal input commandNonce;
    // Poll identifier.
    signal input commandPollId;
    // Salt.
    signal input commandSalt;
    // EdDSA signature of the command (R part).
    signal input commandSignaturePoint[2];
    // EdDSA signature of the command (S part).
    signal input commandSignatureScalar;
    // Packed command. 
    // nb. we are assuming that the packedCommand is always valid.
    signal input packedCommand[PACKED_COMMAND_LENGTH];

    // New state leaf (if the command is valid).
    signal output newStateLeafPublicKey[2];
    // New ballot (if the command is valid).
    signal output newBallotNonce;
    
    // True when the command is valid; otherwise false.
    signal output isValid;
    // True if the state leaf index is valid
    signal output isStateLeafIndexValid;
    // True if the vote option index is valid
    signal output isVoteOptionIndexValid;

    // Check if the command / message is valid.
    var (
        computedIsValid,
        computedIsStateLeafIndexValid,
        computedIsVoteOptionIndexValid
    ) = MessageValidatorFull()(
        commandStateIndex,
        totalSignups,
        commandVoteOptionIndex,
        voteOptions,
        ballotNonce,
        commandNonce,
        packedCommand,
        stateLeafPublicKey,
        commandSignaturePoint,
        commandSignatureScalar,
        stateLeafVoiceCreditBalance,
        ballotCurrentVotesForOption,
        commandNewVoteWeight
    );

    // If the message is valid then we swap out the public key.
    // This means using a Mux1() for publicKey[0] and another one
    // for publicKey[1].
    var computedNewstateLeafPublicKey0Mux = Mux1()(
        [
            stateLeafPublicKey[0],
            commandPublicKey[0]
        ],
        computedIsValid
    );

    var computedNewstateLeafPublicKey1Mux = Mux1()(
        [
            stateLeafPublicKey[1],
            commandPublicKey[1]
        ],
        computedIsValid
    );

    newStateLeafPublicKey[0] <== computedNewstateLeafPublicKey0Mux;
    newStateLeafPublicKey[1] <== computedNewstateLeafPublicKey1Mux;

    // If the message is valid, then we swap out the ballot nonce
    // using a Mux1().
    var computedNewBallotNonceMux = Mux1()([ballotNonce, commandNonce], computedIsValid);

    newBallotNonce <== computedNewBallotNonceMux;

    isValid <== computedIsValid;
    isStateLeafIndexValid <== computedIsStateLeafIndexValid;
    isVoteOptionIndexValid <== computedIsVoteOptionIndexValid;

    // Constrain commandPollId and commandSalt using dummy squares.
    // This binds the proof to a specific poll and salt.
    signal commandPollIdSquare <== commandPollId * commandPollId;
    signal commandSaltSquared <== commandSalt * commandSalt;
}
