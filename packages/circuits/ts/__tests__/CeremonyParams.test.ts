import { MaciState, type Poll, STATE_TREE_ARITY, MESSAGE_BATCH_SIZE, EMode } from "@maci-protocol/core";
import { hash5, IncrementalQuinTree, poseidon } from "@maci-protocol/crypto";
import { PrivateKey, Keypair, VoteCommand, type Message, Ballot } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type WitnessTester } from "circomkit";

import { type IProcessMessagesInputs, type IVoteTallyInputs } from "../types";

import { maxVoteOptions } from "./utils/constants";
import { generateRandomIndex, circomkitInstance } from "./utils/utils";

describe("Ceremony param tests", () => {
  const params = {
    // MessageProcessor and VoteTally
    stateTreeDepth: 14,
    // MessageProcessor and VoteTally
    voteOptionTreeDepth: 3,
    // Tally
    stateLeafBatchDepth: 2,
  };

  const treeDepths = {
    tallyProcessingStateTreeDepth: 1,
    voteOptionTreeDepth: params.voteOptionTreeDepth,
    stateTreeDepth: params.stateTreeDepth,
  };

  const voiceCreditBalance = BigInt(100);
  const duration = 30;

  const coordinatorKeypair = new Keypair();

  describe("ProcessMessage circuit", function test() {
    this.timeout(900000);

    let circuit: WitnessTester<
      [
        "totalSignups",
        "batchEndIndex",
        "index",
        "inputBatchHash",
        "outputBatchHash",
        "messages",
        "coordinatorPrivateKey",
        "coordinatorPublicKeyHash",
        "encryptionPublicKeys",
        "currentStateRoot",
        "currentStateLeaves",
        "currentStateLeavesPathElements",
        "currentSbCommitment",
        "currentSbSalt",
        "newSbCommitment",
        "newSbSalt",
        "currentBallotRoot",
        "currentBallots",
        "currentBallotsPathElements",
        "currentVoteWeights",
        "currentVoteWeightsPathElements",
        "voteOptions",
      ]
    >;

    before(async () => {
      circuit = await circomkitInstance.WitnessTester("MessageProcessor", {
        file: "./coordinator/qv/MessageProcessor",
        template: "MessageProcessorQv",
        params: [params.stateTreeDepth, MESSAGE_BATCH_SIZE, params.voteOptionTreeDepth],
      });
    });

    describe("1 user, 2 messages", () => {
      const maciState = new MaciState(params.stateTreeDepth);
      const voteWeight = BigInt(9);
      const voteOptionIndex = BigInt(0);
      let stateIndex: bigint;
      let pollId: bigint;
      let poll: Poll;
      const messages: Message[] = [];
      const commands: VoteCommand[] = [];

      before(() => {
        // Sign up and publish
        const userKeypair = new Keypair(new PrivateKey(BigInt(1)));
        maciState.signUp(userKeypair.publicKey);

        pollId = maciState.deployPoll(
          BigInt(Math.floor(Date.now() / 1000) + duration),
          treeDepths,
          MESSAGE_BATCH_SIZE,
          coordinatorKeypair,
          maxVoteOptions,
          EMode.QV,
        );

        poll = maciState.polls.get(pollId)!;

        // update the state
        poll.updatePoll(BigInt(maciState.publicKeys.length));

        // Join the poll
        const { privateKey } = userKeypair;
        const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

        const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

        stateIndex = BigInt(poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance));

        // First command (valid)
        const command = new VoteCommand(
          stateIndex, // BigInt(1),
          pollPublicKey,
          voteOptionIndex, // voteOptionIndex,
          voteWeight, // vote weight
          BigInt(2), // nonce
          BigInt(pollId),
        );

        const signature = command.sign(pollPrivateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
        const message = command.encrypt(signature, sharedKey);
        messages.push(message);
        commands.push(command);

        poll.publishMessage(message, ecdhKeypair.publicKey);

        // Second command (valid)
        const command2 = new VoteCommand(
          stateIndex,
          userKeypair.publicKey,
          voteOptionIndex, // voteOptionIndex,
          BigInt(1), // vote weight
          BigInt(1), // nonce
          BigInt(pollId),
        );
        const signature2 = command2.sign(pollPrivateKey);

        const ecdhKeypair2 = new Keypair();
        const sharedKey2 = Keypair.generateEcdhSharedKey(ecdhKeypair2.privateKey, coordinatorKeypair.publicKey);
        const message2 = command2.encrypt(signature2, sharedKey2);
        messages.push(message2);
        commands.push(command2);
        poll.publishMessage(message2, ecdhKeypair2.publicKey);
      });

      it("should produce the correct state root and ballot root", async () => {
        // The current roots
        const emptyBallot = new Ballot(poll.maxVoteOptions, poll.treeDepths.voteOptionTreeDepth);
        const emptyBallotHash = emptyBallot.hash();
        const ballotTree = new IncrementalQuinTree(params.stateTreeDepth, emptyBallot.hash(), STATE_TREE_ARITY, hash5);
        ballotTree.insert(emptyBallot.hash());

        poll.pollStateLeaves.forEach(() => {
          ballotTree.insert(emptyBallotHash);
        });

        const currentStateRoot = poll.pollStateTree?.root;
        const currentBallotRoot = ballotTree.root;

        const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;

        // Calculate the witness
        const witness = await circuit.calculateWitness(inputs);
        await circuit.expectConstraintPass(witness);

        // The new roots, which should differ, since at least one of the
        // messages modified a Ballot or State Leaf
        const newStateRoot = poll.pollStateTree?.root;
        const newBallotRoot = poll.ballotTree?.root;

        expect(newStateRoot?.toString()).not.to.be.eq(currentStateRoot?.toString());
        expect(newBallotRoot?.toString()).not.to.be.eq(currentBallotRoot.toString());
      });
    });
  });

  describe("VoteTally circuit", function test() {
    this.timeout(900000);

    let testCircuit: WitnessTester<
      [
        "stateRoot",
        "ballotRoot",
        "sbSalt",
        "sbCommitment",
        "index",
        "totalSignups",
        "currentTallyCommitment",
        "newTallyCommitment",
        "ballots",
        "ballotPathElements",
        "votes",
        "currentResults",
        "currentResultsRootSalt",
        "currentSpentVoiceCreditSubtotal",
        "currentSpentVoiceCreditSubtotalSalt",
        "currentPerVoteOptionSpentVoiceCredits",
        "currentPerVoteOptionSpentVoiceCreditsRootSalt",
        "newResultsRootSalt",
        "newPerVoteOptionSpentVoiceCreditsRootSalt",
        "newSpentVoiceCreditSubtotalSalt",
      ]
    >;

    before(async () => {
      testCircuit = await circomkitInstance.WitnessTester("VoteTally", {
        file: "./coordinator/qv/VoteTally",
        template: "VoteTallyQv",
        params: [14, 1, 3],
      });
    });

    describe("1 user, 2 messages", () => {
      let stateIndex: bigint;
      let pollId: bigint;
      let poll: Poll;
      let maciState: MaciState;
      const voteWeight = BigInt(9);
      const voteOptionIndex = BigInt(0);

      beforeEach(() => {
        maciState = new MaciState(params.stateTreeDepth);
        const messages: Message[] = [];
        const commands: VoteCommand[] = [];
        // Sign up and publish
        const userKeypair = new Keypair();
        maciState.signUp(userKeypair.publicKey);

        pollId = maciState.deployPoll(
          BigInt(Math.floor(Date.now() / 1000) + duration),
          treeDepths,
          MESSAGE_BATCH_SIZE,
          coordinatorKeypair,
          maxVoteOptions,
          EMode.QV,
        );

        poll = maciState.polls.get(pollId)!;

        // update the state
        poll.updatePoll(BigInt(maciState.publicKeys.length));

        // Join the poll
        const { privateKey } = userKeypair;
        const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

        const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

        stateIndex = BigInt(poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance));

        // First command (valid)
        const command = new VoteCommand(
          stateIndex,
          pollPublicKey,
          voteOptionIndex, // voteOptionIndex,
          voteWeight, // vote weight
          BigInt(1), // nonce
          BigInt(pollId),
        );

        const signature = command.sign(pollPrivateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
        const message = command.encrypt(signature, sharedKey);
        messages.push(message);
        commands.push(command);

        poll.publishMessage(message, ecdhKeypair.publicKey);

        // Process messages
        poll.processMessages(pollId);
      });

      it("should produce the correct result commitments", async () => {
        const generatedInputs = poll.tallyVotes() as unknown as IVoteTallyInputs;
        const witness = await testCircuit.calculateWitness(generatedInputs);
        await testCircuit.expectConstraintPass(witness);
      });

      it("should produce the correct result if the initial tally is not zero", async () => {
        const generatedInputs = poll.tallyVotes() as unknown as IVoteTallyInputs;

        // Start the tally from non-zero value
        let randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
        while (randIdx === 0) {
          randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
        }

        generatedInputs.currentResults[randIdx] = 1n;

        const witness = await testCircuit.calculateWitness(generatedInputs);
        await testCircuit.expectConstraintPass(witness);
      });
    });
  });
});
