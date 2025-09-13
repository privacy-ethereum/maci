import { hash5, IncrementalQuinTree, poseidon, PAD_KEY_HASH, hashLeanIMT } from "@maci-protocol/crypto";
import { VoteCommand, Keypair, blankStateLeafHash } from "@maci-protocol/domainobjs";
import { LeanIMT, type LeanIMTHashFunction } from "@zk-kit/lean-imt";
import { expect } from "chai";

import { MaciState } from "../MaciState";
import { type Poll } from "../Poll";
import { STATE_TREE_DEPTH, STATE_TREE_ARITY, EMode } from "../utils/constants";

import {
  coordinatorKeypair,
  duration,
  maxVoteOptions,
  messageBatchSize,
  treeDepths,
  voiceCreditBalance,
} from "./utils/constants";
import { TestHarness, calculateTotal } from "./utils/utils";

describe("MaciState/Poll e2e", function test() {
  this.timeout(300000);

  describe("key changes", () => {
    const user1Keypair = new Keypair();
    const user2Keypair = new Keypair();
    let pollId: bigint;
    let user1StateIndex: number;
    let user2StateIndex: number;
    const user1VoteOptionIndex = 0n;
    const user2VoteOptionIndex = 1n;
    const user1VoteWeight = 9n;
    const user2VoteWeight = 3n;
    const user1NewVoteWeight = 5n;
    const user2NewVoteWeight = 7n;

    const { privateKey: privateKey1 } = user1Keypair;
    const { privateKey: pollPrivateKey, publicKey: pollPublicKey1 } = new Keypair();

    const nullifier1 = poseidon([BigInt(privateKey1.raw.toString())]);

    const { privateKey: privateKey2 } = user2Keypair;
    const { privateKey: pollPrivateKey2, publicKey: pollPublicKey2 } = new Keypair();

    const nullifier2 = poseidon([BigInt(privateKey2.raw.toString())]);

    const { publicKey: pollPublicKey3 } = new Keypair();

    const { publicKey: pollPublicKey4 } = new Keypair();

    describe("only user 1 changes key", () => {
      const maciState: MaciState = new MaciState(STATE_TREE_DEPTH);

      before(() => {
        // Sign up
        maciState.signUp(user1Keypair.publicKey);
        maciState.signUp(user2Keypair.publicKey);

        // deploy a poll
        pollId = maciState.deployPoll(
          BigInt(Math.floor(Date.now() / 1000) + duration),
          treeDepths,
          messageBatchSize,
          coordinatorKeypair,
          maxVoteOptions,
          EMode.QV,
        );

        maciState.polls.get(pollId)?.updatePoll(BigInt(maciState.publicKeys.length));
      });

      it("should submit a vote for each user", () => {
        const poll = maciState.polls.get(pollId)!;
        user1StateIndex = poll.joinPoll(nullifier1, pollPublicKey1, voiceCreditBalance);
        const command1 = new VoteCommand(
          BigInt(user1StateIndex),
          pollPublicKey1,
          user1VoteOptionIndex,
          user1VoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature1 = command1.sign(pollPrivateKey);

        const ecdhKeypair1 = new Keypair();
        const sharedKey1 = Keypair.generateEcdhSharedKey(ecdhKeypair1.privateKey, coordinatorKeypair.publicKey);

        const message1 = command1.encrypt(signature1, sharedKey1);
        poll.publishMessage(message1, ecdhKeypair1.publicKey);

        user2StateIndex = poll.joinPoll(nullifier2, pollPublicKey2, voiceCreditBalance);
        const command2 = new VoteCommand(
          BigInt(user2StateIndex),
          pollPublicKey2,
          user2VoteOptionIndex,
          user2VoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature2 = command2.sign(pollPrivateKey2);

        const ecdhKeypair2 = new Keypair();
        const sharedKey2 = Keypair.generateEcdhSharedKey(ecdhKeypair2.privateKey, coordinatorKeypair.publicKey);

        const message2 = command2.encrypt(signature2, sharedKey2);
        poll.publishMessage(message2, ecdhKeypair2.publicKey);
      });

      it("user1 sends a keychange message with a new vote", () => {
        const poll = maciState.polls.get(pollId)!;
        const command = new VoteCommand(
          BigInt(user1StateIndex),
          pollPublicKey3,
          user1VoteOptionIndex,
          user1NewVoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature = command.sign(pollPrivateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.publicKey);
      });

      it("should perform the processing and tallying correctly", () => {
        const poll = maciState.polls.get(pollId)!;
        poll.processMessages(pollId);
        poll.tallyVotes();
        expect(poll.perVoteOptionSpentVoiceCredits[0].toString()).to.eq(
          (user1NewVoteWeight * user1NewVoteWeight).toString(),
        );
        expect(poll.perVoteOptionSpentVoiceCredits[1].toString()).to.eq((user2VoteWeight * user2VoteWeight).toString());
      });

      it("should confirm that the user key pair was changed (user's 2 one has not)", () => {
        const poll = maciState.polls.get(pollId)!;
        const stateLeaf1 = poll.pollStateLeaves[user1StateIndex];
        const stateLeaf2 = poll.pollStateLeaves[user2StateIndex];
        expect(stateLeaf1.publicKey.equals(pollPublicKey3)).to.eq(true);
        expect(stateLeaf2.publicKey.equals(pollPublicKey2)).to.eq(true);
      });
    });

    describe("both users change key", () => {
      const maciState: MaciState = new MaciState(STATE_TREE_DEPTH);
      let poll: Poll;

      before(() => {
        // Sign up
        maciState.signUp(user1Keypair.publicKey);
        maciState.signUp(user2Keypair.publicKey);

        // deploy a poll
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
      });
      it("should submit a vote for each user", () => {
        user1StateIndex = poll.joinPoll(nullifier1, pollPublicKey1, voiceCreditBalance);
        const command1 = new VoteCommand(
          BigInt(user1StateIndex),
          pollPublicKey1,
          user1VoteOptionIndex,
          user1VoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature1 = command1.sign(pollPrivateKey);

        const ecdhKeypair1 = new Keypair();
        const sharedKey1 = Keypair.generateEcdhSharedKey(ecdhKeypair1.privateKey, coordinatorKeypair.publicKey);

        const message1 = command1.encrypt(signature1, sharedKey1);
        poll.publishMessage(message1, ecdhKeypair1.publicKey);

        user2StateIndex = poll.joinPoll(nullifier2, pollPublicKey2, voiceCreditBalance);
        const command2 = new VoteCommand(
          BigInt(user2StateIndex),
          pollPublicKey2,
          user2VoteOptionIndex,
          user2VoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature2 = command2.sign(pollPrivateKey2);

        const ecdhKeypair2 = new Keypair();
        const sharedKey2 = Keypair.generateEcdhSharedKey(ecdhKeypair2.privateKey, coordinatorKeypair.publicKey);

        const message2 = command2.encrypt(signature2, sharedKey2);
        poll.publishMessage(message2, ecdhKeypair2.publicKey);
      });

      it("user1 sends a keychange message with a new vote", () => {
        const command = new VoteCommand(
          BigInt(user1StateIndex),
          pollPublicKey3,
          user1VoteOptionIndex,
          user1NewVoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature = command.sign(pollPrivateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.publicKey);
      });

      it("user2 sends a keychange message with a new vote", () => {
        const command = new VoteCommand(
          BigInt(user2StateIndex),
          pollPublicKey4,
          user2VoteOptionIndex,
          user2NewVoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature = command.sign(pollPrivateKey2);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.publicKey);
      });

      it("should perform the processing and tallying correctly", () => {
        poll.processMessages(pollId);
        poll.tallyVotes();
        expect(poll.perVoteOptionSpentVoiceCredits[0].toString()).to.eq(
          (user1NewVoteWeight * user1NewVoteWeight).toString(),
        );
        expect(poll.perVoteOptionSpentVoiceCredits[1].toString()).to.eq(
          (user2NewVoteWeight * user2NewVoteWeight).toString(),
        );
      });

      it("should confirm that the users key pairs were changed", () => {
        const pollStateLeaf1 = poll.pollStateLeaves[user1StateIndex];
        const pollStateLeaf2 = poll.pollStateLeaves[user2StateIndex];
        expect(pollStateLeaf1.publicKey.equals(pollPublicKey3)).to.eq(true);
        expect(pollStateLeaf2.publicKey.equals(pollPublicKey4)).to.eq(true);
      });
    });

    describe("user1 changes key, but messages are in different batches", () => {
      const maciState = new MaciState(STATE_TREE_DEPTH);
      let poll: Poll;

      before(() => {
        // Sign up
        maciState.signUp(user1Keypair.publicKey);

        // deploy a poll
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
      });

      it("should submit a vote for one user in one batch", () => {
        user1StateIndex = poll.joinPoll(nullifier1, pollPublicKey1, voiceCreditBalance);
        const command1 = new VoteCommand(
          BigInt(user1StateIndex),
          pollPublicKey1,
          user1VoteOptionIndex,
          user1VoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature1 = command1.sign(pollPrivateKey);

        const ecdhKeypair1 = new Keypair();
        const sharedKey1 = Keypair.generateEcdhSharedKey(ecdhKeypair1.privateKey, coordinatorKeypair.publicKey);

        const message1 = command1.encrypt(signature1, sharedKey1);
        poll.publishMessage(message1, ecdhKeypair1.publicKey);
      });

      it("should fill the batch with random messages", () => {
        for (let i = 0; i < messageBatchSize - 1; i += 1) {
          const command = new VoteCommand(
            1n,
            pollPublicKey1,
            user1VoteOptionIndex,
            user1VoteWeight,
            2n,
            BigInt(pollId),
          );

          const signature = command.sign(pollPrivateKey);

          const ecdhKeypair = new Keypair();
          const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

          const message = command.encrypt(signature, sharedKey);
          poll.publishMessage(message, ecdhKeypair.publicKey);
        }
      });

      it("should submit a new message in a new batch", () => {
        const command1 = new VoteCommand(
          BigInt(user1StateIndex),
          pollPublicKey3,
          user1VoteOptionIndex,
          user1NewVoteWeight,
          1n,
          BigInt(pollId),
        );

        const signature1 = command1.sign(pollPrivateKey);

        const ecdhKeypair1 = new Keypair();
        const sharedKey1 = Keypair.generateEcdhSharedKey(ecdhKeypair1.privateKey, coordinatorKeypair.publicKey);

        const message1 = command1.encrypt(signature1, sharedKey1);
        poll.publishMessage(message1, ecdhKeypair1.publicKey);
      });

      it("should perform the processing and tallying correctly", () => {
        poll.processAllMessages();
        poll.tallyVotes();
        expect(poll.perVoteOptionSpentVoiceCredits[0].toString()).to.eq(
          (user1NewVoteWeight * user1NewVoteWeight).toString(),
        );
      });

      it("should confirm that the user key pair was changed", () => {
        const pollStateLeaf1 = poll.pollStateLeaves[user1StateIndex];
        expect(pollStateLeaf1.publicKey.equals(pollPublicKey3)).to.eq(true);
      });
    });
  });

  describe("Process and tally 1 message from 1 user", () => {
    let maciState: MaciState;
    let pollId: bigint;
    let poll: Poll;
    const voteWeight = 9n;
    const voteOptionIndex = 0n;
    let stateIndex: number;
    const userKeypair = new Keypair();

    before(() => {
      maciState = new MaciState(STATE_TREE_DEPTH);

      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      poll = maciState.polls.get(pollId)!;
    });

    // The end result should be that option 0 gets 3 votes
    // because the user spends 9 voice credits on it
    it("the state root should be correct", () => {
      stateIndex = maciState.signUp(userKeypair.publicKey);
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      const stateTree = new LeanIMT(hashLeanIMT as LeanIMTHashFunction);

      stateTree.insert(PAD_KEY_HASH);
      stateTree.insert(userKeypair.publicKey.hash());

      expect(stateIndex.toString()).to.eq("1");
      expect(stateTree.root.toString()).to.eq(poll.stateTree?.root.toString());
    });

    it("Process a batch of messages (though only 1 message is in the batch)", () => {
      const { privateKey } = userKeypair;
      const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

      const command = new VoteCommand(
        BigInt(stateIndex),
        pollPublicKey,
        voteOptionIndex,
        voteWeight,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);

      poll.processMessages(pollId);

      // Check the ballot
      expect(poll.ballots[1].votes[Number(voteOptionIndex)].toString()).to.eq(voteWeight.toString());
      // Check the state leaf in the poll
      expect(poll.pollStateLeaves[1].voiceCreditBalance.toString()).to.eq(
        (voiceCreditBalance - voteWeight * voteWeight).toString(),
      );
    });

    it("Tally ballots", () => {
      const initialTotal = calculateTotal(poll.tallyResult);
      expect(initialTotal.toString()).to.eq("0");

      expect(poll.hasUntalliedBallots()).to.eq(true);

      poll.tallyVotes();

      const finalTotal = calculateTotal(poll.tallyResult);
      expect(finalTotal.toString()).to.eq(voteWeight.toString());
    });
  });

  describe(`Process and tally ${messageBatchSize * 2 - 2} messages from ${messageBatchSize - 1} users`, () => {
    let maciState: MaciState;
    let pollId: bigint;
    let poll: Poll;
    const voteWeight = 9n;

    const users: Keypair[] = [];
    const pollKeys: Keypair[] = [];
    const stateIndices: number[] = [];

    before(() => {
      maciState = new MaciState(STATE_TREE_DEPTH);
      // Sign up and vote
      for (let i = 0; i < messageBatchSize - 1; i += 1) {
        const userKeypair = new Keypair();
        users.push(userKeypair);

        const pollKeypair = new Keypair();
        pollKeys.push(pollKeypair);

        maciState.signUp(userKeypair.publicKey);
      }

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

      for (let i = 0; i < messageBatchSize - 1; i += 1) {
        const nullifier = poseidon([BigInt(pollKeys[i].privateKey.raw.toString())]);
        const stateIndex = poll.joinPoll(nullifier, pollKeys[i].publicKey, voiceCreditBalance);
        stateIndices.push(stateIndex);
      }
    });

    it("should process votes correctly", () => {
      // 19 valid votes
      for (let i = 0; i < messageBatchSize - 1; i += 1) {
        const pollKeypair = pollKeys[i];

        const command = new VoteCommand(
          BigInt(stateIndices[i]),
          pollKeypair.publicKey,
          BigInt(i), // vote option index
          voteWeight,
          1n,
          BigInt(pollId),
        );

        const signature = command.sign(pollKeypair.privateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.publicKey);
      }

      expect(poll.messages.length).to.eq(messageBatchSize - 1);

      // 19 invalid votes
      for (let i = 0; i < messageBatchSize - 1; i += 1) {
        const pollKeypair = pollKeys[i];

        const command = new VoteCommand(
          BigInt(stateIndices[i]),
          pollKeypair.publicKey,
          BigInt(i), // vote option index
          voiceCreditBalance * 2n, // invalid vote weight
          1n,
          BigInt(pollId),
        );

        const signature = command.sign(pollKeypair.privateKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.publicKey);
      }

      // 38 messages in total
      expect(poll.messages.length).to.eq(2 * (messageBatchSize - 1));

      expect(poll.currentMessageBatchIndex).to.eq(1);
      expect(poll.totalBatchesProcessed).to.eq(0);

      // Process messages
      poll.processMessages(pollId);

      expect(poll.totalBatchesProcessed).to.eq(1);

      // Process messages
      poll.processMessages(pollId);

      expect(poll.currentMessageBatchIndex).to.eq(0);
      expect(poll.totalBatchesProcessed).to.eq(2);

      for (let i = 1; i < messageBatchSize; i += 1) {
        const leaf = poll.ballots[i].votes[i - 1];
        expect(leaf.toString()).to.eq(voteWeight.toString());
      }

      // Test processAllMessages
      const r = poll.processAllMessages();

      expect(r.stateLeaves.length).to.eq(poll.pollStateLeaves.length);

      expect(r.ballots.length).to.eq(poll.ballots.length);

      expect(r.ballots.length).to.eq(r.stateLeaves.length);

      for (let i = 0; i < r.stateLeaves.length; i += 1) {
        expect(r.stateLeaves[i].equals(poll.pollStateLeaves[i])).to.eq(true);

        expect(r.ballots[i].equals(poll.ballots[i])).to.eq(true);
      }
    });

    it("should tally ballots correctly", () => {
      // Start with tallyResult = [0...0]
      const total = calculateTotal(poll.tallyResult);
      expect(total.toString()).to.eq("0");

      // Check that there are untallied results
      expect(poll.hasUntalliedBallots()).to.eq(true);

      // First batch tally
      while (poll.hasUntalliedBallots()) {
        poll.tallyVotes();
      }

      // Recall that each user `i` cast the same number of votes for
      // their option `i`
      for (let i = 1; i < messageBatchSize - 1; i += 1) {
        expect(poll.tallyResult[i].toString()).to.eq(voteWeight.toString());
      }

      for (let i = messageBatchSize; i < poll.tallyResult.length - 1; i += 1) {
        expect(poll.tallyResult[i].toString()).to.eq("0");
      }

      expect(poll.hasUntalliedBallots()).to.eq(false);

      expect(() => {
        poll.tallyVotes();
      }).to.throw();
    });
  });

  describe("Process and tally with non quadratic voting", () => {
    let maciState: MaciState;
    let pollId: bigint;
    let poll: Poll;
    let stateTree: IncrementalQuinTree;
    const voteWeight = 9n;
    const voteOptionIndex = 0n;
    let stateIndex: number;
    const userKeypair = new Keypair();

    before(() => {
      maciState = new MaciState(STATE_TREE_DEPTH);
      stateTree = new IncrementalQuinTree(STATE_TREE_DEPTH, blankStateLeafHash, STATE_TREE_ARITY, hash5);

      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.NON_QV,
      );

      poll = maciState.polls.get(pollId)!;

      maciState.signUp(userKeypair.publicKey);
      stateTree.insert(PAD_KEY_HASH);
      stateTree.insert(userKeypair.publicKey.hash());

      poll.updatePoll(BigInt(maciState.publicKeys.length));

      const { privateKey } = userKeypair;
      const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

      const pollNullifier = poseidon([BigInt(privateKey.raw.toString())]);

      stateIndex = poll.joinPoll(pollNullifier, pollPublicKey, voiceCreditBalance);

      const command = new VoteCommand(
        BigInt(stateIndex),
        pollPublicKey,
        voteOptionIndex,
        voteWeight,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);
    });

    it("Process a batch of messages (though only 1 message is in the batch)", () => {
      poll.processMessages(pollId);

      // Check the ballot
      expect(poll.ballots[1].votes[Number(voteOptionIndex)].toString()).to.eq(voteWeight.toString());
      // Check the state leaf in the poll
      expect(poll.pollStateLeaves[1].voiceCreditBalance.toString()).to.eq((voiceCreditBalance - voteWeight).toString());
    });

    it("Tally ballots", () => {
      const initialTotal = calculateTotal(poll.tallyResult);
      expect(initialTotal.toString()).to.eq("0");

      expect(poll.hasUntalliedBallots()).to.eq(true);

      poll.tallyVotes();

      const finalTotal = calculateTotal(poll.tallyResult);
      expect(finalTotal.toString()).to.eq(voteWeight.toString());

      // check that the totalSpentVoiceCredits is correct
      expect(poll.totalSpentVoiceCredits.toString()).to.eq(voteWeight.toString());
    });
  });

  describe("Process and tally with full credits voting", () => {
    let maciState: MaciState;
    let pollId: bigint;
    let poll: Poll;
    let stateTree: IncrementalQuinTree;
    let stateIndex: number;

    const voteOptionIndex = 0n;
    const userKeypair = new Keypair();

    before(() => {
      maciState = new MaciState(STATE_TREE_DEPTH);
      stateTree = new IncrementalQuinTree(STATE_TREE_DEPTH, blankStateLeafHash, STATE_TREE_ARITY, hash5);

      pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      poll = maciState.polls.get(pollId)!;

      maciState.signUp(userKeypair.publicKey);
      stateTree.insert(PAD_KEY_HASH);
      stateTree.insert(userKeypair.publicKey.hash());

      poll.updatePoll(BigInt(maciState.publicKeys.length));

      const { privateKey } = userKeypair;
      const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

      const pollNullifier = poseidon([BigInt(privateKey.raw.toString())]);

      stateIndex = poll.joinPoll(pollNullifier, pollPublicKey, voiceCreditBalance);

      const command = new VoteCommand(
        BigInt(stateIndex),
        pollPublicKey,
        voteOptionIndex,
        voiceCreditBalance,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);
    });

    it("Process a batch of messages (though only 1 message is in the batch)", () => {
      poll.processMessages(pollId);

      // Check the ballot
      expect(poll.ballots[1].votes[Number(voteOptionIndex)].toString()).to.eq(voiceCreditBalance.toString());
      // Check the state leaf in the poll
      expect(poll.pollStateLeaves[1].voiceCreditBalance.toString()).to.eq("0");
    });

    it("Tally ballots", () => {
      const initialTotal = calculateTotal(poll.tallyResult);
      expect(initialTotal.toString()).to.eq("0");

      expect(poll.hasUntalliedBallots()).to.eq(true);

      poll.tallyVotes();

      const finalTotal = calculateTotal(poll.tallyResult);
      expect(finalTotal.toString()).to.eq(voiceCreditBalance.toString());

      // check that the totalSpentVoiceCredits is correct
      expect(poll.totalSpentVoiceCredits.toString()).to.eq(voiceCreditBalance.toString());
    });
  });

  describe("Sanity checks", () => {
    let testHarness: TestHarness;
    let poll: Poll;

    beforeEach(() => {
      testHarness = new TestHarness();

      poll = testHarness.poll;
    });

    it("should process a valid message", () => {
      const voteOptionIndex = 0n;
      const voteWeight = 9n;
      const nonce = 1n;

      const users = testHarness.createUsers(1);

      const { privateKey } = users[0];
      const pollKeypair = new Keypair();

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      const pollStateIndex = testHarness.joinPoll(nullifier, pollKeypair.publicKey, voiceCreditBalance);
      testHarness.vote(pollKeypair, pollStateIndex, voteOptionIndex, voteWeight, nonce);
      testHarness.finalizePoll();

      const messageLengthResult = poll.messages.length;
      const expectedNumVotes = users.length;
      expect(messageLengthResult).to.eq(expectedNumVotes);

      const tallyResult = poll.tallyResult[0];
      const expectedTallyResult = 9n;
      expect(tallyResult).to.eq(expectedTallyResult);
    });

    it("should not process messages twice", () => {
      const voteOptionIndex = 0n;
      const voteWeight = 9n;
      const nonce = 1n;

      const users = testHarness.createUsers(1);

      const { privateKey } = users[0];
      const pollKeypair = new Keypair();

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      const pollStateIndex = testHarness.joinPoll(nullifier, pollKeypair.publicKey, voiceCreditBalance);
      testHarness.vote(pollKeypair, pollStateIndex, voteOptionIndex, voteWeight, nonce);

      poll.updatePoll(BigInt(testHarness.maciState.publicKeys.length));
      poll.processMessages(testHarness.pollId);

      expect(() => {
        poll.processMessages(testHarness.pollId);
      }).to.throw("No more messages to process");

      poll.tallyVotes();

      const messageLengthResult = poll.messages.length;
      const expectedNumVotes = users.length;
      expect(messageLengthResult).to.eq(expectedNumVotes);

      const tallyResult = poll.tallyResult[0];
      const expectedTallyResult = 9n;
      expect(tallyResult).to.eq(expectedTallyResult);
    });

    it("should not process a message with an incorrect nonce", () => {
      const voteOptionIndex = 0n;
      const voteWeight = 9n;

      const users = testHarness.createUsers(5);
      // generate a bunch of invalid votes with nonces that are not 1
      let nonce: bigint;
      users.forEach((user) => {
        do {
          nonce = BigInt(Math.floor(Math.random() * 100) - 50);
        } while (nonce === 1n);

        const { privateKey } = user;
        const pollKeypair = new Keypair();

        const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

        const pollStateIndex = testHarness.joinPoll(nullifier, pollKeypair.publicKey, voiceCreditBalance);
        testHarness.vote(pollKeypair, pollStateIndex, voteOptionIndex, voteWeight, nonce);
      });

      testHarness.finalizePoll();

      const messageLengthResult = poll.messages.length;
      const expectedNumVotes = users.length;
      expect(messageLengthResult).to.eq(expectedNumVotes);

      const tallyResult = poll.tallyResult[0];
      const expectedTallyResult = 0n;
      expect(tallyResult).to.eq(expectedTallyResult);
    });

    // note: When voting, the voice credit is used. The amount of voice credit used is
    // the square of the vote weight. Since the maximum voice credit is 100 here,
    // the vote weight can only be a value between 1 and 10
    // (as these are the square roots of numbers up to 100).
    it("should not process a message with an incorrect vote weight", () => {
      const voteOptionIndex = 0n;
      const nonce = 1n;

      const users = testHarness.createUsers(5);

      // generate a bunch of invalid votes with vote weights that are not between 1 and 10
      let voteWeight: bigint;
      users.forEach((user) => {
        do {
          voteWeight = BigInt(Math.floor(Math.random() * 100) - 50);
        } while (voteWeight >= 1n && voteWeight <= 10n);

        const { privateKey } = user;
        const pollKeypair = new Keypair();

        const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

        const pollStateIndex = testHarness.joinPoll(nullifier, pollKeypair.publicKey, voiceCreditBalance);

        testHarness.vote(pollKeypair, pollStateIndex, voteOptionIndex, voteWeight, nonce);
      });

      testHarness.finalizePoll();

      const messageLengthResult = poll.messages.length;
      const expectedNumVotes = users.length;
      expect(messageLengthResult).to.eq(expectedNumVotes);

      const tallyResult = poll.tallyResult[0];
      const expectedTallyResult = 0n;
      expect(tallyResult).to.eq(expectedTallyResult);
    });

    it("should not process a message with an incorrect state tree index", () => {
      const voteOptionIndex = 0n;
      const nonce = 1n;
      const voteWeight = 9n;
      const numVotes = 5;

      const users = testHarness.createUsers(5);

      users.forEach((user) => {
        // generate a bunch of invalid votes with incorrect state tree index
        const { privateKey } = user;
        const pollKeypair = new Keypair();

        const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

        const pollStateIndex = testHarness.joinPoll(nullifier, pollKeypair.publicKey, voiceCreditBalance);
        testHarness.vote(pollKeypair, pollStateIndex + 1, voteOptionIndex, voteWeight, nonce);
      });

      testHarness.finalizePoll();

      const messageLengthResult = poll.messages.length;
      const expectedNumVotes = numVotes;
      expect(messageLengthResult).to.eq(expectedNumVotes);

      const tallyResult = poll.tallyResult[0];
      const expectedTallyResult = 0n;
      expect(tallyResult).to.eq(expectedTallyResult);
    });

    it("should not process a message with an incorrect signature", () => {
      const voteOptionIndex = 0n;
      const voteWeight = 9n;
      const nonce = 1n;

      const users = testHarness.createUsers(2);

      const { privateKey: privateKey1 } = users[0];
      const pollKeypair1 = new Keypair();

      const nullifier1 = poseidon([BigInt(privateKey1.raw.toString())]);

      const pollStateIndex1 = testHarness.joinPoll(nullifier1, pollKeypair1.publicKey, voiceCreditBalance);

      const { command } = testHarness.createCommand(pollKeypair1, pollStateIndex1, voteOptionIndex, voteWeight, nonce);

      const { privateKey: privateKey2 } = users[1];
      const pollKeypair2 = new Keypair();

      const nullifier2 = poseidon([BigInt(privateKey2.raw.toString())]);

      testHarness.joinPoll(nullifier2, pollKeypair2.publicKey, voiceCreditBalance);

      // create an invalid signature
      const { signature: invalidSignature } = testHarness.createCommand(
        pollKeypair2,
        pollStateIndex1,
        voteOptionIndex,
        voteWeight,
        nonce,
      );

      // sign the command with the invalid signature
      const { message, encryptionPublicKey } = testHarness.createMessage(
        command,
        invalidSignature,
        testHarness.coordinatorKeypair,
      );

      testHarness.poll.publishMessage(message, encryptionPublicKey);
      testHarness.finalizePoll();

      const messageLengthResult = poll.messages.length;
      const expectedNumVotes = users.length - 1;
      expect(messageLengthResult).to.eq(expectedNumVotes);

      const tallyResult = poll.tallyResult[0];
      const expectedTallyResult = 0n;
      expect(tallyResult).to.eq(expectedTallyResult);
    });

    it("should not process a message with an invalid coordinator key", () => {
      const voteOptionIndex = 0n;
      const voteWeight = 9n;
      const nonce = 1n;

      const users = testHarness.createUsers(1);

      const { privateKey } = users[0];
      const pollKeypair = new Keypair();

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      const pollStateIndex = testHarness.joinPoll(nullifier, pollKeypair.publicKey, voiceCreditBalance);

      const { command, signature } = testHarness.createCommand(
        pollKeypair,
        pollStateIndex,
        voteOptionIndex,
        voteWeight,
        nonce,
      );

      const { message, encryptionPublicKey } = testHarness.createMessage(command, signature, new Keypair());

      testHarness.poll.publishMessage(message, encryptionPublicKey);
      testHarness.finalizePoll();

      const messageLengthResult = poll.messages.length;
      const expectedNumVotes = users.length;
      expect(messageLengthResult).to.eq(expectedNumVotes);

      const tallyResult = poll.tallyResult[0];
      const expectedTallyResult = 0n;
      expect(tallyResult).to.eq(expectedTallyResult);
    });
  });
});
