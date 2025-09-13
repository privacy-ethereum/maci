import { poseidon } from "@maci-protocol/crypto";
import { VoteCommand, Keypair, type StateLeaf, PrivateKey, type Ballot } from "@maci-protocol/domainobjs";
import { expect } from "chai";

import { MaciState } from "../MaciState";
import { Poll } from "../Poll";
import { EMode, STATE_TREE_DEPTH, VOTE_OPTION_TREE_ARITY } from "../utils/constants";

import {
  coordinatorKeypair,
  duration,
  maxVoteOptions,
  messageBatchSize,
  treeDepths,
  voiceCreditBalance,
} from "./utils/constants";

describe("Poll", function test() {
  this.timeout(90000);

  describe("processMessage", () => {
    const maciState = new MaciState(STATE_TREE_DEPTH);

    const pollId = maciState.deployPoll(
      BigInt(Math.floor(Date.now() / 1000) + duration),
      treeDepths,
      messageBatchSize,
      coordinatorKeypair,
      maxVoteOptions,
      EMode.QV,
    );

    const nonQvPollId = maciState.deployPoll(
      BigInt(Math.floor(Date.now() / 1000) + duration),
      treeDepths,
      messageBatchSize,
      coordinatorKeypair,
      maxVoteOptions,
      EMode.NON_QV,
    );

    const fullPollId = maciState.deployPoll(
      BigInt(Math.floor(Date.now() / 1000) + duration),
      treeDepths,
      messageBatchSize,
      coordinatorKeypair,
      maxVoteOptions,
      EMode.FULL,
    );

    const poll = maciState.polls.get(pollId)!;
    const nonQvPoll = maciState.polls.get(nonQvPollId)!;
    const fullPoll = maciState.polls.get(fullPollId)!;

    const user1Keypair = new Keypair();
    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    // copy the state from the MaciState ref
    poll.updatePoll(BigInt(maciState.publicKeys.length));
    nonQvPoll.updatePoll(BigInt(maciState.publicKeys.length));
    fullPoll.updatePoll(BigInt(maciState.publicKeys.length));

    const { privateKey } = user1Keypair;
    const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

    const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

    const stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);
    const nonQvStateIndex = nonQvPoll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);
    const fullStateIndex = fullPoll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

    it("should throw if a message has an invalid state index", () => {
      const command = new VoteCommand(
        // invalid state index as it is one more than the number of state leaves
        BigInt(stateIndex + 1),
        pollPublicKey,
        0n,
        1n,
        0n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid state leaf index");
    });

    it("should throw if a message has an invalid nonce", () => {
      const command = new VoteCommand(BigInt(stateIndex), pollPublicKey, 0n, 0n, 0n, BigInt(pollId));

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid nonce");
    });

    it("should throw if a message has an invalid signature", () => {
      const command = new VoteCommand(BigInt(stateIndex), pollPublicKey, 0n, 0n, 0n, BigInt(pollId));

      const signature = command.sign(new PrivateKey(0n));
      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid signature");
    });

    it("should throw if a message consumes more than the available voice credits for a user", () => {
      const command = new VoteCommand(
        BigInt(stateIndex),
        pollPublicKey,
        0n,
        // voice credits spent would be this value ** this value
        BigInt(Math.sqrt(Number.parseInt(voiceCreditBalance.toString(), 10)) + 1),
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("insufficient voice credits");
    });

    it("should throw if a message has an invalid vote option index (>= max vote options)", () => {
      const command = new VoteCommand(
        BigInt(stateIndex),
        pollPublicKey,
        BigInt(VOTE_OPTION_TREE_ARITY ** treeDepths.voteOptionTreeDepth),
        // voice credits spent would be this value ** this value
        1n,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid vote option index");
    });

    it("should throw if a message has an invalid vote option index (< 0)", () => {
      const command = new VoteCommand(BigInt(stateIndex), pollPublicKey, -1n, 1n, 1n, BigInt(pollId));

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid vote option index");
    });

    it("should throw when passed a message that cannot be decrypted (wrong encryptionPublicKey)", () => {
      const command = new VoteCommand(BigInt(stateIndex), pollPublicKey, 0n, 1n, 1n, BigInt(pollId));

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(new Keypair().privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, pollPublicKey);
      }).to.throw("failed decryption due to either wrong encryption public key or corrupted ciphertext");
    });

    it("should throw when passed a corrupted message", () => {
      const command = new VoteCommand(BigInt(stateIndex), pollPublicKey, 0n, 1n, 1n, BigInt(pollId));

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(pollPrivateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      message.data[0] = 0n;

      expect(() => {
        poll.processMessage(message, pollPublicKey);
      }).to.throw("failed decryption due to either wrong encryption public key or corrupted ciphertext");
    });

    it("should throw when going over the voice credit limit (non qv)", () => {
      const command = new VoteCommand(
        // invalid state index as it is one more than the number of state leaves
        BigInt(nonQvStateIndex),
        pollPublicKey,
        0n,
        voiceCreditBalance + 1n,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      nonQvPoll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        nonQvPoll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("insufficient voice credits");
    });

    it("should throw when not all voice credits are spent (full)", () => {
      const command = new VoteCommand(
        // invalid state index as it is one more than the number of state leaves
        BigInt(fullStateIndex),
        pollPublicKey,
        0n,
        voiceCreditBalance - 1n,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      fullPoll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        fullPoll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid voice credits");
    });

    it("should work when submitting a valid message (voteWeight === voiceCreditBalance and non qv)", () => {
      const command = new VoteCommand(
        // invalid state index as it is one more than the number of state leaves
        BigInt(nonQvStateIndex),
        pollPublicKey,
        0n,
        voiceCreditBalance,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      nonQvPoll.publishMessage(message, ecdhKeypair.publicKey);
      nonQvPoll.processMessage(message, ecdhKeypair.publicKey);
    });
  });

  describe("processMessages", () => {
    const maciState = new MaciState(STATE_TREE_DEPTH);
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

    const user1Keypair = new Keypair();
    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    const { privateKey } = user1Keypair;
    const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

    const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

    const stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

    it("should throw if the state has not been copied prior to calling processMessages", () => {
      const tempPoll = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      expect(() => maciState.polls.get(tempPoll)?.processMessages(pollId)).to.throw(
        "You must update the poll with the correct data first",
      );
    });

    it("should succeed even if we send an invalid message", () => {
      const command = new VoteCommand(
        // we only signed up one user so the state index is invalid
        BigInt(stateIndex + 1),
        pollPublicKey,
        0n,
        1n,
        0n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      poll.updatePoll(BigInt(maciState.publicKeys.length));

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid state leaf index");

      // keep this call to complete processing
      // eslint-disable-next-line no-unused-expressions
      expect(() => poll.processMessages(pollId)).to.not.throw;
    });

    it("should throw when called after all messages have been processed", () => {
      while (poll.hasUnprocessedMessages()) {
        poll.processMessages(pollId);
      }
      expect(() => poll.processMessages(pollId)).to.throw("No more messages to process");
    });
  });

  describe("processAllMessages", () => {
    const maciState = new MaciState(STATE_TREE_DEPTH);
    const pollId = maciState.deployPoll(
      BigInt(Math.floor(Date.now() / 1000) + duration),
      treeDepths,
      messageBatchSize,
      coordinatorKeypair,
      maxVoteOptions,
      EMode.QV,
    );

    const poll = maciState.polls.get(pollId)!;

    const user1Keypair = new Keypair();
    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    poll.updatePoll(BigInt(maciState.publicKeys.length));

    const { privateKey } = user1Keypair;
    const { privateKey: pollPrivateKey, publicKey: pollPublicKey } = new Keypair();

    const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

    const stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

    it("it should succeed even if send an invalid message", () => {
      const command = new VoteCommand(
        // we only signed up one user so the state index is invalid
        BigInt(stateIndex + 1),
        pollPublicKey,
        0n,
        1n,
        0n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid state leaf index");

      expect(() => poll.processAllMessages()).to.not.throw();
    });

    it("should return the correct state leaves and ballots", () => {
      const command = new VoteCommand(BigInt(stateIndex + 1), pollPublicKey, 0n, 1n, 0n, BigInt(pollId));

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid state leaf index");

      const { stateLeaves, ballots } = poll.processAllMessages();

      stateLeaves.forEach((leaf: StateLeaf, index: number) =>
        expect(leaf.equals(poll.pollStateLeaves[index])).to.eq(true),
      );
      ballots.forEach((ballot: Ballot, index: number) => expect(ballot.equals(poll.ballots[index])).to.eq(true));
    });

    it("should have processed all messages", () => {
      const command = new VoteCommand(BigInt(stateIndex + 1), pollPublicKey, 0n, 1n, 0n, BigInt(pollId));

      const signature = command.sign(pollPrivateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);

      // publish batch size + 1
      for (let i = 0; i <= messageBatchSize; i += 1) {
        poll.publishMessage(message, ecdhKeypair.publicKey);
      }

      poll.processAllMessages();

      expect(poll.hasUnprocessedMessages()).to.eq(false);
    });
  });

  describe("tallyVotes", () => {
    const maciState = new MaciState(STATE_TREE_DEPTH);
    const pollId = maciState.deployPoll(
      BigInt(Math.floor(Date.now() / 1000) + duration),
      treeDepths,
      messageBatchSize,
      coordinatorKeypair,
      maxVoteOptions,
      EMode.QV,
    );

    const poll = maciState.polls.get(pollId)!;

    const user1Keypair = new Keypair();
    const user2Keypair = new Keypair();

    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    maciState.signUp(user2Keypair.publicKey);

    poll.updatePoll(BigInt(maciState.publicKeys.length));

    const { privateKey: privateKey1 } = user1Keypair;
    const { privateKey: pollPrivateKey, publicKey: pollPublicKey1 } = new Keypair();

    const nullifier1 = poseidon([BigInt(privateKey1.raw.toString())]);

    const stateIndex1 = poll.joinPoll(nullifier1, pollPublicKey1, voiceCreditBalance);

    const { privateKey: privateKey2 } = user2Keypair;
    const { privateKey: pollPrivateKey2, publicKey: pollPublicKey2 } = new Keypair();

    const nullifier2 = poseidon([BigInt(privateKey2.raw.toString())]);

    const voteWeight = 5n;
    const voteOption = 0n;

    const command = new VoteCommand(BigInt(stateIndex1), pollPublicKey1, voteOption, voteWeight, 1n, BigInt(pollId));

    const signature = command.sign(pollPrivateKey);

    const ecdhKeypair = new Keypair();
    const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

    const message = command.encrypt(signature, sharedKey);
    poll.publishMessage(message, ecdhKeypair.publicKey);

    it("should throw if called before all messages have been processed", () => {
      expect(() => poll.tallyVotes()).to.throw("You must process the messages first");
    });

    it("should generate the correct results", () => {
      while (poll.hasUnprocessedMessages()) {
        poll.processAllMessages();
      }

      while (poll.hasUntalliedBallots()) {
        poll.tallyVotes();
      }

      const spentVoiceCredits = poll.totalSpentVoiceCredits;
      const results = poll.tallyResult;
      expect(spentVoiceCredits).to.eq(voteWeight * voteWeight);
      expect(results[Number.parseInt(voteOption.toString(), 10)]).to.eq(voteWeight);
      expect(poll.perVoteOptionSpentVoiceCredits[Number.parseInt(voteOption.toString(), 10)]).to.eq(
        voteWeight * voteWeight,
      );
    });

    it("should generate the correct results (non-qv)", () => {
      // deploy a second poll
      const secondPollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.NON_QV,
      );

      const secondPoll = maciState.polls.get(secondPollId)!;
      secondPoll.updatePoll(BigInt(maciState.publicKeys.length));

      const stateIndex2 = secondPoll.joinPoll(nullifier2, pollPublicKey2, voiceCreditBalance);

      const secondVoteWeight = 10n;
      const secondVoteOption = 1n;

      const secondCommand = new VoteCommand(
        BigInt(stateIndex2),
        pollPublicKey2,
        secondVoteOption,
        secondVoteWeight,
        1n,
        secondPollId,
      );

      const secondSignature = secondCommand.sign(pollPrivateKey2);

      const secondEcdhKeypair = new Keypair();
      const secondSharedKey = Keypair.generateEcdhSharedKey(secondEcdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const secondMessage = secondCommand.encrypt(secondSignature, secondSharedKey);
      secondPoll.publishMessage(secondMessage, secondEcdhKeypair.publicKey);

      secondPoll.processAllMessages();
      secondPoll.tallyVotes();

      const spentVoiceCredits = secondPoll.totalSpentVoiceCredits;
      const results = secondPoll.tallyResult;
      // spent voice credit is not vote weight * vote weight
      expect(spentVoiceCredits).to.eq(secondVoteWeight);
      expect(results[Number.parseInt(secondVoteOption.toString(), 10)]).to.eq(secondVoteWeight);
    });

    it("should generate the correct results (full)", () => {
      // deploy a second poll
      const thirdPollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.FULL,
      );

      const thirdPoll = maciState.polls.get(thirdPollId)!;
      thirdPoll.updatePoll(BigInt(maciState.publicKeys.length));

      const stateIndex2 = thirdPoll.joinPoll(nullifier2, pollPublicKey2, voiceCreditBalance);

      const thirdCommand = new VoteCommand(
        BigInt(stateIndex2),
        pollPublicKey2,
        1n,
        voiceCreditBalance,
        1n,
        thirdPollId,
      );

      const secondSignature = thirdCommand.sign(pollPrivateKey2);

      const secondEcdhKeypair = new Keypair();
      const secondSharedKey = Keypair.generateEcdhSharedKey(secondEcdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const thirdMessage = thirdCommand.encrypt(secondSignature, secondSharedKey);
      thirdPoll.publishMessage(thirdMessage, secondEcdhKeypair.publicKey);

      thirdPoll.processAllMessages();
      thirdPoll.tallyVotes();

      const spentVoiceCredits = thirdPoll.totalSpentVoiceCredits;
      const results = thirdPoll.tallyResult;
      // spent voice credit is not vote weight * vote weight
      expect(spentVoiceCredits).to.eq(voiceCreditBalance);
      expect(results[1]).to.eq(voiceCreditBalance);
    });

    it("should throw when there are no more ballots to tally", () => {
      expect(() => poll.tallyVotes()).to.throw("No more ballots to tally");
    });
  });

  describe("setCoordinatorKeypair", () => {
    it("should update the coordinator's Keypair", () => {
      const maciState = new MaciState(STATE_TREE_DEPTH);
      const pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      const poll = maciState.polls.get(pollId)!;
      const newCoordinatorKeypair = new Keypair();
      poll.setCoordinatorKeypair(newCoordinatorKeypair.privateKey.serialize());
      expect(poll.coordinatorKeypair.privateKey.serialize()).to.deep.eq(newCoordinatorKeypair.privateKey.serialize());
      expect(poll.coordinatorKeypair.publicKey.serialize()).to.deep.eq(newCoordinatorKeypair.publicKey.serialize());
    });
  });

  describe("settotalSignups", () => {
    it("should update the number of signups", () => {
      const maciState = new MaciState(STATE_TREE_DEPTH);
      const pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      maciState.signUp(new Keypair().publicKey);

      const poll = maciState.polls.get(pollId)!;

      poll.updatePoll(BigInt(maciState.publicKeys.length));

      expect(poll.getTotalSignups()).to.eq(2n);

      // update it again
      poll.setTotalSignups(3n);

      expect(poll.getTotalSignups()).to.eq(3n);
    });
  });

  describe("toJSON", () => {
    it("should return the correct JSON", () => {
      const maciState = new MaciState(STATE_TREE_DEPTH);
      const pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      const poll = maciState.polls.get(pollId)!;
      const json = poll.toJSON();

      const pollFromJson = Poll.fromJSON(json, maciState);
      pollFromJson.setCoordinatorKeypair(coordinatorKeypair.privateKey.serialize());
      expect(pollFromJson.equals(poll)).to.eq(true);
    });
  });
});
