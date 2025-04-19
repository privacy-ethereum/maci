import { poseidon } from "@maci-protocol/crypto";
import { PCommand, Keypair, StateLeaf, PrivateKey, Ballot } from "@maci-protocol/domainobjs";
import { expect } from "chai";

import { MaciState } from "../MaciState";
import { Poll } from "../Poll";
import { STATE_TREE_DEPTH, VOTE_OPTION_TREE_ARITY } from "../utils/constants";

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
    );

    const poll = maciState.polls.get(pollId)!;

    const user1Keypair = new Keypair();
    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    // copy the state from the MaciState ref
    poll.updatePoll(BigInt(maciState.pubKeys.length));

    const { privateKey } = user1Keypair;
    const { privateKey: pollPrivKey, publicKey: pollPublicKey } = new Keypair();

    const nullifier = poseidon([BigInt(privateKey.rawPrivKey.toString())]);

    const stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

    it("should throw if a message has an invalid state index", () => {
      const command = new PCommand(
        // invalid state index as it is one more than the number of state leaves
        BigInt(stateIndex + 1),
        pollPublicKey,
        0n,
        1n,
        0n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid state leaf index");
    });

    it("should throw if a message has an invalid nonce", () => {
      const command = new PCommand(BigInt(stateIndex), pollPublicKey, 0n, 0n, 0n, BigInt(pollId));

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid nonce");
    });

    it("should throw if a message has an invalid signature", () => {
      const command = new PCommand(BigInt(stateIndex), pollPublicKey, 0n, 0n, 0n, BigInt(pollId));

      const signature = command.sign(new PrivateKey(0n));
      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid signature");
    });

    it("should throw if a message consumes more than the available voice credits for a user", () => {
      const command = new PCommand(
        BigInt(stateIndex),
        pollPublicKey,
        0n,
        // voice credits spent would be this value ** this value
        BigInt(Math.sqrt(Number.parseInt(voiceCreditBalance.toString(), 10)) + 1),
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("insufficient voice credits");
    });

    it("should throw if a message has an invalid vote option index (>= max vote options)", () => {
      const command = new PCommand(
        BigInt(stateIndex),
        pollPublicKey,
        BigInt(VOTE_OPTION_TREE_ARITY ** treeDepths.voteOptionTreeDepth),
        // voice credits spent would be this value ** this value
        1n,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid vote option index");
    });

    it("should throw if a message has an invalid vote option index (< 0)", () => {
      const command = new PCommand(BigInt(stateIndex), pollPublicKey, -1n, 1n, 1n, BigInt(pollId));

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid vote option index");
    });

    it("should throw when passed a message that cannot be decrypted (wrong encryptionPublicKey)", () => {
      const command = new PCommand(BigInt(stateIndex), pollPublicKey, 0n, 1n, 1n, BigInt(pollId));

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(new Keypair().privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      expect(() => {
        poll.processMessage(message, pollPublicKey);
      }).to.throw("failed decryption due to either wrong encryption public key or corrupted ciphertext");
    });

    it("should throw when passed a corrupted message", () => {
      const command = new PCommand(BigInt(stateIndex), pollPublicKey, 0n, 1n, 1n, BigInt(pollId));

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(pollPrivKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);

      message.data[0] = 0n;

      expect(() => {
        poll.processMessage(message, pollPublicKey);
      }).to.throw("failed decryption due to either wrong encryption public key or corrupted ciphertext");
    });

    it("should throw when going over the voice credit limit (non qv)", () => {
      const command = new PCommand(
        // invalid state index as it is one more than the number of state leaves
        BigInt(stateIndex),
        pollPublicKey,
        0n,
        voiceCreditBalance + 1n,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("insufficient voice credits");
    });

    it("should work when submitting a valid message (voteWeight === voiceCreditBalance and non qv)", () => {
      const command = new PCommand(
        // invalid state index as it is one more than the number of state leaves
        BigInt(stateIndex),
        pollPublicKey,
        0n,
        voiceCreditBalance,
        1n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      poll.processMessage(message, ecdhKeypair.publicKey);
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
    );

    const poll = maciState.polls.get(pollId)!;
    poll.updatePoll(BigInt(maciState.pubKeys.length));

    const user1Keypair = new Keypair();
    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    const { privateKey } = user1Keypair;
    const { privateKey: pollPrivKey, publicKey: pollPublicKey } = new Keypair();

    const nullifier = poseidon([BigInt(privateKey.rawPrivKey.toString())]);

    const stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

    it("should throw if the state has not been copied prior to calling processMessages", () => {
      const tmpPoll = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
      );

      expect(() => maciState.polls.get(tmpPoll)?.processMessages(pollId)).to.throw(
        "You must update the poll with the correct data first",
      );
    });

    it("should succeed even if we send an invalid message", () => {
      const command = new PCommand(
        // we only signed up one user so the state index is invalid
        BigInt(stateIndex + 1),
        pollPublicKey,
        0n,
        1n,
        0n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);

      poll.publishMessage(message, ecdhKeypair.publicKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      poll.updatePoll(BigInt(maciState.pubKeys.length));

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
    );

    const poll = maciState.polls.get(pollId)!;

    const user1Keypair = new Keypair();
    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    poll.updatePoll(BigInt(maciState.pubKeys.length));

    const { privateKey } = user1Keypair;
    const { privateKey: pollPrivKey, publicKey: pollPublicKey } = new Keypair();

    const nullifier = poseidon([BigInt(privateKey.rawPrivKey.toString())]);

    const stateIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

    it("it should succeed even if send an invalid message", () => {
      const command = new PCommand(
        // we only signed up one user so the state index is invalid
        BigInt(stateIndex + 1),
        pollPublicKey,
        0n,
        1n,
        0n,
        BigInt(pollId),
      );

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const message = command.encrypt(signature, sharedKey);
      poll.publishMessage(message, ecdhKeypair.publicKey);
      expect(() => {
        poll.processMessage(message, ecdhKeypair.publicKey);
      }).to.throw("invalid state leaf index");

      expect(() => poll.processAllMessages()).to.not.throw();
    });

    it("should return the correct state leaves and ballots", () => {
      const command = new PCommand(BigInt(stateIndex + 1), pollPublicKey, 0n, 1n, 0n, BigInt(pollId));

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

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
      const command = new PCommand(BigInt(stateIndex + 1), pollPublicKey, 0n, 1n, 0n, BigInt(pollId));

      const signature = command.sign(pollPrivKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

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
    );

    const poll = maciState.polls.get(pollId)!;

    const user1Keypair = new Keypair();
    const user2Keypair = new Keypair();

    // signup the user
    maciState.signUp(user1Keypair.publicKey);

    maciState.signUp(user2Keypair.publicKey);

    poll.updatePoll(BigInt(maciState.pubKeys.length));

    const { privateKey: privKey1 } = user1Keypair;
    const { privateKey: pollPrivateKey, publicKey: pollPubKey1 } = new Keypair();

    const nullifier1 = poseidon([BigInt(privKey1.rawPrivKey.toString())]);

    const stateIndex1 = poll.joinPoll(nullifier1, pollPubKey1, voiceCreditBalance);

    const { privateKey: privKey2 } = user2Keypair;
    const { privateKey: pollPrivKey2, publicKey: pollPublicKey2 } = new Keypair();

    const nullifier2 = poseidon([BigInt(privKey2.rawPrivKey.toString())]);

    const voteWeight = 5n;
    const voteOption = 0n;

    const command = new PCommand(BigInt(stateIndex1), pollPubKey1, voteOption, voteWeight, 1n, BigInt(pollId));

    const signature = command.sign(pollPrivateKey);

    const ecdhKeypair = new Keypair();
    const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);

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
      expect(poll.perVOSpentVoiceCredits[Number.parseInt(voteOption.toString(), 10)]).to.eq(voteWeight * voteWeight);
    });

    it("should generate the correct results (non-qv)", () => {
      // deploy a second poll
      const secondPollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
      );

      const secondPoll = maciState.polls.get(secondPollId)!;
      secondPoll.updatePoll(BigInt(maciState.pubKeys.length));

      const stateIndex2 = secondPoll.joinPoll(nullifier2, pollPublicKey2, voiceCreditBalance);

      const secondVoteWeight = 10n;
      const secondVoteOption = 1n;

      const secondCommand = new PCommand(
        BigInt(stateIndex2),
        pollPublicKey2,
        secondVoteOption,
        secondVoteWeight,
        1n,
        secondPollId,
      );

      const secondSignature = secondCommand.sign(pollPrivKey2);

      const secondEcdhKeypair = new Keypair();
      const secondSharedKey = Keypair.genEcdhSharedKey(secondEcdhKeypair.privateKey, coordinatorKeypair.publicKey);

      const secondMessage = secondCommand.encrypt(secondSignature, secondSharedKey);
      secondPoll.publishMessage(secondMessage, secondEcdhKeypair.publicKey);

      secondPoll.processAllMessages();
      secondPoll.tallyVotesNonQv();

      const spentVoiceCredits = secondPoll.totalSpentVoiceCredits;
      const results = secondPoll.tallyResult;
      // spent voice credit is not vote weight * vote weight
      expect(spentVoiceCredits).to.eq(secondVoteWeight);
      expect(results[Number.parseInt(secondVoteOption.toString(), 10)]).to.eq(secondVoteWeight);
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
      );

      const poll = maciState.polls.get(pollId)!;
      const newCoordinatorKeypair = new Keypair();
      poll.setCoordinatorKeypair(newCoordinatorKeypair.privateKey.serialize());
      expect(poll.coordinatorKeypair.privateKey.serialize()).to.deep.eq(newCoordinatorKeypair.privateKey.serialize());
      expect(poll.coordinatorKeypair.publicKey.serialize()).to.deep.eq(newCoordinatorKeypair.publicKey.serialize());
    });
  });

  describe("setNumSignups", () => {
    it("should update the number of signups", () => {
      const maciState = new MaciState(STATE_TREE_DEPTH);
      const pollId = maciState.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
      );

      maciState.signUp(new Keypair().publicKey);

      const poll = maciState.polls.get(pollId)!;

      poll.updatePoll(BigInt(maciState.pubKeys.length));

      expect(poll.getNumSignups()).to.eq(2n);

      // update it again
      poll.setNumSignups(3n);

      expect(poll.getNumSignups()).to.eq(3n);
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
      );

      const poll = maciState.polls.get(pollId)!;
      const json = poll.toJSON();

      const pollFromJson = Poll.fromJSON(json, maciState);
      pollFromJson.setCoordinatorKeypair(coordinatorKeypair.privateKey.serialize());
      expect(pollFromJson.equals(poll)).to.eq(true);
    });
  });
});
