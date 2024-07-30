/* eslint-disable no-underscore-dangle */
import { expect } from "chai";
import { Signer } from "ethers";
import { EthereumProvider } from "hardhat/types";
import {
  MaciState,
  Poll,
  packTallyVotesSmallVals,
  IProcessMessagesCircuitInputs,
  ITallyCircuitInputs,
} from "maci-core";
import { NOTHING_UP_MY_SLEEVE } from "maci-crypto";
import { Keypair, Message, PubKey } from "maci-domainobjs";

import { EMode } from "../ts/constants";
import { IVerifyingKeyStruct } from "../ts/types";
import { getDefaultSigner } from "../ts/utils";
import {
  Tally,
  MACI,
  Poll as PollContract,
  MessageProcessor,
  Verifier,
  VkRegistry,
  MessageProcessor__factory as MessageProcessorFactory,
  Poll__factory as PollFactory,
  Tally__factory as TallyFactory,
} from "../typechain-types";

import {
  STATE_TREE_DEPTH,
  duration,
  maxValues,
  messageBatchSize,
  tallyBatchSize,
  testProcessVk,
  testTallyVk,
  treeDepths,
} from "./constants";
import { timeTravel, deployTestContracts } from "./utils";

describe("TallyVotesNonQv", () => {
  let signer: Signer;
  let maciContract: MACI;
  let pollContract: PollContract;
  let tallyContract: Tally;
  let mpContract: MessageProcessor;
  let verifierContract: Verifier;
  let vkRegistryContract: VkRegistry;

  const coordinator = new Keypair();
  let users: Keypair[];
  let maciState: MaciState;

  let pollId: bigint;
  let poll: Poll;

  let generatedInputs: IProcessMessagesCircuitInputs;

  before(async () => {
    maciState = new MaciState(STATE_TREE_DEPTH);

    users = [new Keypair(), new Keypair()];

    signer = await getDefaultSigner();

    const r = await deployTestContracts(100, STATE_TREE_DEPTH, signer, true);
    maciContract = r.maciContract;
    verifierContract = r.mockVerifierContract as Verifier;
    vkRegistryContract = r.vkRegistryContract;

    // deploy a poll
    // deploy on chain poll
    const tx = await maciContract.deployPoll(
      duration,
      treeDepths,
      coordinator.pubKey.asContractParam(),
      verifierContract,
      vkRegistryContract,
      EMode.NON_QV,
      {
        gasLimit: 10000000,
      },
    );
    const receipt = await tx.wait();

    const block = await signer.provider!.getBlock(receipt!.blockHash);
    const deployTime = block!.timestamp;

    expect(receipt?.status).to.eq(1);
    const iface = maciContract.interface;
    const logs = receipt!.logs[receipt!.logs.length - 1];
    const event = iface.parseLog(logs as unknown as { topics: string[]; data: string }) as unknown as {
      args: {
        _pollId: bigint;
        pollAddr: {
          poll: string;
          messageProcessor: string;
          tally: string;
        };
      };
      name: string;
    };
    expect(event.name).to.eq("DeployPoll");

    pollId = event.args._pollId;

    const pollContracts = await maciContract.getPoll(pollId);
    pollContract = PollFactory.connect(pollContracts.poll, signer);
    mpContract = MessageProcessorFactory.connect(event.args.pollAddr.messageProcessor, signer);
    tallyContract = TallyFactory.connect(event.args.pollAddr.tally, signer);

    // deploy local poll
    const p = maciState.deployPoll(BigInt(deployTime + duration), maxValues, treeDepths, messageBatchSize, coordinator);
    expect(p.toString()).to.eq(pollId.toString());
    // publish the NOTHING_UP_MY_SLEEVE message
    const messageData = [NOTHING_UP_MY_SLEEVE];
    for (let i = 1; i < 10; i += 1) {
      messageData.push(BigInt(0));
    }
    const message = new Message(messageData);
    const padKey = new PubKey([
      BigInt("10457101036533406547632367118273992217979173478358440826365724437999023779287"),
      BigInt("19824078218392094440610104313265183977899662750282163392862422243483260492317"),
    ]);

    // save the poll
    poll = maciState.polls.get(pollId)!;

    poll.publishMessage(message, padKey);

    // update the poll state
    poll.updatePoll(BigInt(maciState.stateLeaves.length));

    // process messages locally
    generatedInputs = poll.processMessages(pollId, false);

    // set the verification keys on the vk smart contract
    await vkRegistryContract.setVerifyingKeys(
      STATE_TREE_DEPTH,
      treeDepths.intStateTreeDepth,
      treeDepths.messageTreeDepth,
      treeDepths.voteOptionTreeDepth,
      messageBatchSize,
      EMode.NON_QV,
      testProcessVk.asContractParam() as IVerifyingKeyStruct,
      testTallyVk.asContractParam() as IVerifyingKeyStruct,
      { gasLimit: 1000000 },
    );
  });

  it("should not be possible to tally votes before the poll has ended", async () => {
    await expect(tallyContract.tallyVotes(0, [0, 0, 0, 0, 0, 0, 0, 0])).to.be.revertedWithCustomError(
      tallyContract,
      "VotingPeriodNotPassed",
    );
  });

  it("genTallyVotesPackedVals() should generate the correct value", async () => {
    const onChainPackedVals = BigInt(await tallyContract.genTallyVotesPackedVals(users.length, 0, tallyBatchSize));
    const packedVals = packTallyVotesSmallVals(0, tallyBatchSize, users.length);
    expect(onChainPackedVals.toString()).to.eq(packedVals.toString());
  });

  it("updateSbCommitment() should revert when the messages have not been processed yet", async () => {
    // go forward in time
    await timeTravel(signer.provider! as unknown as EthereumProvider, duration + 1);

    await expect(tallyContract.updateSbCommitment()).to.be.revertedWithCustomError(
      tallyContract,
      "ProcessingNotComplete",
    );
  });

  it("tallyVotes() should fail as the messages have not been processed yet", async () => {
    await expect(tallyContract.tallyVotes(0, [0, 0, 0, 0, 0, 0, 0, 0])).to.be.revertedWithCustomError(
      tallyContract,
      "ProcessingNotComplete",
    );
  });

  describe("after merging acc queues", () => {
    let tallyGeneratedInputs: ITallyCircuitInputs;
    before(async () => {
      await pollContract.mergeMaciState();

      await pollContract.mergeMessageAqSubRoots(0);
      await pollContract.mergeMessageAq();
      tallyGeneratedInputs = poll.tallyVotes();
    });

    it("isTallied should return false", async () => {
      const isTallied = await tallyContract.isTallied();
      expect(isTallied).to.eq(false);
    });

    it("tallyVotes() should update the tally commitment", async () => {
      // do the processing on the message processor contract
      await mpContract.processMessages(generatedInputs.newSbCommitment, [0, 0, 0, 0, 0, 0, 0, 0]);

      await tallyContract.tallyVotes(tallyGeneratedInputs.newTallyCommitment, [0, 0, 0, 0, 0, 0, 0, 0]);

      const onChainNewTallyCommitment = await tallyContract.tallyCommitment();
      expect(tallyGeneratedInputs.newTallyCommitment).to.eq(onChainNewTallyCommitment.toString());
    });

    it("isTallied should return true", async () => {
      const isTallied = await tallyContract.isTallied();
      expect(isTallied).to.eq(true);
    });

    it("should throw error if try to call verifyPerVOSpentVoiceCredits for non-qv", async () => {
      await expect(tallyContract.verifyPerVOSpentVoiceCredits(0, 0, [], 0, 0, 0, 0)).to.be.revertedWithCustomError(
        tallyContract,
        "NotSupported",
      );
    });

    it("tallyVotes() should revert when votes have already been tallied", async () => {
      await expect(
        tallyContract.tallyVotes(tallyGeneratedInputs.newTallyCommitment, [0, 0, 0, 0, 0, 0, 0, 0]),
      ).to.be.revertedWithCustomError(tallyContract, "AllBallotsTallied");
    });
  });
});
