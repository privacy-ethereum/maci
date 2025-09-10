import { VerifyingKey } from "@maci-protocol/domainobjs";
import {
  ContractStorage,
  EPolicies,
  VerifyingKeysRegistry__factory as VerifyingKeysRegistryFactory,
  MessageProcessor__factory as MessageProcessorFactory,
  Tally__factory as TallyFactory,
  Poll__factory as PollFactory,
  MACI__factory as MACIFactory,
  EContracts,
  EInitialVoiceCreditProxies,
  EMode,
  deployPoll,
  ISetVerifyingKeysArgs,
  extractAllVerifyingKeys,
  deployConstantInitialVoiceCreditProxy,
  deployFreeForAllSignUpPolicy,
  deployERC20VotesPolicy,
  deployAnonAadhaarPolicy,
  deploySignupTokenPolicy,
  deployMerkleProofPolicy,
  deploySemaphoreSignupPolicy,
  deployZupassSignUpPolicy,
  deployGitcoinPassportPolicy,
  deployEASSignUpPolicy,
  deployHatsSignupPolicy,
  BasePolicy,
  deployMaci,
  setVerifyingKeys,
  deployVerifyingKeysRegistryContract,
  ConstantInitialVoiceCreditProxy,
  generateEmptyBallotRoots,
  getDeployedPolicyProxyFactories,
  AnonAadhaarCheckerFactory,
  AnonAadhaarPolicyFactory,
  deployVerifier,
  EASCheckerFactory,
  EASPolicyFactory,
  ECheckerFactories,
  EPolicyFactories,
  ERC20PolicyFactory,
  ERC20VotesCheckerFactory,
  FreeForAllCheckerFactory,
  FreeForAllPolicyFactory,
  GitcoinPassportCheckerFactory,
  GitcoinPassportPolicyFactory,
  HatsCheckerFactory,
  HatsPolicyFactory,
  MerkleProofCheckerFactory,
  MerkleProofPolicyFactory,
  SemaphoreCheckerFactory,
  SemaphorePolicyFactory,
  TokenCheckerFactory,
  TokenPolicyFactory,
  ZupassCheckerFactory,
  ZupassPolicyFactory,
  deployConstantInitialVoiceCreditProxyFactory,
  ConstantInitialVoiceCreditProxyFactory,
  EInitialVoiceCreditProxiesFactories,
  ESupportedChains,
  BaseChecker,
  ECheckers,
} from "@maci-protocol/sdk";
import { Injectable } from "@nestjs/common";
import { BaseContract, Signer } from "ethers";
import { type Hex } from "viem";

import { ErrorCodes } from "../common";
import { getCoordinatorKeypair } from "../common/coordinatorKeypair";
import { FileService } from "../file/file.service";
import { SessionKeysService } from "../sessionKeys/sessionKeys.service";

import {
  IDeployMaciArgs,
  IDeployPollArgs,
  IInitialVoiceCreditProxyArgs,
  IAnonAadhaarCheckerArgs,
  IEASCheckerArgs,
  IGitcoinPassportCheckerArgs,
  IHatsCheckerArgs,
  IZupassCheckerArgs,
  ISemaphoreCheckerArgs,
  IMerkleProofCheckerArgs,
  ITokenCheckerArgs,
  IERC20VotesCheckerArgs,
  IVerifyingKeysRegistryArgs,
  IDeployPolicyConfig,
} from "./types";

/**
 * DeployerService is responsible for deploying contracts.
 */
@Injectable()
export class DeployerService {
  /**
   * Contract storage instance
   */
  private readonly storage: ContractStorage;

  /**
   * Create a new instance of DeployerService
   *
   * @param fileService - file service
   */
  constructor(
    private readonly sessionKeysService: SessionKeysService,
    private readonly fileService: FileService,
  ) {
    this.storage = ContractStorage.getInstance();
  }

