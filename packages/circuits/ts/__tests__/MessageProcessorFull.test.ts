import { MaciState, type Poll, STATE_TREE_ARITY, EMode } from "@maci-protocol/core";
import { IncrementalQuinTree, hash2, poseidon } from "@maci-protocol/crypto";
import { PrivateKey, Keypair, VoteCommand, Message, Ballot, PublicKey } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type WitnessTester } from "circomkit";

import fs from "fs";

import { type IProcessMessagesInputs } from "../types";

import {
  STATE_TREE_DEPTH,
  duration,
  maxVoteOptions,
  messageBatchSize,
  treeDepths,
  voiceCreditBalance,
} from "./utils/constants";
import { circomkitInstance } from "./utils/utils";

describe("MessageProcessorFull circuit", function test() {
  this.timeout(9000000);

  const coordinatorKeypair = new Keypair();

  type ProcessMessageCircuitInputs = [
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
  ];

  let circuit: WitnessTester<ProcessMessageCircuitInputs>;

  const nothing = new Message([
    8370432830353022751713833565135785980866757267633941821328460903436894336785n,
    0n,
    0n,
    0n,
    0n,
    0n,
    0n,
    0n,
    0n,
    0n,
  ]);

  const encryptionPublic = new PublicKey([
    10457101036533406547632367118273992217979173478358440826365724437999023779287n,
    19824078218392094440610104313265183977899662750282163392862422243483260492317n,
  ]);

  before(async () => {
    circuit = await circomkitInstance.WitnessTester("MessageProcessorFull", {
      file: "./coordinator/full/MessageProcessor",
      template: "MessageProcessorFull",
      params: [10, 20, 2],
    });
  });

  describe("1) 5 users, 1 messages", () => {
    let pollId: bigint;
    let poll: Poll;

    const maciState = new MaciState(STATE_TREE_DEPTH);
    const voteOptionIndex = 1n;

    before(() => {
      // Sign up and publish
      const users = new Array(5).fill(0).map(() => new Keypair());

      users.forEach((userKeypair) => {
        maciState.signUp(userKeypair.publicKey);
      });

      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      users.forEach((user) => {
        const { privateKey } = user;
        const { publicKey: pollPublicKey } = user;

        const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

        poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);
      });

      poll.publishMessage(nothing, encryptionPublic);

      // First command (valid)
      const command = new VoteCommand(
        5n,
        users[4].publicKey,
        voteOptionIndex, // voteOptionIndex,
        voiceCreditBalance, // vote weight
        2n, // nonce
        BigInt(pollId),
      );

      const signature = command.sign(users[4].privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);
    });

    it("should produce a proof", async () => {
      const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;

      fs.writeFileSync("inputs.json", JSON.stringify(inputs, null, 2));

      // Calculate the witness
      const witness = await circuit.calculateWitness(inputs);
      await circuit.expectConstraintPass(witness);
    });
  });

  describe("2) 2 users, 1 message", () => {
    const maciState = new MaciState(STATE_TREE_DEPTH);
    let pollId: bigint;
    let poll: Poll;
    const messages: Message[] = [];
    const commands: VoteCommand[] = [];

    before(() => {
      // Sign up and publish
      const userKeypair = new Keypair(new PrivateKey(BigInt(123)));
      const userKeypair2 = new Keypair(new PrivateKey(BigInt(456)));

      maciState.signUp(userKeypair.publicKey);
      maciState.signUp(userKeypair2.publicKey);

      pollId = maciState.deployPoll(
        BigInt(2 + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;

      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      const { privateKey, publicKey: pollPublicKey } = userKeypair;

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      const stateIndex = BigInt(poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance));

      const command = new VoteCommand(
        stateIndex,
        pollPublicKey,
        0n, // voteOptionIndex,
        voiceCreditBalance, // vote weight
        1n, // nonce
        BigInt(pollId),
      );

      const signature = command.sign(privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);
      messages.push(message);
      commands.push(command);

      poll.publishMessage(message, ecdhKeypair.publicKey);
    });

    it("should produce the correct state root and ballot root", async () => {
      // The current roots
      const emptyBallot = new Ballot(poll.maxVoteOptions, poll.treeDepths.voteOptionTreeDepth);
      const emptyBallotHash = emptyBallot.hash();
      const ballotTree = new IncrementalQuinTree(STATE_TREE_DEPTH, emptyBallot.hash(), STATE_TREE_ARITY, hash2);

      ballotTree.insert(emptyBallot.hash());

      poll.publicKeys.forEach(() => {
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

  describe("3) 1 user, key-change", () => {
    let pollId: bigint;
    let poll: Poll;

    const maciState = new MaciState(STATE_TREE_DEPTH);

    before(() => {
      // Sign up and publish
      const userKeypair = new Keypair(new PrivateKey(BigInt(123)));

      maciState.signUp(userKeypair.publicKey);

      pollId = maciState.deployPoll(
        BigInt(2 + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;

      poll.updatePoll(BigInt(maciState.publicKeys.length));

      const { privateKey, publicKey: pollPublicKey } = userKeypair;

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      const stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

      // Vote for option 0
      const command = new VoteCommand(
        BigInt(stateIndex), // BigInt(1),
        pollPublicKey,
        0n, // voteOptionIndex,
        voiceCreditBalance, // vote weight
        1n, // nonce
        BigInt(pollId),
      );

      const signature = command.sign(privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);

      // Vote for option 1
      const command2 = new VoteCommand(
        BigInt(stateIndex),
        pollPublicKey,
        1n, // voteOptionIndex,
        voiceCreditBalance, // vote weight
        2n, // nonce
        BigInt(pollId),
      );
      const signature2 = command2.sign(privateKey);

      const ecdhKeypair2 = new Keypair();
      const sharedKey2 = Keypair.generateEcdhSharedKey(ecdhKeypair2.privateKey, coordinatorKeypair.publicKey);
      const message2 = command2.encrypt(signature2, sharedKey2);
      poll.publishMessage(message2, ecdhKeypair2.publicKey);

      // Change key
      const command3 = new VoteCommand(
        BigInt(stateIndex),
        pollPublicKey,
        1n, // voteOptionIndex,
        0n, // vote weight
        1n, // nonce
        BigInt(pollId),
      );

      const signature3 = command3.sign(privateKey);

      const ecdhKeypair3 = new Keypair();
      const sharedKey3 = Keypair.generateEcdhSharedKey(ecdhKeypair3.privateKey, coordinatorKeypair.publicKey);
      const message3 = command3.encrypt(signature3, sharedKey3);
      poll.publishMessage(message3, ecdhKeypair3.publicKey);
    });

    it("should produce the correct state root and ballot root", async () => {
      const currentStateRoot = poll.pollStateTree?.root;
      const currentBallotRoot = poll.ballotTree?.root;

      const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;
      // Calculate the witness
      const witness = await circuit.calculateWitness(inputs);
      await circuit.expectConstraintPass(witness);

      // The new roots, which should differ, since at least one of the
      // messages modified a Ballot or State Leaf
      const newStateRoot = poll.pollStateTree?.root;
      const newBallotRoot = poll.ballotTree?.root;

      expect(newStateRoot!.toString()).not.to.be.eq(currentStateRoot!.toString());
      expect(newBallotRoot!.toString()).not.to.be.eq(currentBallotRoot!.toString());
    });
  });

  const NUM_BATCHES = 2;
  describe(`4) 1 user, ${messageBatchSize * NUM_BATCHES - 1} messages`, () => {
    let stateIndex: number;
    let pollId: bigint;
    let poll: Poll;

    const maciState = new MaciState(STATE_TREE_DEPTH);

    before(() => {
      const userKeypair = new Keypair(new PrivateKey(BigInt(1)));
      maciState.signUp(userKeypair.publicKey);

      // Sign up and publish
      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;

      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      const { privateKey, publicKey: pollPublicKey } = userKeypair;

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

      // Second batch is not a full batch
      const numMessages = messageBatchSize * NUM_BATCHES - 1;
      for (let i = 0; i < numMessages; i += 1) {
        const command = new VoteCommand(
          BigInt(stateIndex),
          pollPublicKey,
          BigInt(i), // vote option index
          voiceCreditBalance, // vote weight
          BigInt(numMessages - i), // nonce
          BigInt(pollId),
        );

        const signature = command.sign(privateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.publicKey);
      }
    });

    it("should produce a proof", async () => {
      for (let i = 0; i < NUM_BATCHES; i += 1) {
        const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;
        // eslint-disable-next-line no-await-in-loop
        const witness = await circuit.calculateWitness(inputs);
        // eslint-disable-next-line no-await-in-loop
        await circuit.expectConstraintPass(witness);
      }
    });
  });

  describe("5) 1 user, 2 messages", () => {
    const maciState = new MaciState(STATE_TREE_DEPTH);
    const voteOptionIndex = 1n;
    let stateIndex: bigint;
    let pollId: bigint;
    let poll: Poll;

    before(() => {
      // Sign up and publish
      const userKeypair = new Keypair(new PrivateKey(BigInt(1)));
      maciState.signUp(userKeypair.publicKey);
      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      const { privateKey, publicKey: pollPublicKey } = userKeypair;

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      stateIndex = BigInt(poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance));

      poll.publishMessage(nothing, encryptionPublic);

      // First command (valid)
      const command = new VoteCommand(
        stateIndex, // BigInt(1),
        pollPublicKey,
        1n, // voteOptionIndex,
        voiceCreditBalance, // vote weight
        2n, // nonce
        pollId,
      );

      const signature = command.sign(privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);

      // Second command (valid)
      const command2 = new VoteCommand(
        stateIndex,
        pollPublicKey,
        voteOptionIndex, // voteOptionIndex,
        voiceCreditBalance, // vote weight
        1n, // nonce
        pollId,
      );
      const signature2 = command2.sign(privateKey);

      const ecdhKeypair2 = new Keypair();
      const sharedKey2 = Keypair.generateEcdhSharedKey(ecdhKeypair2.privateKey, coordinatorKeypair.publicKey);
      const message2 = command2.encrypt(signature2, sharedKey2);
      poll.publishMessage(message2, ecdhKeypair2.publicKey);
    });

    it("should produce the correct state root and ballot root", async () => {
      const currentStateRoot = poll.pollStateTree?.root;
      const currentBallotRoot = poll.ballotTree?.root;

      const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;

      // Calculate the witness
      const witness = await circuit.calculateWitness(inputs);
      await circuit.expectConstraintPass(witness);

      // The new roots, which should differ, since at least one of the
      // messages modified a Ballot or State Leaf
      const newStateRoot = poll.pollStateTree?.root;
      const newBallotRoot = poll.ballotTree?.root;

      expect(newStateRoot!.toString()).not.to.be.eq(currentStateRoot!.toString());
      expect(newBallotRoot!.toString()).not.to.be.eq(currentBallotRoot!.toString());
    });
  });

  describe("6) 1 user, 2 messages in different batches", () => {
    let poll: Poll;
    let stateIndex: bigint;
    let pollId: bigint;

    const maciState = new MaciState(STATE_TREE_DEPTH);
    const voteOptionIndex = 1n;

    before(() => {
      // Sign up and publish
      const userKeypair = new Keypair(new PrivateKey(BigInt(1)));
      maciState.signUp(userKeypair.publicKey);

      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      const { privateKey, publicKey: pollPublicKey } = userKeypair;

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      stateIndex = BigInt(poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance));

      poll.publishMessage(nothing, encryptionPublic);

      // First command (valid)
      const command = new VoteCommand(
        stateIndex,
        pollPublicKey,
        voteOptionIndex,
        voiceCreditBalance, // vote weight
        2n, // nonce
        pollId,
      );

      const signature = command.sign(privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);

      // fill the batch with nothing messages
      for (let i = 0; i < messageBatchSize - 1; i += 1) {
        poll.publishMessage(nothing, encryptionPublic);
      }

      // Second command (valid) in second batch (which is first due to reverse processing)
      const command2 = new VoteCommand(
        stateIndex,
        pollPublicKey,
        2n, // voteOptionIndex
        voiceCreditBalance,
        1n, // nonce
        pollId,
      );
      const signature2 = command2.sign(privateKey);

      const ecdhKeypair2 = new Keypair();
      const sharedKey2 = Keypair.generateEcdhSharedKey(ecdhKeypair2.privateKey, coordinatorKeypair.publicKey);
      const message2 = command2.encrypt(signature2, sharedKey2);

      poll.publishMessage(message2, ecdhKeypair2.publicKey);
    });

    it("should produce the correct state root and ballot root", async () => {
      const currentStateRoot = poll.pollStateTree?.root;
      const currentBallotRoot = poll.ballotTree?.root;

      while (poll.hasUnprocessedMessages()) {
        const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;

        // Calculate the witness
        // eslint-disable-next-line no-await-in-loop
        const witness = await circuit.calculateWitness(inputs);
        // eslint-disable-next-line no-await-in-loop
        await circuit.expectConstraintPass(witness);

        // The new roots, which should differ, since at least one of the
        // messages modified a Ballot or State Leaf
        const newStateRoot = poll.pollStateTree?.root;
        const newBallotRoot = poll.ballotTree?.root;

        expect(newStateRoot!.toString()).not.to.be.eq(currentStateRoot!.toString());
        expect(newBallotRoot!.toString()).not.to.be.eq(currentBallotRoot!.toString());
      }
    });
  });

  describe("7) 1 user, 3 messages in different batches", () => {
    let stateIndex: bigint;
    let pollId: bigint;
    let poll: Poll;

    const maciState = new MaciState(STATE_TREE_DEPTH);
    const voteOptionIndex = 1n;

    before(() => {
      // Sign up and publish
      const userKeypair = new Keypair(new PrivateKey(BigInt(1)));
      maciState.signUp(userKeypair.publicKey);
      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Join the poll
      const { privateKey, publicKey: pollPublicKey } = userKeypair;

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      stateIndex = BigInt(poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance));

      poll.publishMessage(nothing, encryptionPublic);

      const commandFinal = new VoteCommand(
        stateIndex,
        pollPublicKey,
        voteOptionIndex,
        voiceCreditBalance - 1n,
        3n, // nonce
        pollId,
      );

      const signatureFinal = commandFinal.sign(privateKey);

      const ecdhKeypairFinal = new Keypair();
      const sharedKeyFinal = Keypair.generateEcdhSharedKey(ecdhKeypairFinal.privateKey, coordinatorKeypair.publicKey);
      const messageFinal = commandFinal.encrypt(signatureFinal, sharedKeyFinal);

      poll.publishMessage(messageFinal, ecdhKeypairFinal.publicKey);

      // First command (valid)
      const command = new VoteCommand(
        stateIndex,
        pollPublicKey,
        voteOptionIndex,
        voiceCreditBalance,
        2n, // nonce
        pollId,
      );

      const signature = command.sign(privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);

      // fill the batch with nothing messages
      for (let i = 0; i < messageBatchSize - 1; i += 1) {
        poll.publishMessage(nothing, encryptionPublic);
      }

      // Second command (valid) in second batch (which is first due to reverse processing)
      const command2 = new VoteCommand(
        stateIndex,
        pollPublicKey,
        voteOptionIndex,
        voiceCreditBalance,
        1n, // nonce
        pollId,
      );
      const signature2 = command2.sign(privateKey);

      const ecdhKeypair2 = new Keypair();
      const sharedKey2 = Keypair.generateEcdhSharedKey(ecdhKeypair2.privateKey, coordinatorKeypair.publicKey);
      const message2 = command2.encrypt(signature2, sharedKey2);

      poll.publishMessage(message2, ecdhKeypair2.publicKey);
    });

    it("should produce the correct state root and ballot root", async () => {
      const currentStateRoot = poll.pollStateTree?.root.toString();
      const currentBallotRoot = poll.ballotTree?.root.toString();

      while (poll.hasUnprocessedMessages()) {
        const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;

        // Calculate the witness
        // eslint-disable-next-line no-await-in-loop
        const witness = await circuit.calculateWitness(inputs);
        // eslint-disable-next-line no-await-in-loop
        await circuit.expectConstraintPass(witness);

        // The new roots, which should differ, since at least one of the
        // messages modified a Ballot or State Leaf
        const newStateRoot = poll.pollStateTree?.root.toString();
        const newBallotRoot = poll.ballotTree?.root.toString();

        expect(newStateRoot!.toString()).not.to.be.eq(currentStateRoot!.toString());
        expect(newBallotRoot!.toString()).not.to.be.eq(currentBallotRoot!.toString());
      }
    });
  });
});
