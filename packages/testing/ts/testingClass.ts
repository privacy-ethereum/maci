import { Keypair } from "@maci-protocol/domainobjs";
import {
  EMode,
  extractAllVerifyingKeys,
  generateMaciStateFromContract,
  setVerifyingKeys,
  signup,
  joinPoll,
  deployMaci,
  deployPoll,
  deployVerifyingKeysRegistryContract,
  ContractStorage,
  deployFreeForAllSignUpPolicy,
  deployVerifier,
  deployConstantInitialVoiceCreditProxy,
  deployConstantInitialVoiceCreditProxyFactory,
} from "@maci-protocol/sdk";
import hardhat from "hardhat";

import type { ITestingClassPaths, IContractsData } from "./types";
import type { Signer } from "ethers";

import {
  TALLY_PROCESSING_STATE_TREE_DEPTH,
  MESSAGE_BATCH_SIZE,
  STATE_TREE_DEPTH,
  VOTE_OPTION_TREE_DEPTH,
  DEFAULT_VOTE_OPTIONS,
  DEFAULT_INITIAL_VOICE_CREDITS,
  DEFAULT_SG_DATA,
  DEFAULT_IVCP_DATA,
  POLL_STATE_TREE_DEPTH,
} from "./constants";
import { User } from "./user";

/**
 * A class that represents the testing class used in MACI tests
 * It can be used to deploy and initialize the contracts
 */
export class TestingClass {
  private static INSTANCE?: TestingClass;

  /**
   * Paths to the pollJoining zkey file
   */
  private pollJoiningZkeyPath: string;

  /**
   * Paths to the pollJoined zkey file
   */
  private pollJoinedZkeyPath: string;

  /**
   * Paths to the MessageProcessor zkey file
   */
  private messageProcessorZkeyPath: string;

  /**
   * Paths to the VoteTally zkey file
   */
  private voteTallyZkeyPath: string;

  /**
   * Paths to the poll wasm file
   */
  private pollWasm: string;

  /**
   * Paths to the poll witnessGenerator file
   */
  private pollWitnessGenerator: string;

  /**
   * Paths to the rapidsnark file
   */
  private rapidsnark: string;

  readonly contractsData: IContractsData = {
    initialized: false,
  };

  constructor({
    pollJoiningZkeyPath,
    pollJoinedZkeyPath,
    messageProcessorZkeyPath,
    voteTallyZkeyPath,
    pollWasm,
    pollWitnessGenerator,
    rapidsnark,
  }: ITestingClassPaths) {
    this.pollJoiningZkeyPath = pollJoiningZkeyPath;
    this.pollJoinedZkeyPath = pollJoinedZkeyPath;
    this.messageProcessorZkeyPath = messageProcessorZkeyPath;
    this.voteTallyZkeyPath = voteTallyZkeyPath;
    this.pollWasm = pollWasm;
    this.pollWitnessGenerator = pollWitnessGenerator;
    this.rapidsnark = rapidsnark;
  }

  static async getInstance(paths: ITestingClassPaths): Promise<TestingClass> {
    if (!TestingClass.INSTANCE) {
      TestingClass.INSTANCE = new TestingClass(paths);
      await TestingClass.INSTANCE.contractsInit();
    }

    return TestingClass.INSTANCE;
  }

  static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  static clean(): void {
    const contractStorage = ContractStorage.getInstance();
    contractStorage.cleanup("hardhat");
    contractStorage.cleanup("localhost");
  }

