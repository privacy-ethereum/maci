import { MaciState, packProcessMessageSmallVals, unpackProcessMessageSmallVals } from "../";
import { expect } from "chai";
import { PCommand, Message, Keypair, VerifyingKey, StateLeaf } from "maci-domainobjs";

import { hash5, G1Point, G2Point, NOTHING_UP_MY_SLEEVE, IncrementalQuinTree } from "maci-crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";

const voiceCreditBalance = BigInt(100);

const duration = 30;
const maxValues = {
  maxUsers: 25,
  maxMessages: 25,
  maxVoteOptions: 25,
};

const treeDepths = {
  intStateTreeDepth: 2,
  messageTreeDepth: 3,
  messageTreeSubDepth: 2,
  voteOptionTreeDepth: 4,
};

const messageBatchSize = 25;

const STATE_TREE_DEPTH = 10;

const testProcessVk = new VerifyingKey(
  new G1Point(BigInt(0), BigInt(1)),
  new G2Point([BigInt(0), BigInt(0)], [BigInt(1), BigInt(1)]),
  new G2Point([BigInt(3), BigInt(0)], [BigInt(1), BigInt(1)]),
  new G2Point([BigInt(4), BigInt(0)], [BigInt(1), BigInt(1)]),
  [new G1Point(BigInt(5), BigInt(1)), new G1Point(BigInt(6), BigInt(1))],
);

const testTallyVk = new VerifyingKey(
  new G1Point(BigInt(2), BigInt(3)),
  new G2Point([BigInt(3), BigInt(0)], [BigInt(3), BigInt(1)]),
  new G2Point([BigInt(4), BigInt(0)], [BigInt(3), BigInt(1)]),
  new G2Point([BigInt(5), BigInt(0)], [BigInt(4), BigInt(1)]),
  [new G1Point(BigInt(6), BigInt(1)), new G1Point(BigInt(7), BigInt(1))],
);

const coordinatorKeypair = new Keypair();

const blankStateLeaf = StateLeaf.genBlankLeaf();
const blankStateLeafHash = blankStateLeaf.hash();

