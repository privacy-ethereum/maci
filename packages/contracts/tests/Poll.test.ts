/* eslint-disable no-await-in-loop */
/* eslint-disable no-underscore-dangle */
import { EMode, MaciState } from "@maci-protocol/core";
import { NOTHING_UP_MY_SLEEVE } from "@maci-protocol/crypto";
import { Keypair, Message, VoteCommand, PublicKey, StateLeaf } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, decodeBase58, encodeBase58, getBytes, hexlify, type Signer, ZeroAddress } from "ethers";
import { type EthereumProvider } from "hardhat/types";

import { deployFreeForAllSignUpPolicy } from "../ts/deploy";
import { type IVerifyingKeyStruct } from "../ts/types";
import { getBlockTimestamp, getDefaultSigner, getSigners } from "../ts/utils";
import {
  Poll__factory as PollFactory,
  type MACI,
  type Poll as PollContract,
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
  testPollJoinedVerifyingKey,
  testPollJoiningVerifyingKey,
  testProcessVerifyingKey,
  testTallyVerifyingKey,
  treeDepths,
} from "./constants";
import { timeTravel, deployTestContracts } from "./utils";

describe("Poll", function test() {
  this.timeout(900000); // 15 minutes

  let maciContract: MACI;
  let pollId: bigint;
  let pollContract: PollContract;
  let verifierContract: Verifier;
  let verifyingKeysRegistryContract: VerifyingKeysRegistry;
  let signupPolicyContract: IBasePolicy;
  let pollPolicyContract: IBasePolicy;
  let initialVoiceCreditProxyContract: ConstantInitialVoiceCreditProxy;
  let signer: Signer;

  const coordinator = new Keypair();

  const maciState = new MaciState(STATE_TREE_DEPTH);

  const NUM_USERS = 3;

  const users = new Array(NUM_USERS).fill(0).map(() => new Keypair());

  describe("deployment", () => {
    before(async () => {
      signer = await getDefaultSigner();

      const startDate = await getBlockTimestamp(signer);

      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
      });
      maciContract = r.maciContract;
      verifierContract = r.mockVerifierContract as Verifier;
      verifyingKeysRegistryContract = r.verifyingKeysRegistryContract;
      signupPolicyContract = r.policyContract;
      initialVoiceCreditProxyContract = r.constantInitialVoiceCreditProxyContract;

      await signupPolicyContract.setTarget(await maciContract.getAddress()).then((tx) => tx.wait());

      for (let i = 0; i < NUM_USERS; i += 1) {
        const user = users[i];
        maciState.signUp(user.publicKey);

        // eslint-disable-next-line no-await-in-loop
        await maciContract.signUp(
          user.publicKey.asContractParam(),
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        );
      }

      [pollPolicyContract] = await deployFreeForAllSignUpPolicy({}, signer, true);

      // deploy on chain poll
      const receipt = await maciContract
        .deployPoll({
          startDate,
          endDate: startDate + duration,
          treeDepths,
          messageBatchSize,
          coordinatorPublicKey: coordinator.publicKey.asContractParam(),
          verifier: verifierContract,
          verifyingKeysRegistry: verifyingKeysRegistryContract,
          mode: EMode.QV,
          policy: pollPolicyContract,
          initialVoiceCreditProxy: initialVoiceCreditProxyContract,
          relayers: [signer],
          voteOptions: maxVoteOptions,
        })
        .then((tx) => tx.wait());

      expect(receipt?.status).to.eq(1);

      pollId = (await maciContract.nextPollId()) - 1n;

      const pollContracts = await maciContract.getPoll(pollId);
      pollContract = PollFactory.connect(pollContracts.poll, signer);

      await pollPolicyContract.setTarget(pollContracts.poll).then((tx) => tx.wait());

      // deploy local poll
      const deployedPollId = maciState.deployPoll(
        BigInt(startDate + duration),
        treeDepths,
        messageBatchSize,
        coordinator,
        BigInt(maxVoteOptions),
        EMode.QV,
      );
      expect(deployedPollId.toString()).to.eq(pollId.toString());
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

      // set the verification keys on the registry smart contract
      await verifyingKeysRegistryContract.setPollJoiningVerifyingKey(
        treeDepths.stateTreeDepth,
        testPollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        { gasLimit: 10000000 },
      );

      // set the verification keys on the registry smart contract
      await verifyingKeysRegistryContract.setPollJoinedVerifyingKey(
        treeDepths.stateTreeDepth,
        testPollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        { gasLimit: 10000000 },
      );

      await verifyingKeysRegistryContract.setVerifyingKeys(
        STATE_TREE_DEPTH,
        treeDepths.tallyProcessingStateTreeDepth,
        treeDepths.voteOptionTreeDepth,
        messageBatchSize,
        EMode.QV,
        testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        { gasLimit: 10000000 },
      );
    });

    it("should have the correct coordinator public key set", async () => {
      const coordinatorPublicKey = await pollContract.coordinatorPublicKey();
      expect(coordinatorPublicKey[0].toString()).to.eq(coordinator.publicKey.raw[0].toString());
      expect(coordinatorPublicKey[1].toString()).to.eq(coordinator.publicKey.raw[1].toString());

      const coordinatorPublicKeyHash = await pollContract.coordinatorPublicKeyHash();
      expect(coordinatorPublicKeyHash.toString()).to.eq(coordinator.publicKey.hash().toString());
    });

    it("should have the correct start date and end date set", async () => {
      const dd = await pollContract.getStartAndEndDate();
      expect(dd[1] - dd[0]).to.eq(BigInt(duration));
    });

    it("should have the correct tree depths set", async () => {
      const td = await pollContract.treeDepths();
      expect(td[0].toString()).to.eq(treeDepths.tallyProcessingStateTreeDepth.toString());
      expect(td[1].toString()).to.eq(treeDepths.voteOptionTreeDepth.toString());
    });

    it("should have numMessages set to 1 (blank message)", async () => {
      const numMessages = await pollContract.numMessages();
      expect(numMessages.toString()).to.eq("1");
    });

    it("should fail when passing an invalid coordinator public key", async () => {
      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
      });
      const testMaciContract = r.maciContract;

      // deploy on chain poll
      await expect(
        testMaciContract.deployPoll({
          startDate: Math.floor(Date.now() / 1000),
          endDate: Math.floor(Date.now() / 1000) + duration,
          treeDepths,
          messageBatchSize,
          coordinatorPublicKey: {
            x: "100",
            y: "1",
          },
          verifier: r.mockVerifierContract as Verifier,
          verifyingKeysRegistry: r.verifyingKeysRegistryContract,
          mode: EMode.QV,
          policy: pollPolicyContract,
          initialVoiceCreditProxy: initialVoiceCreditProxyContract,
          relayers: [ZeroAddress],
          voteOptions: maxVoteOptions,
        }),
      ).to.be.revertedWithCustomError(testMaciContract, "InvalidPublicKey");
    });
  });

  describe("Poll join", () => {
    it("should let users join the poll", async () => {
      const mockProof = [0, 0, 0, 0, 0, 0, 0, 0];

      for (let i = 0; i < NUM_USERS; i += 1) {
        const user = users[i];
        const publicKey = user.publicKey.asContractParam();
        const mockNullifier = AbiCoder.defaultAbiCoder().encode(["uint256"], [i]);

        const response = await pollContract.joinPoll(
          mockNullifier,
          publicKey,
          i,
          mockProof,
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        );
        const receipt = await response.wait();
        const [event] = await pollContract.queryFilter(
          pollContract.filters.PollJoined,
          receipt?.blockNumber,
          receipt?.blockNumber,
        );
        const index = event.args._pollStateIndex;
        const voiceCredits = event.args._voiceCreditBalance;

        expect(receipt!.status).to.eq(1);

        const expectedIndex = maciState.polls
          .get(pollId)
          ?.joinPoll(BigInt(mockNullifier), users[i].publicKey, voiceCredits);

        expect(index).to.eq(expectedIndex);

        // get the index with getStateIndex
        const stateLeaf = new StateLeaf(users[i].publicKey, voiceCredits);

        expect(maciState.polls.get(pollId)?.pollStateLeaves[Number(index)].hash()).to.eq(stateLeaf.hash());
        expect(await pollContract.getStateIndex(stateLeaf.hash())).to.eq(index);
      }
    });

    it("getStateIndex should throw when given a state leaf that doesn't exist", async () => {
      await expect(pollContract.getStateIndex(1)).to.be.revertedWithCustomError(pollContract, "StateLeafNotFound");
    });

    it("should have the correct tree size", async () => {
      const pollStateTree = await pollContract.pollStateTree();
      const size = Number(pollStateTree.numberOfLeaves);
      expect(size).to.eq(maciState.polls.get(pollId)?.pollStateLeaves.length);
    });

    it("should not allow a user to join twice", async () => {
      const mockNullifier = AbiCoder.defaultAbiCoder().encode(["uint256"], [0]);
      const publicKey = users[0].publicKey.asContractParam();
      const mockProof = [0, 0, 0, 0, 0, 0, 0, 0];

      await expect(
        pollContract.joinPoll(
          mockNullifier,
          publicKey,
          0,
          mockProof,
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        ),
      ).to.be.revertedWithCustomError(pollContract, "UserAlreadyJoined");
    });

    it("should not allow to sign up more than the supported amount of users (2 ** stateTreeDepth)", async () => {
      const stateTreeDepthTest = 1;
      const startDate = await getBlockTimestamp(signer);

      const [policyContract] = await deployFreeForAllSignUpPolicy({}, signer, true);

      const receipt = await maciContract
        .deployPoll({
          startDate,
          endDate: startDate + duration,
          treeDepths: { ...treeDepths, stateTreeDepth: stateTreeDepthTest },
          messageBatchSize,
          coordinatorPublicKey: coordinator.publicKey.asContractParam(),
          verifier: verifierContract,
          verifyingKeysRegistry: verifyingKeysRegistryContract,
          mode: EMode.QV,
          policy: policyContract,
          initialVoiceCreditProxy: initialVoiceCreditProxyContract,
          relayers: [signer],
          voteOptions: maxVoteOptions,
        })
        .then((tx) => tx.wait());

      expect(receipt?.status).to.eq(1);

      const id = (await maciContract.nextPollId()) - 1n;

      const pollContracts = await maciContract.getPoll(id);
      const contract = PollFactory.connect(pollContracts.poll, signer);

      await policyContract.setTarget(pollContracts.poll).then((tx) => tx.wait());

      // set the verification keys on the registry smart contract
      await verifyingKeysRegistryContract.setPollJoiningVerifyingKey(
        stateTreeDepthTest,
        testPollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        { gasLimit: 10000000 },
      );

      await verifyingKeysRegistryContract.setPollJoinedVerifyingKey(
        stateTreeDepthTest,
        testPollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        { gasLimit: 10000000 },
      );

      const maxUsers = 2 ** stateTreeDepthTest;
      const mockProof = [0, 0, 0, 0, 0, 0, 0, 0];

      for (let i = 1; i < maxUsers; i += 1) {
        const user = new Keypair();
        const publicKey = user.publicKey.asContractParam();
        const mockNullifier = AbiCoder.defaultAbiCoder().encode(["uint256"], [i]);

        await contract
          .joinPoll(
            mockNullifier,
            publicKey,
            i,
            mockProof,
            AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
            AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
          )
          .then((tx) => tx.wait());
      }

      await expect(
        contract.joinPoll(
          AbiCoder.defaultAbiCoder().encode(["uint256"], [maxUsers]),
          new Keypair().publicKey.asContractParam(),
          maxUsers,
          mockProof,
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
          AbiCoder.defaultAbiCoder().encode(["uint256"], [1]),
        ),
      ).to.be.revertedWithCustomError(contract, "TooManySignups");
    });
  });

  describe("publishMessage", () => {
    const ipfsHash = hexlify(
      getBytes(`0x${decodeBase58("QmXj8v1qbwTqVp9RxkQR29Xjc6g5C1KL2m2gZ9b8t8THHj").toString(16)}`).slice(2),
    );

    before(() => {
      // check base58 to bytes32 conversion is correct
      const array = new Uint8Array([...getBytes("0x1220"), ...getBytes(ipfsHash)]);
      expect(encodeBase58(array)).to.eq("QmXj8v1qbwTqVp9RxkQR29Xjc6g5C1KL2m2gZ9b8t8THHj");
    });

    it("should publish a message to the Poll contract", async () => {
      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);

      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      const tx = await pollContract.publishMessage(message.asContractParam(), users[0].publicKey.asContractParam());
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);

      maciState.polls.get(pollId)?.publishMessage(message, users[0].publicKey);
    });

    it("should throw when the encryptionPublicKey is not a point on the baby jubjub curve", async () => {
      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);

      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      await expect(
        pollContract.publishMessage(message.asContractParam(), {
          x: "1",
          y: "1",
        }),
      ).to.be.revertedWithCustomError(pollContract, "InvalidPublicKey");
    });

    it("should emit an event when publishing a message", async () => {
      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);

      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      expect(await pollContract.publishMessage(message.asContractParam(), users[0].publicKey.asContractParam()))
        .to.emit(pollContract, "PublishMessage")
        .withArgs(message.asContractParam(), users[0].publicKey.asContractParam());

      maciState.polls.get(pollId)?.publishMessage(message, users[0].publicKey);
    });

    it("should allow to publish a message batch", async () => {
      const messages: [Message, PublicKey][] = [];
      for (let i = 0; i < 2; i += 1) {
        const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, BigInt(i));
        const signature = command.sign(users[0].privateKey);
        const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
        const message = command.encrypt(signature, sharedKey);
        messages.push([message, users[0].publicKey]);
      }

      const tx = await pollContract.publishMessageBatch(
        messages.map(([m]) => m.asContractParam()),
        messages.map(([, k]) => k.asContractParam()),
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);

      messages.forEach(([message, key]) => {
        maciState.polls.get(pollId)?.publishMessage(message, key);
      });
    });

    it("should allow to relay a messages batch", async () => {
      const messages: [Message, PublicKey][] = [];
      for (let i = 0; i < 2; i += 1) {
        const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, BigInt(i));
        const signature = command.sign(users[0].privateKey);
        const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
        const message = command.encrypt(signature, sharedKey);
        messages.push([message, users[0].publicKey]);
      }

      const messageHashes = await Promise.all(
        messages.map(([message, publicKey]) =>
          pollContract.hashMessageAndPublicKey(message.asContractParam(), publicKey.asContractParam()),
        ),
      );

      const tx = await pollContract.relayMessagesBatch(messageHashes, ipfsHash);
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);

      messages.forEach(([message, key]) => {
        maciState.polls.get(pollId)?.publishMessage(message, key);
      });
    });

    it("should throw an error if non-relayer tries to relay messages batch", async () => {
      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);
      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      const messageHash = await pollContract.hashMessageAndPublicKey(
        message.asContractParam(),
        users[0].publicKey.asContractParam(),
      );

      const [, user] = await getSigners();

      await expect(
        pollContract.connect(user).relayMessagesBatch([messageHash], ipfsHash),
      ).to.be.revertedWithCustomError(pollContract, "NotRelayer");
    });

    it("should throw when the message batch has messages length != encryptionPublicKeys length", async () => {
      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);
      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      await expect(
        pollContract.publishMessageBatch(
          [message.asContractParam(), message.asContractParam()],
          [users[0].publicKey.asContractParam()],
        ),
      ).to.be.revertedWithCustomError(pollContract, "InvalidBatchLength");
    });

    it("should not allow to publish a message after the voting period ends", async () => {
      const sd = await pollContract.startDate();
      await timeTravel(signer.provider as unknown as EthereumProvider, Number(sd) + 10);

      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);

      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);

      await expect(
        pollContract.publishMessage(message.asContractParam(), users[0].publicKey.asContractParam()),
      ).to.be.revertedWithCustomError(pollContract, "VotingPeriodOver");
    });

    it("should not allow to publish a message batch after the voting period ends", async () => {
      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);
      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      await expect(
        pollContract.publishMessageBatch([message.asContractParam()], [users[0].publicKey.asContractParam()]),
      ).to.be.revertedWithCustomError(pollContract, "VotingPeriodOver");
    });

    it("should not allow to relay a messages batch after the voting period ends", async () => {
      const command = new VoteCommand(1n, users[0].publicKey, 0n, 9n, 1n, pollId, 0n);
      const signature = command.sign(users[0].privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(users[0].privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      const messageHash = await pollContract.hashMessageAndPublicKey(
        message.asContractParam(),
        users[0].publicKey.asContractParam(),
      );

      await expect(pollContract.relayMessagesBatch([messageHash], ipfsHash)).to.be.revertedWithCustomError(
        pollContract,
        "VotingPeriodOver",
      );
    });
  });

  describe("Message hash chain", () => {
    it("should correctly compute chain hash and batch hashes array", async () => {
      const currentChainHash = await pollContract.chainHash();
      const currentBatchHashes = await pollContract.getBatchHashes();

      expect(currentChainHash).to.eq(maciState.polls.get(pollId)?.chainHash);
      expect(currentBatchHashes).to.deep.equal(maciState.polls.get(pollId)?.batchHashes);
    });

    it("should correctly pad batch hash array with zeros", async () => {
      await pollContract.padLastBatch();
      maciState.polls.get(pollId)?.padLastBatch();

      expect(await pollContract.chainHash()).to.eq(maciState.polls.get(pollId)?.chainHash);
      expect(await pollContract.getBatchHashes()).to.deep.eq(maciState.polls.get(pollId)?.batchHashes);
    });
  });

  describe("Merge state", () => {
    it("should allow a Poll contract to merge the state tree (calculate the state root)", async () => {
      await timeTravel(signer.provider as unknown as EthereumProvider, Number(duration) + 1);

      const tx = await pollContract.mergeState();

      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);

      expect(await pollContract.stateMerged()).to.eq(true);
    });

    it("should get the correct totalSignups", async () => {
      const totalSignups = await pollContract.totalSignups();
      expect(totalSignups).to.be.eq(maciState.polls.get(pollId)?.pollStateLeaves.length);
      maciState.polls.get(pollId)?.updatePoll(totalSignups);
    });

    it("should get the correct mergedStateRoot", async () => {
      const mergedStateRoot = await pollContract.mergedStateRoot();

      expect(mergedStateRoot.toString()).to.eq(maciState.polls.get(pollId)?.pollStateTree?.root.toString());
    });
  });
});
