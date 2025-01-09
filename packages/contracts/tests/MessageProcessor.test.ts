/* eslint-disable no-underscore-dangle */
import { expect } from "chai";
import { Signer } from "ethers";
import { EthereumProvider } from "hardhat/types";
import { MaciState, Poll, IProcessMessagesCircuitInputs } from "maci-core";
import { NOTHING_UP_MY_SLEEVE } from "maci-crypto";
import { Keypair, Message, PubKey } from "maci-domainobjs";

import { EMode } from "../ts/constants";
import { IVerifyingKeyStruct } from "../ts/types";
import { getDefaultSigner } from "../ts/utils";
import {
  MACI,
  MessageProcessor,
  MessageProcessor__factory as MessageProcessorFactory,
  Verifier,
  VkRegistry,
  SignUpGatekeeper,
  ConstantInitialVoiceCreditProxy,
} from "../typechain-types";

import {
  STATE_TREE_DEPTH,
  duration,
  initialVoiceCreditBalance,
  messageBatchSize,
  testProcessVk,
  testTallyVk,
  treeDepths,
} from "./constants";
import { timeTravel, deployTestContracts } from "./utils";

describe("MessageProcessor", () => {
  // contracts
  let maciContract: MACI;
  let verifierContract: Verifier;
  let vkRegistryContract: VkRegistry;
  let mpContract: MessageProcessor;
  let signupGatekeeperContract: SignUpGatekeeper;
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
    // deploy test contracts
    const r = await deployTestContracts({
      initialVoiceCreditBalance,
      stateTreeDepth: STATE_TREE_DEPTH,
      signer,
    });
    maciContract = r.maciContract;
    signer = await getDefaultSigner();
    verifierContract = r.mockVerifierContract as Verifier;
    vkRegistryContract = r.vkRegistryContract;
    signupGatekeeperContract = r.gatekeeperContract;
    initialVoiceCreditProxyContract = r.constantInitialVoiceCreditProxyContract;

    // deploy on chain poll
    const tx = await maciContract.deployPoll(
      duration,
      treeDepths,
      messageBatchSize,
      coordinator.pubKey.asContractParam(),
      verifierContract,
      vkRegistryContract,
      EMode.QV,
      signupGatekeeperContract,
      initialVoiceCreditProxyContract,
    );
    let receipt = await tx.wait();

    // extract poll id
    expect(receipt?.status).to.eq(1);

    pollId = (await maciContract.nextPollId()) - 1n;

    const pollContracts = await maciContract.getPoll(pollId);
    mpContract = MessageProcessorFactory.connect(pollContracts.messageProcessor, signer);

    const block = await signer.provider!.getBlock(receipt!.blockHash);
    const deployTime = block!.timestamp;

    // deploy local poll
    const p = maciState.deployPoll(BigInt(deployTime + duration), treeDepths, messageBatchSize, coordinator);
    expect(p.toString()).to.eq(pollId.toString());

    const messages = [];
    for (let i = 0; i <= 24; i += 1) {
      const messageData = [NOTHING_UP_MY_SLEEVE];
      for (let j = 1; j < 10; j += 1) {
        messageData.push(BigInt(0));
      }
      messages.push(new Message(messageData));
    }
    const padKey = new PubKey([
      BigInt("10457101036533406547632367118273992217979173478358440826365724437999023779287"),
      BigInt("19824078218392094440610104313265183977899662750282163392862422243483260492317"),
    ]);

    poll = maciState.polls.get(pollId)!;

    for (let i = 0; i <= 24; i += 1) {
      poll.publishMessage(messages[i], padKey);
    }

    // update the poll state
    poll.updatePoll(BigInt(maciState.pubKeys.length));

    generatedInputs = poll.processMessages(pollId);

    // set the verification keys on the vk smart contract
    await vkRegistryContract.setVerifyingKeys(
      STATE_TREE_DEPTH,
      treeDepths.intStateTreeDepth,
      treeDepths.voteOptionTreeDepth,
      messageBatchSize,
      EMode.QV,
      testProcessVk.asContractParam() as IVerifyingKeyStruct,
      testTallyVk.asContractParam() as IVerifyingKeyStruct,
    );
    receipt = await tx.wait();
    expect(receipt?.status).to.eq(1);
  });

  describe("testing with more messages", () => {
    before(async () => {
      await timeTravel(signer.provider! as unknown as EthereumProvider, duration + 1);
    });

    it("processMessages() should update the state and ballot root commitment", async () => {
      // Submit the proof
      const tx = await mpContract.processMessages(BigInt(generatedInputs.newSbCommitment), [0, 0, 0, 0, 0, 0, 0, 0]);

      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);

      const processingComplete = await mpContract.processingComplete();
      expect(processingComplete).to.eq(true);

      const onChainNewSbCommitment = await mpContract.sbCommitment();
      expect(generatedInputs.newSbCommitment).to.eq(onChainNewSbCommitment.toString());
    });
  });
});