describe("MaciState", function () {
  this.timeout(100000);
  describe("Process and tally 1 message from 1 user", () => {
    let maciState: MaciState;
    let pollId;
    let stateTree;
    let msgTree;
    const voteWeight = BigInt(9);
    const voteOptionIndex = BigInt(0);
    let stateIndex;
    const userKeypair = new Keypair();

    before(() => {
      maciState = new MaciState(STATE_TREE_DEPTH);
      stateTree = new IncrementalQuinTree(STATE_TREE_DEPTH, blankStateLeafHash, 5, hash5);

      stateTree.insert(blankStateLeafHash);

      msgTree = new IncrementalQuinTree(treeDepths.messageTreeDepth, NOTHING_UP_MY_SLEEVE, 5, hash5);
    });

    // The end result should be that option 0 gets 3 votes
    // because the user spends 9 voice credits on it
    it("the state root should be correct", () => {
      const timestamp = BigInt(Math.floor(Date.now() / 1000));

      const stateLeaf = new StateLeaf(userKeypair.pubKey, voiceCreditBalance, timestamp);

      stateTree.insert(stateLeaf.hash());

      stateIndex = maciState.signUp(userKeypair.pubKey, voiceCreditBalance, timestamp);

      expect(stateIndex.toString()).to.eq("1");

      maciState.stateAq.mergeSubRoots(0);
      maciState.stateAq.merge(STATE_TREE_DEPTH);
      console.log(`root=${stateTree.root.toString()}`);

      expect(maciState.stateAq.getRoot(STATE_TREE_DEPTH).toString()).to.eq(stateTree.root.toString());
    });

    it("the message root should be correct", () => {
      pollId = maciState.deployPoll(
        duration,
        BigInt(Math.floor(Date.now() / 1000) + duration),
        maxValues,
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
      );

      const command = new PCommand(
        stateIndex,
        userKeypair.pubKey,
        voteOptionIndex,
        voteWeight,
        BigInt(1),
        BigInt(pollId),
      );

      const signature = command.sign(userKeypair.privKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privKey, coordinatorKeypair.pubKey);
      const message = command.encrypt(signature, sharedKey);

      maciState.polls[pollId].publishMessage(message, ecdhKeypair.pubKey);
      msgTree.insert(message.hash(ecdhKeypair.pubKey));

      maciState.polls[pollId].messageAq.mergeSubRoots(0);
      maciState.polls[pollId].messageAq.merge(treeDepths.messageTreeDepth);

      expect(maciState.polls[pollId].messageAq.getRoot(treeDepths.messageTreeDepth).toString()).to.eq(
        msgTree.root.toString(),
      );
    });

    it("packProcessMessageSmallVals and unpackProcessMessageSmallVals", () => {
      const maxVoteOptions = BigInt(1);
      const numUsers = BigInt(2);
      const batchStartIndex = 5;
      const batchEndIndex = 10;
      const packedVals = packProcessMessageSmallVals(maxVoteOptions, numUsers, batchStartIndex, batchEndIndex);

      const unpacked = unpackProcessMessageSmallVals(packedVals);
      expect(unpacked.maxVoteOptions.toString()).to.eq(maxVoteOptions.toString());
      expect(unpacked.numUsers.toString()).to.eq(numUsers.toString());
      expect(unpacked.batchStartIndex.toString()).to.eq(batchStartIndex.toString());
      expect(unpacked.batchEndIndex.toString()).to.eq(batchEndIndex.toString());
    });

    it("Process a batch of messages (though only 1 message is in the batch)", () => {
      maciState.polls[pollId].processMessages(pollId);

      // Check the ballot
      expect(maciState.polls[pollId].ballots[1].votes[Number(voteOptionIndex)].toString()).to.eq(voteWeight.toString());
      // Check the state leaf in the poll
      expect(maciState.polls[pollId].stateLeaves[1].voiceCreditBalance.toString()).to.eq(
        (voiceCreditBalance - voteWeight * voteWeight).toString(),
      );
    });

    it("Tally ballots", () => {
      let total = BigInt(0);
      for (const v of maciState.polls[pollId].results) {
        total = BigInt(Number(total) + Number(v));
      }
      expect(total.toString()).to.eq("0");

      expect(maciState.polls[pollId].hasUntalliedBallots()).to.be.true;

      maciState.polls[pollId].tallyVotes();

      total = BigInt(0);
      for (const v of maciState.polls[pollId].results) {
        total = BigInt(Number(total) + Number(v));
      }
      expect(total.toString()).to.eq(voteWeight.toString());
    });
  });

  describe(`Process and tally ${messageBatchSize * 2} messages from ${messageBatchSize} users`, () => {
    let maciState;
    let pollId;
    const voteWeight = BigInt(9);

    const users: Keypair[] = [];

    before(() => {
      maciState = new MaciState(STATE_TREE_DEPTH);
      // Sign up and vote
      for (let i = 0; i < messageBatchSize - 1; i++) {
        const userKeypair = new Keypair();
        users.push(userKeypair);

        maciState.signUp(userKeypair.pubKey, voiceCreditBalance, BigInt(Math.floor(Date.now() / 1000)));
      }

      pollId = maciState.deployPoll(
        duration,
        BigInt(Math.floor(Date.now() / 1000) + duration),
        maxValues,
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        testProcessVk,
        testTallyVk,
      );
    });

    it("should process votes correctly", () => {
      // 24 valid votes
      for (let i = 0; i < messageBatchSize - 1; i++) {
        const userKeypair = users[i];

        const command = new PCommand(
          BigInt(i + 1),
          userKeypair.pubKey,
          BigInt(i), // vote option index
          voteWeight,
          BigInt(1),
          BigInt(pollId),
        );

        const signature = command.sign(userKeypair.privKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privKey, coordinatorKeypair.pubKey);
        const message = command.encrypt(signature, sharedKey);
        maciState.polls[pollId].publishMessage(message, ecdhKeypair.pubKey);
      }

      expect(maciState.polls[pollId].messageAq.numLeaves).to.eq(messageBatchSize - 1);

      // 24 invalid votes
      for (let i = 0; i < messageBatchSize - 1; i++) {
        const userKeypair = users[i];
        const command = new PCommand(
          BigInt(i + 1),
          userKeypair.pubKey,
          BigInt(i), // vote option index
          voiceCreditBalance * BigInt(2), // invalid vote weight
          BigInt(1),
          BigInt(pollId),
        );

        const signature = command.sign(userKeypair.privKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privKey, coordinatorKeypair.pubKey);
        const message = command.encrypt(signature, sharedKey);
        maciState.polls[pollId].publishMessage(message, ecdhKeypair.pubKey);
      }

      // processMessages() should fail if the state and message AQs are
      // not merged yet
      expect(() => {
        maciState.polls[pollId].processMessages();
      }).to.throw;

      // Merge the state aq
      maciState.stateAq.mergeSubRoots(0);
      maciState.stateAq.merge(STATE_TREE_DEPTH);

      expect(() => {
        maciState.polls[pollId].processMessages();
      }).to.throw;

      // Merge the message aq
      maciState.polls[pollId].messageAq.mergeSubRoots(0);
      maciState.polls[pollId].messageAq.merge(treeDepths.messageTreeDepth);

      expect(maciState.polls[pollId].messageAq.numLeaves).to.eq(messageBatchSize * 2);

      expect(maciState.polls[pollId].currentMessageBatchIndex).to.eq(undefined);
      expect(maciState.polls[pollId].numBatchesProcessed).to.eq(0);

      // Process messages
      maciState.polls[pollId].processMessages();

      // currentMessageBatchIndex is 0 because the current batch starts
      // with index 0.
      expect(maciState.polls[pollId].currentMessageBatchIndex).to.eq(0);
      expect(maciState.polls[pollId].numBatchesProcessed).to.eq(1);

      // Process messages
      maciState.polls[pollId].processMessages();

      expect(maciState.polls[pollId].currentMessageBatchIndex).to.eq(0);
      expect(maciState.polls[pollId].numBatchesProcessed).to.eq(2);

      // Attempt to process messages, but this should fail as there are
      // no more messages to process
      // TODO: use VError to test for specific errors
      expect(() => {
        maciState.polls[pollId].processMessages();
      }).to.throw;

      for (let i = 1; i < messageBatchSize; i++) {
        const leaf = maciState.polls[pollId].ballots[i].votes[i - 1];
        expect(leaf.toString()).to.eq(voteWeight.toString());
      }

      // Test processAllMessages
      const r = maciState.polls[pollId].processAllMessages();

      expect(r.stateLeaves.length).to.eq(maciState.polls[pollId].stateLeaves.length);

      expect(r.ballots.length).to.eq(maciState.polls[pollId].ballots.length);

      expect(r.ballots.length).to.eq(r.stateLeaves.length);

      for (let i = 0; i < r.stateLeaves.length; i++) {
        expect(r.stateLeaves[i].equals(maciState.polls[pollId].stateLeaves[i])).to.be.true;

        expect(r.ballots[i].equals(maciState.polls[pollId].ballots[i])).to.be.true;
      }
    });

    it("should tally ballots correctly", () => {
      // Start with results = [0...0]
      let total = BigInt(0);
      for (const v of maciState.polls[pollId].results) {
        total = total + v;
      }
      expect(total.toString()).to.eq("0");

      // Check that there are untallied results
      expect(maciState.polls[pollId].hasUntalliedBallots()).to.be.true;

      // First batch tally
      maciState.polls[pollId].tallyVotes();

      // Recall that each user `i` cast the same number of votes for
      // their option `i`
      for (let i = 0; i < maciState.polls[pollId].results.length - 1; i++) {
        expect(maciState.polls[pollId].results[i].toString()).to.eq(voteWeight.toString());
      }

      expect(maciState.polls[pollId].hasUntalliedBallots()).to.be.false;

      expect(() => {
        maciState.polls[pollId].tallyVotes();
      }).to.throw;
    });
  });

  describe("Deep copy", () => {
    let pollId;
    let m1: MaciState;
    const userKeypair = new Keypair();
    const stateFile = "./state.json";

    after(() => {
      if (existsSync(stateFile)) unlinkSync(stateFile);
    });

    before(() => {
      m1 = new MaciState(STATE_TREE_DEPTH);
      m1.signUp(userKeypair.pubKey, voiceCreditBalance, BigInt(Math.floor(Date.now() / 1000)));
      pollId = m1.deployPoll(
        duration,
        BigInt(Math.floor(Date.now() / 1000) + duration),
        maxValues,
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
      );
      const command = new PCommand(
        BigInt(0),
        userKeypair.pubKey,
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(pollId),
        BigInt(0),
      );

      const encKeypair = new Keypair();
      const signature = command.sign(encKeypair.privKey);
      const sharedKey = Keypair.genEcdhSharedKey(encKeypair.privKey, coordinatorKeypair.pubKey);
      const message: Message = command.encrypt(signature, sharedKey);

      m1.polls[pollId].publishMessage(message, encKeypair.pubKey);
    });

    it("should correctly deep-copy a MaciState object", () => {
      const m2 = m1.copy();

      // modify stateTreeDepth
      m2.stateTreeDepth = m2.stateTreeDepth + 1;
      expect(m1.equals(m2)).not.to.be.true;

      // modify user.pubKey
      const m3 = m1.copy();
      m3.stateLeaves[0].pubKey = new Keypair().pubKey;
      expect(m1.equals(m3)).not.to.be.true;

      // modify user.voiceCreditBalance
      const m4 = m1.copy();
      m4.stateLeaves[0].voiceCreditBalance = BigInt(m4.stateLeaves[0].voiceCreditBalance) + BigInt(1);
      expect(m1.equals(m4)).not.to.be.true;

      // modify poll.duration
      const m5 = m1.copy();
      m5.polls[pollId].duration = m5.polls[pollId].duration + 1;
      expect(m1.equals(m5)).not.to.be.true;

      // modify poll.coordinatorKeypair
      const m6 = m1.copy();
      m6.polls[pollId].coordinatorKeypair = new Keypair();
      expect(m1.equals(m6)).not.to.be.true;

      // modify poll.treeDepths.intStateTreeDepth
      const m9 = m1.copy();
      m9.polls[pollId].treeDepths.intStateTreeDepth = m9.polls[pollId].treeDepths.intStateTreeDepth + 1;
      expect(m1.equals(m9)).not.to.be.true;

      // modify poll.treeDepths.messageTreeDepth
      const m10 = m1.copy();
      m10.polls[pollId].treeDepths.messageTreeDepth = m10.polls[pollId].treeDepths.messageTreeDepth + 1;
      expect(m1.equals(m10)).not.to.be.true;

      // modify poll.treeDepths.messageTreeSubDepth
      const m11 = m1.copy();
      m11.polls[pollId].treeDepths.messageTreeSubDepth = m11.polls[pollId].treeDepths.messageTreeSubDepth + 1;
      expect(m1.equals(m11)).not.to.be.true;

      // modify poll.treeDepths.voteOptionTreeDepth
      const m12 = m1.copy();
      m12.polls[pollId].treeDepths.voteOptionTreeDepth = m12.polls[pollId].treeDepths.voteOptionTreeDepth + 1;
      expect(m1.equals(m12)).not.to.be.true;

      // modify poll.batchSizes.tallyBatchSize
      const m13 = m1.copy();
      m13.polls[pollId].batchSizes.tallyBatchSize = m13.polls[pollId].batchSizes.tallyBatchSize + 1;
      expect(m1.equals(m13)).not.to.be.true;

      // modify poll.batchSizes.messageBatchSize
      const m14 = m1.copy();
      m14.polls[pollId].batchSizes.messageBatchSize = m14.polls[pollId].batchSizes.messageBatchSize + 1;
      expect(m1.equals(m14)).not.to.be.true;

      // modify poll.maxValues.maxMessages
      const m16 = m1.copy();
      m16.polls[pollId].maxValues.maxMessages = m16.polls[pollId].maxValues.maxMessages + 1;
      expect(m1.equals(m16)).not.to.be.true;

      // modify poll.maxValues.maxVoteOptions
      const m17 = m1.copy();
      m17.polls[pollId].maxValues.maxVoteOptions = m17.polls[pollId].maxValues.maxVoteOptions + 1;
      expect(m1.equals(m17)).not.to.be.true;

      // modify poll.messages
      const m20 = m1.copy();
      m20.polls[pollId].messages[0].data[0] = BigInt(m20.polls[pollId].messages[0].data[0]) + BigInt(1);
      expect(m1.equals(m20)).not.to.be.true;

      // modify poll.encPubKeys
      const m21 = m1.copy();
      m21.polls[pollId].encPubKeys[0] = new Keypair().pubKey;
      expect(m1.equals(m21)).not.to.be.true;
    });

    it("should create a JSON object from a MaciState object", () => {
      const json = m1.toJSON();
      writeFileSync(stateFile, JSON.stringify(json, null, 4));
      const content = JSON.parse(readFileSync(stateFile).toString());
      const state = MaciState.fromJSON(content);
      for (const poll of state.polls) {
        poll.setCoordinatorKeypair(coordinatorKeypair.privKey.serialize());
        expect(poll.coordinatorKeypair.equals(coordinatorKeypair)).to.be.true;
      }
      expect(state.equals(m1)).to.be.true;
    });
  });

  describe.only("key changes", () => {
    const user1Keypair = new Keypair();
    const user2Keypair = new Keypair();
    const secondKeyPair = new Keypair();
    let pollId: number = 0;
    let user1StateIndex: number = 0;
    let user2StateIndex: number = 0;
    const user1VoteOptionIndex = BigInt(0);
    const user2VoteOptionIndex = BigInt(1);
    const user1VoteWeight = BigInt(9);
    const user2VoteWeight = BigInt(3);
    const user1NewVoteWeight = BigInt(5);

    describe("only user 1 changes key", () => {
      const maciState: MaciState = new MaciState(STATE_TREE_DEPTH);

      before(() => {
        // Sign up
        user1StateIndex = maciState.signUp(
          user1Keypair.pubKey,
          voiceCreditBalance,
          BigInt(Math.floor(Date.now() / 1000)),
        );
        user2StateIndex = maciState.signUp(
          user2Keypair.pubKey,
          voiceCreditBalance,
          BigInt(Math.floor(Date.now() / 1000)),
        );

        // deploy a poll
        pollId = maciState.deployPoll(
          duration,
          BigInt(Math.floor(Date.now() / 1000) + duration),
          maxValues,
          treeDepths,
          messageBatchSize,
          coordinatorKeypair,
        );
      });
      it("should submit a vote for each user", () => {
        const poll = maciState.polls[pollId];
        const command1 = new PCommand(
          BigInt(user1StateIndex),
          user1Keypair.pubKey,
          user1VoteOptionIndex,
          user1VoteWeight,
          BigInt(1),
          BigInt(pollId),
        );

        const signature1 = command1.sign(user1Keypair.privKey);

        const ecdhKeypair1 = new Keypair();
        const sharedKey1 = Keypair.genEcdhSharedKey(ecdhKeypair1.privKey, coordinatorKeypair.pubKey);

        const message1 = command1.encrypt(signature1, sharedKey1);
        poll.publishMessage(message1, ecdhKeypair1.pubKey);

        const command2 = new PCommand(
          BigInt(user2StateIndex),
          user2Keypair.pubKey,
          user2VoteOptionIndex,
          user2VoteWeight,
          BigInt(1),
          BigInt(pollId),
        );

        const signature2 = command2.sign(user2Keypair.privKey);

        const ecdhKeypair2 = new Keypair();
        const sharedKey2 = Keypair.genEcdhSharedKey(ecdhKeypair2.privKey, coordinatorKeypair.pubKey);

        const message2 = command2.encrypt(signature2, sharedKey2);
        poll.publishMessage(message2, ecdhKeypair2.pubKey);
      });

      it("user1 sends a keychange message with a new vote", () => {
        const poll = maciState.polls[pollId];
        const command = new PCommand(
          BigInt(user1StateIndex),
          secondKeyPair.pubKey,
          user1VoteOptionIndex,
          user1NewVoteWeight,
          BigInt(1),
          BigInt(pollId),
        );

        const signature = command.sign(user1Keypair.privKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privKey, coordinatorKeypair.pubKey);

        const message = command.encrypt(signature, sharedKey);
        poll.publishMessage(message, ecdhKeypair.pubKey);
      });

      it("should perform the processing and tallying correctly", () => {
        const poll = maciState.polls[pollId];
        // Merge the state aq
        maciState.stateAq.mergeSubRoots(0);
        maciState.stateAq.merge(STATE_TREE_DEPTH);

        // Merge the message aq
        poll.messageAq.mergeSubRoots(0);
        poll.messageAq.merge(treeDepths.messageTreeDepth);

        poll.processMessages(pollId);
        poll.tallyVotes();
        expect(poll.perVOSpentVoiceCredits[0].toString()).to.eq((user1NewVoteWeight * user1NewVoteWeight).toString());
        expect(poll.perVOSpentVoiceCredits[1].toString()).to.eq((user2VoteWeight * user2VoteWeight).toString());
      });

      it("should confirm that the user key pair was changed (user's 2 one has not)", () => {
        const poll = maciState.polls[pollId];
        const stateLeaf1 = poll.stateLeaves[user1StateIndex];
        const stateLeaf2 = poll.stateLeaves[user2StateIndex];
        expect(stateLeaf1.pubKey.toString()).to.eq(secondKeyPair.pubKey.toString());
        expect(stateLeaf2.pubKey.toString()).to.eq(user2Keypair.pubKey.toString());
      });
    });
  });
});
