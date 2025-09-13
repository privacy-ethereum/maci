/* eslint-disable no-underscore-dangle */
import {
  EMode,
  MaciState,
  type Poll,
  type IProcessMessagesCircuitInputs,
  type IVoteTallyCircuitInputs,
} from "@maci-protocol/core";
import { NOTHING_UP_MY_SLEEVE } from "@maci-protocol/crypto";
import { Keypair, Message, PublicKey } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type Signer, ZeroAddress } from "ethers";
import { type EthereumProvider } from "hardhat/types";

import { type IVerifyingKeyStruct } from "../ts/types";
import { getDefaultSigner, getBlockTimestamp } from "../ts/utils";
import {
  type Tally,
  type MACI,
  type Poll as PollContract,
  type MessageProcessor,
  type Verifier,
  type VerifyingKeysRegistry,
  MessageProcessor__factory as MessageProcessorFactory,
  Poll__factory as PollFactory,
  Tally__factory as TallyFactory,
  type IBasePolicy,
  type ConstantInitialVoiceCreditProxy,
} from "../typechain-types";

import {
  STATE_TREE_DEPTH,
  duration,
  maxVoteOptions,
  messageBatchSize,
  testProcessVerifyingKey,
  testTallyVerifyingKey,
  treeDepths,
} from "./constants";
import { timeTravel, deployTestContracts } from "./utils";

describe("VoteTallyNonQv", () => {
  let signer: Signer;
  let maciContract: MACI;
  let pollContract: PollContract;
  let tallyContract: Tally;
  let messageProcessorContract: MessageProcessor;
  let verifierContract: Verifier;
  let verifyingKeysRegistryContract: VerifyingKeysRegistry;
  let policyContract: IBasePolicy;
  let initialVoiceCreditProxyContract: ConstantInitialVoiceCreditProxy;
  const coordinator = new Keypair();
  let maciState: MaciState;

  let pollId: bigint;
  let poll: Poll;

  let generatedInputs: IProcessMessagesCircuitInputs;

  before(async () => {
    maciState = new MaciState(STATE_TREE_DEPTH);

    signer = await getDefaultSigner();

    const startTime = await getBlockTimestamp(signer);

    const r = await deployTestContracts({ initialVoiceCreditBalance: 100, stateTreeDepth: STATE_TREE_DEPTH, signer });
    maciContract = r.maciContract;
    verifierContract = r.mockVerifierContract as Verifier;
    verifyingKeysRegistryContract = r.verifyingKeysRegistryContract;
    policyContract = r.policyContract;
    initialVoiceCreditProxyContract = r.constantInitialVoiceCreditProxyContract;

    // deploy a poll
    // deploy on chain poll
    const tx = await maciContract.deployPoll({
      startDate: startTime,
      endDate: startTime + duration,
      treeDepths,
      messageBatchSize,
      coordinatorPublicKey: coordinator.publicKey.asContractParam(),
      verifier: verifierContract,
      verifyingKeysRegistry: verifyingKeysRegistryContract,
      mode: EMode.NON_QV,
      policy: policyContract,
      initialVoiceCreditProxy: initialVoiceCreditProxyContract,
      relayers: [ZeroAddress],
      voteOptions: maxVoteOptions,
    });
    const receipt = await tx.wait();

    expect(receipt?.status).to.eq(1);

    pollId = (await maciContract.nextPollId()) - 1n;

    const pollContracts = await maciContract.getPoll(pollId);
    pollContract = PollFactory.connect(pollContracts.poll, signer);
    messageProcessorContract = MessageProcessorFactory.connect(pollContracts.messageProcessor, signer);
    tallyContract = TallyFactory.connect(pollContracts.tally, signer);

    // deploy local poll
    const deployedPollId = maciState.deployPoll(
      BigInt(startTime + duration),
      treeDepths,
      messageBatchSize,
      coordinator,
      BigInt(maxVoteOptions),
      EMode.NON_QV,
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

    // save the poll
    poll = maciState.polls.get(pollId)!;

    poll.publishMessage(message, padKey);

    // update the poll state
    poll.updatePoll(BigInt(maciState.publicKeys.length));

    // process messages locally
    generatedInputs = poll.processMessages(pollId);

    // set the verification keys on the registry smart contract
    await verifyingKeysRegistryContract.setVerifyingKeys(
      STATE_TREE_DEPTH,
      treeDepths.tallyProcessingStateTreeDepth,
      treeDepths.voteOptionTreeDepth,
      messageBatchSize,
      EMode.NON_QV,
      testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
      testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct,
    );
  });

  it("should not be possible to tally votes before the poll has ended", async () => {
    await expect(tallyContract.tallyVotes(0n, [0, 0, 0, 0, 0, 0, 0, 0])).to.be.revertedWithCustomError(
      tallyContract,
      "ProcessingNotComplete",
    );
  });

  it("tallyVotes() should fail as the messages have not been processed yet", async () => {
    await timeTravel(signer.provider! as unknown as EthereumProvider, duration + 1);
    await expect(tallyContract.tallyVotes(0n, [0, 0, 0, 0, 0, 0, 0, 0])).to.be.revertedWithCustomError(
      tallyContract,
      "ProcessingNotComplete",
    );
  });

  describe("after messages processing", () => {
    let tallyGeneratedInputs: IVoteTallyCircuitInputs;
    before(async () => {
      await pollContract.mergeState();

      tallyGeneratedInputs = poll.tallyVotes();
    });

    it("isTallied should return false", async () => {
      const isTallied = await tallyContract.isTallied();
      expect(isTallied).to.eq(false);
    });

    it("tallyVotes() should update the tally commitment", async () => {
      await messageProcessorContract.processMessages(BigInt(generatedInputs.newSbCommitment), [0, 0, 0, 0, 0, 0, 0, 0]);

      await tallyContract.tallyVotes(BigInt(tallyGeneratedInputs.newTallyCommitment), [0, 0, 0, 0, 0, 0, 0, 0]);

      const onChainNewTallyCommitment = await tallyContract.tallyCommitment();
      expect(tallyGeneratedInputs.newTallyCommitment).to.eq(onChainNewTallyCommitment.toString());
    });

    it("isTallied should return true", async () => {
      const isTallied = await tallyContract.isTallied();
      expect(isTallied).to.eq(true);
    });

    it("should throw error if try to call verifyPerVoteOptionSpentVoiceCredits for non-qv", async () => {
      await expect(
        tallyContract.verifyPerVoteOptionSpentVoiceCredits(0, 0, [], 0, 0, 0, 0),
      ).to.be.revertedWithCustomError(tallyContract, "NotSupported");
    });

    it("tallyVotes() should revert when votes have already been tallied", async () => {
      await expect(
        tallyContract.tallyVotes(BigInt(tallyGeneratedInputs.newTallyCommitment), [0, 0, 0, 0, 0, 0, 0, 0]),
      ).to.be.revertedWithCustomError(tallyContract, "AllBallotsTallied");
    });
  });
});