  private async contractsInit(): Promise<void> {
    if (this.contractsData.initialized) {
      return;
    }

    const [signer] = (await hardhat.ethers.getSigners()) as unknown as Signer[];
    const coordinatorKeypair = new Keypair();
    const user = new Keypair();

    const { pollJoiningVerifyingKey, pollJoinedVerifyingKey, processVerifyingKey, tallyVerifyingKey } =
      await extractAllVerifyingKeys({
        pollJoiningZkeyPath: this.pollJoiningZkeyPath,
        pollJoinedZkeyPath: this.pollJoinedZkeyPath,
        messageProcessorZkeyPath: this.messageProcessorZkeyPath,
        voteTallyZkeyPath: this.voteTallyZkeyPath,
      });

    const verifyingKeysRegistry = await deployVerifyingKeysRegistryContract({ signer });
    await setVerifyingKeys({
      verifyingKeysRegistryAddress: verifyingKeysRegistry,
      stateTreeDepth: STATE_TREE_DEPTH,
      tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
      voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
      messageBatchSize: MESSAGE_BATCH_SIZE,
      pollStateTreeDepth: POLL_STATE_TREE_DEPTH,
      pollJoiningVerifyingKey: pollJoiningVerifyingKey!,
      pollJoinedVerifyingKey: pollJoinedVerifyingKey!,
      processMessagesVerifyingKeys: [processVerifyingKey!],
      tallyVotesVerifyingKeys: [tallyVerifyingKey!],
      modes: [EMode.NON_QV],
      signer,
    });

    const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
      {},
      signer,
      true,
    );
    const signupPolicyContractAddress = await signupPolicy.getAddress();

    const [pollPolicy] = await deployFreeForAllSignUpPolicy(
      {
        policy: signupPolicyFactory,
        checker: signupCheckerFactory,
      },
      signer,
      true,
    );
    const pollPolicyContractAddress = await pollPolicy.getAddress();

    const maciAddresses = await deployMaci({
      stateTreeDepth: 10,
      signer,
      signupPolicyAddress: signupPolicyContractAddress,
    });

    const constantInitialVoiceCreditProxyFactory = await deployConstantInitialVoiceCreditProxyFactory(signer, true);
    const initialVoiceCreditProxy = await deployConstantInitialVoiceCreditProxy(
      { amount: DEFAULT_INITIAL_VOICE_CREDITS },
      constantInitialVoiceCreditProxyFactory,
      signer,
    );
    const initialVoiceCreditProxyFactoryAddress = await constantInitialVoiceCreditProxyFactory.getAddress();
    const initialVoiceCreditProxyContractAddress = await initialVoiceCreditProxy.getAddress();

    const verifier = await deployVerifier(signer, true);
    const verifierContractAddress = await verifier.getAddress();

    const startDate = Math.floor(Date.now() / 1000) + 30;

    const { pollContractAddress } = await deployPoll({
      pollStartTimestamp: startDate,
      pollEndTimestamp: startDate + 130,
      tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
      messageBatchSize: MESSAGE_BATCH_SIZE,
      stateTreeDepth: POLL_STATE_TREE_DEPTH,
      voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
      coordinatorPublicKey: coordinatorKeypair.publicKey,
      mode: EMode.NON_QV,
      relayers: [await signer.getAddress()],
      signer,
      verifierContractAddress,
      maciAddress: maciAddresses.maciContractAddress,
      policyContractAddress: pollPolicyContractAddress,
      initialVoiceCreditProxyFactoryAddress,
      initialVoiceCreditProxyContractAddress,
      voteOptions: DEFAULT_VOTE_OPTIONS,
      verifyingKeysRegistryContractAddress: verifyingKeysRegistry,
    });

    await signup({
      maciAddress: maciAddresses.maciContractAddress,
      maciPublicKey: user.publicKey.serialize(),
      sgData: DEFAULT_SG_DATA,
      signer,
    });

    const useWasm = false;

    const { pollStateIndex, voiceCredits } = await joinPoll({
      maciAddress: maciAddresses.maciContractAddress,
      pollId: 0n,
      privateKey: user.privateKey.serialize(),
      pollJoiningZkey: this.pollJoiningZkeyPath,
      pollWasm: this.pollWasm,
      pollWitnessGenerator: this.pollWitnessGenerator,
      rapidsnark: this.rapidsnark,
      signer,
      useWasm,
      sgDataArg: DEFAULT_SG_DATA,
      ivcpDataArg: DEFAULT_IVCP_DATA,
    });

    const maciState = await generateMaciStateFromContract({
      provider: signer.provider!,
      address: maciAddresses.maciContractAddress,
      coordinatorKeypair,
      pollId: 0n,
    });

    this.contractsData.maciState = maciState;
    this.contractsData.maciContractAddress = maciAddresses.maciContractAddress;
    this.contractsData.users = [];
    this.contractsData.users.push(new User(user, [], BigInt(voiceCredits), 0n, BigInt(pollStateIndex)));
    this.contractsData.initialized = true;
    this.contractsData.polls?.push(pollContractAddress);
  }
}
