import { EMode, MaciState, type Poll } from "@maci-protocol/core";
import { poseidon } from "@maci-protocol/crypto";
import { Keypair, VoteCommand, type Message } from "@maci-protocol/domainobjs";
import { type WitnessTester } from "circomkit";

import { type IVoteTallyInputs } from "../types";

import { STATE_TREE_DEPTH, duration, maxVoteOptions, messageBatchSize, voiceCreditBalance } from "./utils/constants";
import { generateRandomIndex, circomkitInstance } from "./utils/utils";

describe("VoteTally circuit", function test() {
  this.timeout(900000);

  const treeDepths = {
    tallyProcessingStateTreeDepth: 1,
    voteOptionTreeDepth: 2,
    stateTreeDepth: 10,
  };

  const coordinatorKeypair = new Keypair();

  type TallyVotesCircuitInputs = [
    "stateRoot",
    "ballotRoot",
    "sbSalt",
    "index",
    "totalSignups",
    "sbCommitment",
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
  ];

  let circuit: WitnessTester<TallyVotesCircuitInputs>;

  let circuitNonQv: WitnessTester<TallyVotesCircuitInputs>;

  const userKeypair = new Keypair();
  const { privateKey, publicKey: pollPublicKey } = userKeypair;

  before(async () => {
    circuit = await circomkitInstance.WitnessTester("VoteTally", {
      file: "./coordinator/qv/VoteTally",
      template: "VoteTallyQv",
      params: [10, 1, 2],
    });

    circuitNonQv = await circomkitInstance.WitnessTester("VoteTallyNonQv", {
      file: "./coordinator/non-qv/VoteTally",
      template: "VoteTallyNonQv",
      params: [10, 1, 2],
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
      maciState = new MaciState(STATE_TREE_DEPTH);
      const messages: Message[] = [];
      const commands: VoteCommand[] = [];
      // Sign up and publish
      maciState.signUp(userKeypair.publicKey);

      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      poll = maciState.polls.get(pollId)!;
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      const nullifier = poseidon([BigInt(privateKey.raw.toString()), pollId]);

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

      const signature = command.sign(privateKey);

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
      const witness = await circuit.calculateWitness(generatedInputs);
      await circuit.expectConstraintPass(witness);
    });

    it("should produce the correct result if the initial tally is not zero", async () => {
      const generatedInputs = poll.tallyVotes() as unknown as IVoteTallyInputs;

      // Start the tally from non-zero value
      let randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
      while (randIdx === 0) {
        randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
      }

      generatedInputs.currentResults[randIdx] = 1n;
      const witness = await circuit.calculateWitness(generatedInputs);
      await circuit.expectConstraintPass(witness);
    });
  });

  describe("1 user, 2 messages (non quadratic-voting)", () => {
    let stateIndex: bigint;
    let pollId: bigint;
    let poll: Poll;
    let maciState: MaciState;
    const voteWeight = BigInt(9);
    const voteOptionIndex = BigInt(0);

    beforeEach(() => {
      maciState = new MaciState(STATE_TREE_DEPTH);
      const messages: Message[] = [];
      const commands: VoteCommand[] = [];
      // Sign up and publish
      maciState.signUp(userKeypair.publicKey);

      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.NON_QV,
      );

      poll = maciState.polls.get(pollId)!;
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      const nullifier = poseidon([BigInt(privateKey.raw.toString()), pollId]);

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

      const signature = command.sign(privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);
      messages.push(message);
      commands.push(command);

      poll.publishMessage(message, ecdhKeypair.publicKey);

      // Process messages
      poll.processMessages(pollId, false);
    });

    it("should produce the correct result commitments", async () => {
      const generatedInputs = poll.tallyVotes() as unknown as IVoteTallyInputs;

      const witness = await circuitNonQv.calculateWitness(generatedInputs);
      await circuitNonQv.expectConstraintPass(witness);
    });

    it("should produce the correct result if the initial tally is not zero", async () => {
      const generatedInputs = poll.tallyVotes() as unknown as IVoteTallyInputs;

      // Start the tally from non-zero value
      let randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
      while (randIdx === 0) {
        randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
      }

      generatedInputs.currentResults[randIdx] = 1n;
      const witness = await circuitNonQv.calculateWitness(generatedInputs);
      await circuitNonQv.expectConstraintPass(witness);
    });
  });

  const NUM_BATCHES = 2;
  const x = messageBatchSize * NUM_BATCHES;

  describe(`${x} users, ${x} messages`, () => {
    it("should produce the correct state root and ballot root", async () => {
      const maciState = new MaciState(STATE_TREE_DEPTH);
      const userKeypairs: Keypair[] = [];

      // Sign up
      for (let i = 0; i < x; i += 1) {
        const keypair = new Keypair();
        userKeypairs.push(keypair);
        maciState.signUp(keypair.publicKey);
      }

      // Deploy poll
      const pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      const poll = maciState.polls.get(pollId)!;
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      userKeypairs.forEach((user) => {
        const { privateKey: userPrivate } = user;

        const nullifier = poseidon([BigInt(userPrivate.raw.toString())]);

        poll.joinPoll(nullifier, user.publicKey, voiceCreditBalance);
      });

      // Commands
      const numMessages = messageBatchSize * NUM_BATCHES;
      for (let i = 0; i < numMessages; i += 1) {
        const command = new VoteCommand(
          BigInt(i),
          userKeypairs[i].publicKey,
          BigInt(i), // vote option index
          BigInt(1), // vote weight
          BigInt(1), // nonce
          BigInt(pollId),
        );

        const signature = command.sign(userKeypairs[i].privateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.publicKey);
      }

      for (let i = 0; i < NUM_BATCHES; i += 1) {
        poll.processMessages(pollId);
      }

      for (let i = 0; i < NUM_BATCHES; i += 1) {
        const generatedInputs = poll.tallyVotes() as unknown as IVoteTallyInputs;

        // For the 0th batch, the circuit should ignore currentResults,
        // currentSpentVoiceCreditSubtotal, and
        // currentPerVoteOptionSpentVoiceCredits
        if (i === 0) {
          generatedInputs.currentResults[0] = 123n;
          generatedInputs.currentSpentVoiceCreditSubtotal = 456n;
          generatedInputs.currentPerVoteOptionSpentVoiceCredits[0] = 789n;
        }

        // eslint-disable-next-line no-await-in-loop
        const witness = await circuit.calculateWitness(generatedInputs);
        // eslint-disable-next-line no-await-in-loop
        await circuit.expectConstraintPass(witness);
      }
    });
  });
});