  /**
   * Get the policy contract object
   * always deploy and save it
   *
   * @param signer - the signer
   * @param network - the network
   * @param policyConfig - the policy configuration parameters
   * @returns - the policy contract
   */
  async deployAndSavePolicy(
    signer: Signer,
    network: ESupportedChains,
    policyConfig: IDeployPolicyConfig,
  ): Promise<BasePolicy> {
    let policyContract: BasePolicy;
    let checkerContract: BaseChecker;
    let policyFactory: BaseContract;
    let checkFactory: BaseContract;

    let policyFactoryName: EPolicyFactories;
    let checkFactoryName: ECheckerFactories;

    let factoryIsSaved: boolean;
    let checkerIsSaved: boolean;

    const { policyType, checkerType, args } = policyConfig;

    // based on the policy type, we need to deploy the correct policy
    switch (policyType) {
      case EPolicies.FreeForAll: {
        policyFactoryName = EPolicyFactories.FreeForAll;
        checkFactoryName = ECheckerFactories.FreeForAll;

        const factories = await getDeployedPolicyProxyFactories<FreeForAllCheckerFactory, FreeForAllPolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployFreeForAllSignUpPolicy(
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.EAS: {
        policyFactoryName = EPolicyFactories.EAS;
        checkFactoryName = ECheckerFactories.EAS;

        const factories = await getDeployedPolicyProxyFactories<EASCheckerFactory, EASPolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployEASSignUpPolicy(
          {
            eas: (args as IEASCheckerArgs).easAddress,
            attester: (args as IEASCheckerArgs).attester,
            schema: (args as IEASCheckerArgs).schema,
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.GitcoinPassport: {
        policyFactoryName = EPolicyFactories.GitcoinPassport;
        checkFactoryName = ECheckerFactories.GitcoinPassport;

        const factories = await getDeployedPolicyProxyFactories<
          GitcoinPassportCheckerFactory,
          GitcoinPassportPolicyFactory
        >({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployGitcoinPassportPolicy(
          {
            decoderAddress: (args as IGitcoinPassportCheckerArgs).decoderAddress,
            minimumScore: Number((args as IGitcoinPassportCheckerArgs).passingScore),
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.Hats: {
        policyFactoryName = EPolicyFactories.Hats;
        checkFactoryName = ECheckerFactories.Hats;

        const factories = await getDeployedPolicyProxyFactories<HatsCheckerFactory, HatsPolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployHatsSignupPolicy(
          {
            hats: (args as IHatsCheckerArgs).hatsProtocolAddress,
            criterionHats: (args as IHatsCheckerArgs).critrionHats.map((c) => BigInt(c)),
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.Zupass: {
        policyFactoryName = EPolicyFactories.Zupass;
        checkFactoryName = ECheckerFactories.Zupass;

        const factories = await getDeployedPolicyProxyFactories<ZupassCheckerFactory, ZupassPolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployZupassSignUpPolicy(
          {
            eventId: (args as IZupassCheckerArgs).eventId,
            signer1: (args as IZupassCheckerArgs).signer1,
            signer2: (args as IZupassCheckerArgs).signer2,
            verifier: (args as IZupassCheckerArgs).zupassVerifier,
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.Semaphore: {
        policyFactoryName = EPolicyFactories.Semaphore;
        checkFactoryName = ECheckerFactories.Semaphore;

        const factories = await getDeployedPolicyProxyFactories<SemaphoreCheckerFactory, SemaphorePolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deploySemaphoreSignupPolicy(
          {
            semaphore: (args as ISemaphoreCheckerArgs).semaphoreContract,
            groupId: BigInt((args as ISemaphoreCheckerArgs).groupId),
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.MerkleProof: {
        policyFactoryName = EPolicyFactories.MerkleProof;
        checkFactoryName = ECheckerFactories.MerkleProof;

        const factories = await getDeployedPolicyProxyFactories<MerkleProofCheckerFactory, MerkleProofPolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployMerkleProofPolicy(
          {
            root: (args as IMerkleProofCheckerArgs).root,
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.Token: {
        policyFactoryName = EPolicyFactories.Token;
        checkFactoryName = ECheckerFactories.Token;

        const factories = await getDeployedPolicyProxyFactories<TokenCheckerFactory, TokenPolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deploySignupTokenPolicy(
          {
            token: (args as ITokenCheckerArgs).token,
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.AnonAadhaar: {
        policyFactoryName = EPolicyFactories.AnonAadhaar;
        checkFactoryName = ECheckerFactories.AnonAadhaar;

        const factories = await getDeployedPolicyProxyFactories<AnonAadhaarCheckerFactory, AnonAadhaarPolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployAnonAadhaarPolicy(
          {
            verifierAddress: (args as IAnonAadhaarCheckerArgs).verifier,
            nullifierSeed: (args as IAnonAadhaarCheckerArgs).nullifierSeed,
          },
          factories,
          signer,
          true,
        );
        break;
      }
      case EPolicies.ERC20Votes: {
        policyFactoryName = EPolicyFactories.ERC20Votes;
        checkFactoryName = ECheckerFactories.ERC20Votes;

        const factories = await getDeployedPolicyProxyFactories<ERC20VotesCheckerFactory, ERC20PolicyFactory>({
          policy: policyFactoryName,
          checker: checkFactoryName,
          network,
          signer,
        });

        factoryIsSaved = !!factories.policy;
        checkerIsSaved = !!factories.checker;

        [policyContract, checkerContract, policyFactory, checkFactory] = await deployERC20VotesPolicy(
          {
            snapshotBlock: BigInt((args as IERC20VotesCheckerArgs).snapshotBlock),
            threshold: BigInt((args as IERC20VotesCheckerArgs).threshold),
            token: (args as IERC20VotesCheckerArgs).token,
          },
          factories,
          signer,
          true,
        );
        break;
      }

      default:
        throw new Error(ErrorCodes.UNSUPPORTED_POLICY.toString());
    }

    await this.storage.register<EPolicies>({
      id: policyType,
      name: policyType,
      contract: policyContract,
      args: [await checkerContract.getAddress()],
      network,
    });

    await this.storage.register<ECheckers>({
      id: checkerType,
      name: checkerType,
      contract: checkerContract,
      args: args ? Object.values(args).map((arg) => String(arg)) : [],
      network,
    });

    if (!factoryIsSaved) {
      await this.storage.register<EPolicyFactories>({
        id: policyFactoryName,
        name: policyFactoryName,
        contract: policyFactory,
        network,
      });
    }

    if (!checkerIsSaved) {
      await this.storage.register<ECheckerFactories>({
        id: checkFactoryName,
        name: checkFactoryName,
        contract: checkFactory,
        network,
      });
    }

    return policyContract;
  }

  /**
   * Get the voice credit proxy factory contract object
   * always deploy and save it
   *
   * @param signer - the signer
   * @param voiceCreditProxyFactoryType - the voice credit proxy factory type
   * @param network - the network
   * @returns - the voice credit proxy factory contract
   */
  async deployAndSaveVoiceCreditProxyFactory(
    signer: Signer,
    voiceCreditProxyFactoryType: EInitialVoiceCreditProxiesFactories,
    network: ESupportedChains,
  ): Promise<ConstantInitialVoiceCreditProxyFactory> {
    let contract: ConstantInitialVoiceCreditProxyFactory;

    switch (voiceCreditProxyFactoryType) {
      case EInitialVoiceCreditProxiesFactories.Constant: {
        contract = await deployConstantInitialVoiceCreditProxyFactory(signer, true);
        break;
      }
      default:
        throw new Error(ErrorCodes.UNSUPPORTED_VOICE_CREDIT_PROXY_FACTORY.toString());
    }

    this.storage.register({
      id: voiceCreditProxyFactoryType,
      contract,
      args: [],
      network,
    });

    return contract;
  }

  /**
   * Get the voice credit proxy contract object
   * always deploy and save it
   *
   * @param signer - the signer
   * @param voiceCreditProxyType - the voice credit proxy type
   * @param network - the network
   * @param initialVoiceCreditProxyFactory - the initial voice credit proxy factory
   * @param args - the args
   * @returns - the voice credit proxy contract
   */
  async deployAndSaveVoiceCreditProxy(
    signer: Signer,
    voiceCreditProxyType: EInitialVoiceCreditProxies,
    network: ESupportedChains,
    initialVoiceCreditProxyFactory: ConstantInitialVoiceCreditProxyFactory,
    args?: IInitialVoiceCreditProxyArgs,
  ): Promise<ConstantInitialVoiceCreditProxy> {
    let contract: ConstantInitialVoiceCreditProxy;

    switch (voiceCreditProxyType) {
      case EInitialVoiceCreditProxies.Constant: {
        contract = await deployConstantInitialVoiceCreditProxy(
          {
            amount: args!.amount,
          },
          initialVoiceCreditProxyFactory,
          signer,
        );
        break;
      }
      default:
        throw new Error(ErrorCodes.UNSUPPORTED_VOICE_CREDIT_PROXY.toString());
    }

    await this.storage.register({
      id: voiceCreditProxyType,
      contract,
      args: args ? Object.values(args).map((arg) => String(arg)) : [],
      network,
    });

    return contract;
  }

  /**
   * Get verifying keys arguments (specially zkey paths)
   * @param signer - the signer
   * @param verifyingKeysRegistryContract - the deployed verifyingKey registry contract
   * @param verifyingKeysRegistryArgs - the arguments send to the endpoint
   * @param mode - use QV or NON_QV
   * @returns SetVerifyingKeysArgs
   */
  async getVerifyingKeysArgs(
    signer: Signer,
    verifyingKeysRegistryAddress: Hex,
    verifyingKeysRegistryArgs: IVerifyingKeysRegistryArgs,
    modes: EMode[],
  ): Promise<ISetVerifyingKeysArgs> {
    const { zkey: pollJoiningZkeyPath } = this.fileService.getZkeyFilePaths(
      process.env.COORDINATOR_POLL_JOINING_ZKEY_NAME!,
    );

    const { zkey: pollJoinedZkeyPath } = this.fileService.getZkeyFilePaths(
      process.env.COORDINATOR_POLL_JOINED_ZKEY_NAME!,
    );

    const { pollJoiningVerifyingKey, pollJoinedVerifyingKey } = await extractAllVerifyingKeys({
      pollJoiningZkeyPath,
      pollJoinedZkeyPath,
    });

    const processAndTallyVerifyingKeys = await Promise.all(
      modes.map(async (mode) => {
        const { zkey: messageProcessorZkeyPath } = this.fileService.getZkeyFilePaths(
          process.env.COORDINATOR_MESSAGE_PROCESS_ZKEY_NAME!,
          mode,
        );

        // There are only QV and Non-QV modes available for tally circuit
        const { zkey: voteTallyZkeyPath } = this.fileService.getZkeyFilePaths(
          process.env.COORDINATOR_TALLY_ZKEY_NAME!,
          // if FULL use NON_QV because there are only VoteTallyQV and VoteTallyNonQV zkeys
          mode === EMode.FULL ? EMode.NON_QV : mode,
        );

        const { processVerifyingKey, tallyVerifyingKey } = await extractAllVerifyingKeys({
          messageProcessorZkeyPath,
          voteTallyZkeyPath,
        });

        return { processVerifyingKey: processVerifyingKey!, tallyVerifyingKey: tallyVerifyingKey! };
      }),
    );

    const processVerifyingKeys: VerifyingKey[] = processAndTallyVerifyingKeys.map((item) => item.processVerifyingKey);
    const tallyVerifyingKeys: VerifyingKey[] = processAndTallyVerifyingKeys.map((item) => item.tallyVerifyingKey);

    const { stateTreeDepth, pollStateTreeDepth, tallyProcessingStateTreeDepth, voteOptionTreeDepth, messageBatchSize } =
      verifyingKeysRegistryArgs;

    return {
      pollJoiningVerifyingKey: pollJoiningVerifyingKey!,
      pollJoinedVerifyingKey: pollJoinedVerifyingKey!,
      processMessagesVerifyingKeys: processVerifyingKeys,
      tallyVotesVerifyingKeys: tallyVerifyingKeys,
      stateTreeDepth: Number(stateTreeDepth),
      tallyProcessingStateTreeDepth: Number(tallyProcessingStateTreeDepth),
      voteOptionTreeDepth: Number(voteOptionTreeDepth),
      messageBatchSize: Number(messageBatchSize),
      pollStateTreeDepth: Number(pollStateTreeDepth),
      signer,
      modes,
      verifyingKeysRegistryAddress,
    };
  }

  /**
   * Deploy MACI contracts
   *
   * @param args - deploy maci arguments
   * @param options - ws hooks
   * @returns - deployed maci contract
   * @returns the address of the deployed maci contract
   */
  async deployMaci({ approval, sessionKeyAddress, chain, config }: IDeployMaciArgs): Promise<{ address: string }> {
    const signer = await this.sessionKeysService.getCoordinatorSigner(chain, sessionKeyAddress, approval);

    const policyContract = await this.deployAndSavePolicy(signer, chain, config.policy);
    const policyAddress = await policyContract.getAddress();

    const verifierContract = await deployVerifier(signer, true);

    const verifyingKeysRegistryAddress = await deployVerifyingKeysRegistryContract({ signer });

    const verifyingKeysArgs = await this.getVerifyingKeysArgs(
      signer,
      verifyingKeysRegistryAddress as Hex,
      config.VerifyingKeysRegistry.args,
      config.MACI.modes,
    );
    await setVerifyingKeys(verifyingKeysArgs);

    // deploy the smart contracts
    const maciAddresses = await deployMaci({
      stateTreeDepth: config.MACI.stateTreeDepth,
      signer,
      signupPolicyAddress: policyAddress,
      poseidonAddresses: config.Poseidon,
    });

    // store the contracts
    await Promise.all([
      this.storage.register({
        id: EContracts.Verifier,
        contract: verifierContract,
        network: chain,
      }),
      this.storage.register({
        id: EContracts.VerifyingKeysRegistry,
        contract: new BaseContract(verifyingKeysRegistryAddress, VerifyingKeysRegistryFactory.abi),
        network: chain,
      }),
      this.storage.register({
        id: EContracts.MACI,
        contract: new BaseContract(maciAddresses.maciContractAddress, MACIFactory.abi),
        args: [
          maciAddresses.pollFactoryContractAddress,
          maciAddresses.messageProcessorFactoryContractAddress,
          maciAddresses.tallyFactoryContractAddress,
          policyAddress,
          config.MACI.stateTreeDepth,
          generateEmptyBallotRoots(config.MACI.stateTreeDepth).map((root) => root.toString()),
        ],
        network: chain,
      }),
    ]);

    return { address: maciAddresses.maciContractAddress };
  }

  /**
   * Deploy a poll
   *
   * @param args - deploy poll dto
   * @returns poll id
   */
  async deployPoll({ approval, sessionKeyAddress, chain, config }: IDeployPollArgs): Promise<{ pollId: string }> {
    const signer = await this.sessionKeysService.getCoordinatorSigner(chain, sessionKeyAddress, approval);

    // check if there is a maci contract deployed on this chain
    const maciAddress = this.storage.getAddress(EContracts.MACI, chain);

    if (!maciAddress) {
      throw new Error(ErrorCodes.MACI_NOT_DEPLOYED.toString());
    }

    // check if there is a verifier deployed on this chain
    const verifierAddress = this.storage.getAddress(EContracts.Verifier, chain);

    if (!verifierAddress) {
      throw new Error(ErrorCodes.VERIFIER_NOT_DEPLOYED.toString());
    }

    // check if there is a verifyingKey registry deployed on this chain
    const verifyingKeysRegistryAddress = this.storage.getAddress(EContracts.VerifyingKeysRegistry, chain);

    if (!verifyingKeysRegistryAddress) {
      throw new Error(ErrorCodes.VERIFYING_KEYS_REGISTRY_NOT_DEPLOYED.toString());
    }

    const policyContract = await this.deployAndSavePolicy(signer, chain, config.policy);
    const policyAddress = (await policyContract.getAddress()) as Hex;

    // check if initial voice credit proxy address was given
    let initialVoiceCreditProxyAddress: string | undefined = config.initialVoiceCreditsProxy.address;

    if (!initialVoiceCreditProxyAddress) {
      const initialVoiceCreditProxyFactory = await this.deployAndSaveVoiceCreditProxyFactory(
        signer,
        config.initialVoiceCreditsProxy.factoryType,
        chain,
      );

      const initialVoiceCreditProxyContract = await this.deployAndSaveVoiceCreditProxy(
        signer,
        config.initialVoiceCreditsProxy.type,
        chain,
        initialVoiceCreditProxyFactory,
        config.initialVoiceCreditsProxy.args,
      );

      initialVoiceCreditProxyAddress = await initialVoiceCreditProxyContract.getAddress();
    }

    // instantiate the coordinator MACI keypair
    const coordinatorKeypair = getCoordinatorKeypair();

    const deployPollArgs = {
      maciAddress,
      pollStartTimestamp: config.startDate,
      pollEndTimestamp: config.endDate,
      tallyProcessingStateTreeDepth: config.tallyProcessingStateTreeDepth,
      voteOptionTreeDepth: config.voteOptionTreeDepth,
      messageBatchSize: config.messageBatchSize,
      stateTreeDepth: config.pollStateTreeDepth,
      coordinatorPublicKey: coordinatorKeypair.publicKey,
      verifierContractAddress: verifierAddress,
      verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
      mode: config.mode,
      policyContractAddress: policyAddress,
      initialVoiceCreditProxyContractAddress: initialVoiceCreditProxyAddress,
      relayers: config.relayers ? config.relayers : [],
      voteOptions: Number(config.voteOptions),
      initialVoiceCredits: Number(config.initialVoiceCreditsProxy.args.amount),
      signer,
    };

    const { pollContractAddress, messageProcessorContractAddress, tallyContractAddress, pollId } =
      await deployPoll(deployPollArgs);

    const poll = PollFactory.connect(pollContractAddress, signer);

    // store to storage
    await Promise.all([
      this.storage.register({
        id: EContracts.Poll,
        key: `poll-${pollId}`,
        contract: poll,
        // clones do not have args for verification
        args: [],
        network: chain,
      }),
      this.storage.register({
        id: EContracts.MessageProcessor,
        key: `poll-${pollId}`,
        contract: MessageProcessorFactory.connect(messageProcessorContractAddress, signer),
        // clones do not have args for verification
        args: [],
        network: chain,
      }),
      this.storage.register({
        id: EContracts.Tally,
        key: `poll-${pollId}`,
        contract: TallyFactory.connect(tallyContractAddress, signer),
        // clones do not have args for verification
        args: [],
        network: chain,
      }),
    ]);

    return { pollId: pollId.toString() };
  }
}
