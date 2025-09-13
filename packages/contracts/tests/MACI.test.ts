/* eslint-disable no-underscore-dangle */
import { EMode, MaciState } from "@maci-protocol/core";
import { NOTHING_UP_MY_SLEEVE } from "@maci-protocol/crypto";
import { Keypair, PublicKey, Message } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type BigNumberish, type Signer, ZeroAddress } from "ethers";

import { getDefaultSigner, getSigners, getBlockTimestamp } from "../ts/utils";
import {
  type MACI,
  type Verifier,
  type VerifyingKeysRegistry,
  type IBasePolicy,
  type ConstantInitialVoiceCreditProxy,
} from "../typechain-types";

import {
  STATE_TREE_DEPTH,
  duration,
  initialVoiceCreditBalance,
  maxVoteOptions,
  messageBatchSize,
  treeDepths,
} from "./constants";
import { deployTestContracts } from "./utils";

describe("MACI", function test() {
  this.timeout(900000); // 15 minutes

  let maciContract: MACI;
  let verifyingKeysRegistryContract: VerifyingKeysRegistry;
  let verifierContract: Verifier;
  let signuPolicyContract: IBasePolicy;
  let initialVoiceCreditProxy: ConstantInitialVoiceCreditProxy;
  let pollId: bigint;

  const coordinator = new Keypair();
  const users = [new Keypair(), new Keypair(), new Keypair()];

  let signer: Signer;

  const maciState = new MaciState(STATE_TREE_DEPTH);

  describe("Deployment", () => {
    before(async () => {
      signer = await getDefaultSigner();
      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
      });

      maciContract = r.maciContract;
      verifyingKeysRegistryContract = r.verifyingKeysRegistryContract;
      verifierContract = r.mockVerifierContract as Verifier;
      signuPolicyContract = r.policyContract;
      initialVoiceCreditProxy = r.constantInitialVoiceCreditProxyContract;

      await signuPolicyContract.setTarget(await maciContract.getAddress()).then((tx) => tx.wait());
    });

    it("should have set the correct stateTreeDepth", async () => {
      const std = await maciContract.stateTreeDepth();
      expect(std.toString()).to.eq(STATE_TREE_DEPTH.toString());
    });

    it("should be possible to deploy Maci contracts with different state tree depth values", async () => {
      const checkStateTreeDepth = async (stateTreeDepthTest: number): Promise<void> => {
        const { maciContract: testMaci } = await deployTestContracts({
          initialVoiceCreditBalance,
          stateTreeDepth: stateTreeDepthTest,
          signer,
        });
        expect(await testMaci.stateTreeDepth()).to.eq(stateTreeDepthTest);
      };

      await checkStateTreeDepth(1);
      await checkStateTreeDepth(2);
      await checkStateTreeDepth(3);
    });
  });

  describe("Signups", () => {
    it("should sign up multiple users", async () => {
      for (let index = 0; index < users.length; index += 1) {
        const user = users[index];

        // eslint-disable-next-line no-await-in-loop
        const tx = await maciContract.signUp(
          user.publicKey.asContractParam(),
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        );
        // eslint-disable-next-line no-await-in-loop
        const receipt = await tx.wait();
        expect(receipt?.status).to.eq(1);

        // eslint-disable-next-line no-await-in-loop
        const [event] = await maciContract.queryFilter(
          maciContract.filters.SignUp,
          receipt?.blockNumber,
          receipt?.blockNumber,
        );

        expect(event.args._stateIndex.toString()).to.eq((index + 1).toString());

        maciState.signUp(user.publicKey);
      }
    });

    it("should fail when given an invalid publicKey (x >= p)", async () => {
      await expect(
        maciContract.signUp(
          {
            x: "21888242871839275222246405745257275088548364400416034343698204186575808495617",
            y: "0",
          },
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        ),
      ).to.be.revertedWithCustomError(maciContract, "InvalidPublicKey");
    });

    it("should fail when given an invalid publicKey (y >= p)", async () => {
      await expect(
        maciContract.signUp(
          {
            x: "1",
            y: "21888242871839275222246405745257275088548364400416034343698204186575808495617",
          },
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        ),
      ).to.be.revertedWithCustomError(maciContract, "InvalidPublicKey");
    });

    it("should fail when given an invalid publicKey (x >= p and y >= p)", async () => {
      await expect(
        maciContract.signUp(
          {
            x: "21888242871839275222246405745257275088548364400416034343698204186575808495617",
            y: "21888242871839275222246405745257275088548364400416034343698204186575808495617",
          },
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        ),
      ).to.be.revertedWithCustomError(maciContract, "InvalidPublicKey");
    });

    it("should fail when given an invalid public key (not on the curve)", async () => {
      await expect(
        maciContract.signUp(
          {
            x: "1",
            y: "1",
          },
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        ),
      ).to.be.revertedWithCustomError(maciContract, "InvalidPublicKey");
    });

    it("should not allow to sign up more than the supported amount of users (2 ** stateTreeDepth)", async () => {
      const stateTreeDepthTest = 1;
      const maxUsers = 2 ** stateTreeDepthTest;
      const { maciContract: maci, policyContract } = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: stateTreeDepthTest,
        signer,
      });
      await policyContract.setTarget(await maci.getAddress()).then((tx) => tx.wait());
      const keypair = new Keypair();
      // start from one as we already have one signup (blank state leaf)
      for (let i = 1; i < maxUsers; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await maci.signUp(keypair.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1]));
      }

      // the next signup should fail
      await expect(
        maci.signUp(keypair.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1])),
      ).to.be.revertedWithCustomError(maciContract, "TooManySignups");
    });

    it("should signup 2 ** 10 users", async () => {
      const stateTreeDepthTest = 10;
      const maxUsers = 2 ** stateTreeDepthTest;
      const { maciContract: maci, policyContract } = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: stateTreeDepthTest,
        signer,
      });
      await policyContract.setTarget(await maci.getAddress()).then((tx) => tx.wait());

      // start from one as we already have one signup (blank state leaf)
      for (let i = 1; i < maxUsers; i += 1) {
        const keypair = new Keypair();
        // eslint-disable-next-line no-await-in-loop
        await maci.signUp(keypair.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1]));
      }
    });
  });

  describe("getStateIndex", () => {
    it("should return the index of a state leaf", async () => {
      const index = await maciContract.getStateIndex(users[0].publicKey.hash());
      expect(index.toString()).to.eq("1");
    });

    it("should throw when given a public key that is not signed up", async () => {
      await expect(maciContract.getStateIndex(0)).to.be.revertedWithCustomError(maciContract, "UserNotSignedUp");
    });
  });

  describe("Deploy a Poll", () => {
    it("should deploy a poll", async () => {
      const startTime = await getBlockTimestamp(signer);

      // Create the poll and get the poll ID from the tx event logs
      const tx = await maciContract.deployPoll({
        startDate: startTime,
        endDate: startTime + duration,
        treeDepths,
        messageBatchSize,
        coordinatorPublicKey: coordinator.publicKey.asContractParam() as { x: BigNumberish; y: BigNumberish },
        verifier: verifierContract,
        verifyingKeysRegistry: verifyingKeysRegistryContract,
        mode: EMode.QV,
        policy: signuPolicyContract,
        initialVoiceCreditProxy,
        relayers: [ZeroAddress],
        voteOptions: maxVoteOptions,
      });
      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
      pollId = (await maciContract.nextPollId()) - 1n;

      const poll = maciState.deployPoll(
        BigInt(startTime + duration),
        treeDepths,
        messageBatchSize,
        coordinator,
        BigInt(maxVoteOptions),
        EMode.QV,
      );
      expect(poll.toString()).to.eq(pollId.toString());

      // publish the NOTHING_UP_MY_SLEEVE message
      const messageData = [NOTHING_UP_MY_SLEEVE];
      for (let i = 1; i < 10; i += 1) {
        messageData.push(BigInt(0));
      }
      const message = new Message(messageData);
      const padKey = new PublicKey([
        BigInt("10457101036533406547632367118273992217979173478358440826365724437999023779287"),
        BigInt("19824078218392094440610104313265183977899662750282163392862422243483260492317"),
      ]);
      maciState.polls.get(pollId)?.publishMessage(message, padKey);
    });

    it("should allow to deploy a new poll even before the first one is completed", async () => {
      const tx = await maciContract.deployPoll({
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + duration,
        treeDepths,
        messageBatchSize,
        coordinatorPublicKey: coordinator.publicKey.asContractParam() as { x: BigNumberish; y: BigNumberish },
        verifier: verifierContract,
        verifyingKeysRegistry: verifyingKeysRegistryContract,
        mode: EMode.QV,
        policy: signuPolicyContract,
        initialVoiceCreditProxy,
        relayers: [ZeroAddress],
        voteOptions: maxVoteOptions,
      });
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
      expect(await maciContract.nextPollId()).to.eq(2);
    });

    it("should allow any user to deploy a poll", async () => {
      const [, user] = await getSigners();
      const tx = await maciContract.connect(user).deployPoll({
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + duration,
        treeDepths,
        messageBatchSize,
        coordinatorPublicKey: users[0].publicKey.asContractParam() as { x: BigNumberish; y: BigNumberish },
        verifier: verifierContract,
        verifyingKeysRegistry: verifyingKeysRegistryContract,
        mode: EMode.QV,
        policy: signuPolicyContract,
        initialVoiceCreditProxy,
        relayers: [ZeroAddress],
        voteOptions: maxVoteOptions,
      });
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
      expect(await maciContract.nextPollId()).to.eq(3);
    });
  });

  describe("getPoll", () => {
    it("should return an object for a valid id", async () => {
      const pollContracts = await maciContract.getPoll(pollId);
      expect(pollContracts.poll).to.not.eq(ZeroAddress);
      expect(pollContracts.messageProcessor).to.not.eq(ZeroAddress);
      expect(pollContracts.tally).to.not.eq(ZeroAddress);
    });

    it("should throw when given an invalid poll id", async () => {
      await expect(maciContract.getPoll(5)).to.be.revertedWithCustomError(maciContract, "PollDoesNotExist").withArgs(5);
    });
  });
});
