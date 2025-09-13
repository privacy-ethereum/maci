import { VoteCommand, type Message, Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";

import fs from "fs";

import { MaciState } from "../MaciState";
import { EMode, STATE_TREE_DEPTH } from "../utils/constants";
import { type IJsonMaciState } from "../utils/types";

import { coordinatorKeypair, duration, maxVoteOptions, messageBatchSize, treeDepths } from "./utils/constants";

describe("MaciState", function test() {
  this.timeout(100000);

  describe("copy", () => {
    let pollId: bigint;
    let m1: MaciState;
    const userKeypair = new Keypair();
    const stateFile = "./state.json";

    after(() => {
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
    });

    before(() => {
      m1 = new MaciState(STATE_TREE_DEPTH);
      m1.signUp(userKeypair.publicKey);
      pollId = m1.deployPoll(
        BigInt(Math.floor(Date.now() / 1000) + duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );
      const command = new VoteCommand(0n, userKeypair.publicKey, 0n, 0n, 0n, BigInt(pollId), 0n);

      const encKeypair = new Keypair();
      const signature = command.sign(encKeypair.privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(encKeypair.privateKey, coordinatorKeypair.publicKey);
      const message: Message = command.encrypt(signature, sharedKey);

      m1.polls.get(pollId)!.publishMessage(message, encKeypair.publicKey);
      m1.polls.get(pollId)!.publishMessage(message, encKeypair.publicKey);
    });

    it("should correctly deep-copy a MaciState object", () => {
      const m2 = m1.copy();

      // modify stateTreeDepth
      m2.stateTreeDepth += 1;
      expect(m1.equals(m2)).not.to.eq(true);

      // modify user.publicKey
      const m3 = m1.copy();
      m3.publicKeys[0] = new Keypair().publicKey;
      expect(m1.equals(m3)).not.to.eq(true);

      // modify poll.coordinatorKeypair
      const m6 = m1.copy();
      m6.polls.get(pollId)!.coordinatorKeypair = new Keypair();
      expect(m1.equals(m6)).not.to.eq(true);

      // modify poll.treeDepths.tallyProcessingStateTreeDepth
      const m9 = m1.copy();
      m9.polls.get(pollId)!.treeDepths.tallyProcessingStateTreeDepth += 1;
      expect(m1.equals(m9)).not.to.eq(true);

      // modify poll.treeDepths.voteOptionTreeDepth
      const m10 = m1.copy();
      m10.polls.get(pollId)!.treeDepths.voteOptionTreeDepth += 1;
      expect(m1.equals(m10)).not.to.eq(true);

      // modify poll.batchSizes.tallyBatchSize
      const m11 = m1.copy();
      m11.polls.get(pollId)!.batchSizes.tallyBatchSize += 1;
      expect(m1.equals(m11)).not.to.eq(true);

      // modify poll.batchSizes.messageBatchSize
      const m12 = m1.copy();
      m12.polls.get(pollId)!.batchSizes.messageBatchSize += 1;
      expect(m1.equals(m12)).not.to.eq(true);

      // modify poll.maxVoteOptions
      const m13 = m1.copy();
      m13.polls.get(pollId)!.maxVoteOptions += 1;
      expect(m1.equals(m13)).not.to.eq(true);

      // modify poll.messages
      const m14 = m1.copy();
      m14.polls.get(pollId)!.messages[0].data[0] = BigInt(m14.polls.get(pollId)!.messages[0].data[0]) + 1n;
      expect(m1.equals(m14)).not.to.eq(true);

      // modify poll.encryptionPublicKeys
      const m15 = m1.copy();
      m15.polls.get(pollId)!.encryptionPublicKeys[0] = new Keypair().publicKey;
      expect(m1.equals(m15)).not.to.eq(true);
    });

    it("should create a JSON object from a MaciState object", () => {
      const json = m1.toJSON();
      fs.writeFileSync(stateFile, JSON.stringify(json, null, 4));
      const content = JSON.parse(fs.readFileSync(stateFile).toString()) as IJsonMaciState;
      const state = MaciState.fromJSON(content);
      state.polls.forEach((poll) => {
        poll.setCoordinatorKeypair(coordinatorKeypair.privateKey.serialize());
        expect(poll.coordinatorKeypair.equals(coordinatorKeypair)).to.eq(true);
      });
      expect(state.equals(m1)).to.eq(true);
    });
  });

  describe("deployNullPoll ", () => {
    it("should deploy a Poll that is null", () => {
      const maciState = new MaciState(STATE_TREE_DEPTH);
      maciState.deployNullPoll();
      expect(maciState.polls.get(0n)).to.eq(null);
    });
  });
});
