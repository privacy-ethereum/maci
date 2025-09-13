/* eslint-disable no-underscore-dangle */
import { EMode, MaciState, type Poll, type IProcessMessagesCircuitInputs } from "@maci-protocol/core";
import { NOTHING_UP_MY_SLEEVE } from "@maci-protocol/crypto";
import { Keypair, Message, PublicKey } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type Signer, ZeroAddress } from "ethers";
import { type EthereumProvider } from "hardhat/types";

import { type IVerifyingKeyStruct } from "../ts/types";
import { getDefaultSigner, getBlockTimestamp } from "../ts/utils";
import {
  type MACI,
  type MessageProcessor,
  type Poll as PollContract,
  MessageProcessor__factory as MessageProcessorFactory,
  Poll__factory as PollFactory,
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
  testProcessVerifyingKey,
  testTallyVerifyingKey,
  treeDepths,
} from "./constants";
import { timeTravel, deployTestContracts } from "./utils";

describe("MessageProcessor", () => {
  // contracts
  let maciContract: MACI;
  let verifierContract: Verifier;
  let verifyingKeysRegistryContract: VerifyingKeysRegistry;
  let messageProcessorContract: MessageProcessor;
  let pollContract: PollContract;
  let signupPolicyContract: IBasePolicy;
  let initialVoiceCreditProxyContract: ConstantInitialVoiceCreditProxy;
  let pollId: bigint;

  // local poll and maci state
  let poll: Poll;
  const maciState = new MaciState(STATE_TREE_DEPTH);

  let signer: Signer;
  let generatedInputs: IProcessMessagesCircuitInputs;
  const coordinator = new Keypair();

  before(async () => {
    signer = await getDefaultSigner();
    const startTime = await getBlockTimestamp(signer);

    // deploy test contracts
    const r = await deployTestContracts({
      initialVoiceCreditBalance,
      stateTreeDepth: STATE_TREE_DEPTH,
      signer,
    });
    maciContract = r.maciContract;
    signer = await getDefaultSigner();
    verifierContract = r.mockVerifierContract as Verifier;
    verifyingKeysRegistryContract = r.verifyingKeysRegistryContract;
    signupPolicyContract = r.policyContract;
    initialVoiceCreditProxyContract = r.constantInitialVoiceCreditProxyContract;

    // deploy on chain poll
    const tx = await maciContract.deployPoll({
      startDate: startTime,
      endDate: startTime + duration,
      treeDepths,
      messageBatchSize,
      coordinatorPublicKey: coordinator.publicKey.asContractParam(),
      verifier: verifierContract,
      verifyingKeysRegistry: verifyingKeysRegistryContract,
      mode: EMode.QV,
      policy: signupPolicyContract,
      initialVoiceCreditProxy: initialVoiceCreditProxyContract,
      relayers: [ZeroAddress],
      voteOptions: maxVoteOptions,
    });
    let receipt = await tx.wait();

    // extract poll id
    expect(receipt?.status).to.eq(1);

    pollId = (await maciContract.nextPollId()) - 1n;

    const pollContracts = await maciContract.getPoll(pollId);
    messageProcessorContract = MessageProcessorFactory.connect(pollContracts.messageProcessor, signer);
    pollContract = PollFactory.connect(pollContracts.poll, signer);
    // deploy local poll
    const deployedPollId = maciState.deployPoll(
      BigInt(startTime + duration),
      treeDepths,
      messageBatchSize,
      coordinator,
      BigInt(maxVoteOptions),
      EMode.QV,
    );
    expect(deployedPollId.toString()).to.eq(pollId.toString());

    const messages = [];
    for (let i = 0; i <= 24; i += 1) {
      const messageData = [NOTHING_UP_MY_SLEEVE];
      for (let j = 1; j < 10; j += 1) {
        messageData.push(BigInt(0));
      }
      messages.push(new Message(messageData));
    }
    const padKey = new PublicKey([
      BigInt("10457101036533406547632367118273992217979173478358440826365724437999023779287"),
      BigInt("19824078218392094440610104313265183977899662750282163392862422243483260492317"),
    ]);

    poll = maciState.polls.get(pollId)!;

    for (let i = 0; i <= 24; i += 1) {
      poll.publishMessage(messages[i], padKey);
    }

    // update the poll state
    poll.updatePoll(BigInt(maciState.publicKeys.length));

    generatedInputs = poll.processMessages(pollId);

    // set the verification keys on the registry smart contract
    await verifyingKeysRegistryContract.setVerifyingKeys(
      STATE_TREE_DEPTH,
      treeDepths.tallyProcessingStateTreeDepth,
      treeDepths.voteOptionTreeDepth,
      messageBatchSize,
      EMode.QV,
      testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
      testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct,
    );
    receipt = await tx.wait();
    expect(receipt?.status).to.eq(1);
  });

  describe("processMessages()", () => {
    it("should fail if the voting period is not over", async () => {
      await expect(
        messageProcessorContract.processMessages(BigInt(generatedInputs.newSbCommitment), [0, 0, 0, 0, 0, 0, 0, 0]),
      ).to.be.revertedWithCustomError(pollContract, "VotingPeriodNotOver");
    });

    it("should update the state and ballot root commitment", async () => {
      await timeTravel(signer.provider! as unknown as EthereumProvider, duration + 1);
      // Submit the proof
      const tx = await messageProcessorContract.processMessages(
        BigInt(generatedInputs.newSbCommitment),
        [0, 0, 0, 0, 0, 0, 0, 0],
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);

      const processingComplete = await messageProcessorContract.processingComplete();
      expect(processingComplete).to.eq(true);

      const onChainNewSbCommitment = await messageProcessorContract.sbCommitment();
      expect(generatedInputs.newSbCommitment).to.eq(onChainNewSbCommitment.toString());
    });

    it("should fail if the messages have already been processed", async () => {
      await expect(
        messageProcessorContract.processMessages(BigInt(generatedInputs.newSbCommitment), [0, 0, 0, 0, 0, 0, 0, 0]),
      ).to.be.revertedWithCustomError(messageProcessorContract, "NoMoreMessages");
    });
  });
});
