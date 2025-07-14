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
} from "@maci-protocol/sdk";
import { Injectable } from "@nestjs/common";
import { BaseContract, Signer } from "ethers";
import { type Hex } from "viem";

import { ErrorCodes, ESupportedNetworks } from "../common";
import { getCoordinatorKeypair } from "../common/coordinatorKeypair";
import { FileService } from "../file/file.service";
import { RedisService } from "../redis/redis.service";
import { IStoredPollInfo } from "../redis/types";
import { SessionKeysService } from "../sessionKeys/sessionKeys.service";

import {
  IDeployMaciArgs,
  IDeployPollArgs,
  IInitialVoiceCreditProxyArgs,
  IAnonAadhaarPolicyArgs,
  IEASPolicyArgs,
  IGitcoinPassportPolicyArgs,
  IHatsPolicyArgs,
  IZupassPolicyArgs,
  ISemaphorePolicyArgs,
  IMerkleProofPolicyArgs,
  ITokenPolicyArgs,
  IERC20VotesPolicyArgs,
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
    private readonly redisService: RedisService,
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
    network: ESupportedNetworks,
    policyConfig: IDeployPolicyConfig,
  ): Promise<BasePolicy> {
    let policyContract: BasePolicy;
    let policyFactory: BaseContract;
    let checkFactory: BaseContract;

    let policyFactoryName: EPolicyFactories;
    let checkFactoryName: ECheckerFactories;

    let factoryIsSaved: boolean;
    let checkerIsSaved: boolean;

    const { type, args } = policyConfig;

    // based on the policy type, we need to deploy the correct policy
    switch (type) {
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

        [policyContract, , policyFactory, checkFactory] = await deployFreeForAllSignUpPolicy(factories, signer, true);
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

        [policyContract, , policyFactory, checkFactory] = await deployEASSignUpPolicy(
          {
            eas: (args as IEASPolicyArgs).easAddress,
            attester: (args as IEASPolicyArgs).attester,
            schema: (args as IEASPolicyArgs).schema,
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

        [policyContract, , policyFactory, checkFactory] = await deployGitcoinPassportPolicy(
          {
            decoderAddress: (args as IGitcoinPassportPolicyArgs).decoderAddress,
            minimumScore: Number((args as IGitcoinPassportPolicyArgs).passingScore),
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

        [policyContract, , policyFactory, checkFactory] = await deployHatsSignupPolicy(
          {
            hats: (args as IHatsPolicyArgs).hatsProtocolAddress,
            criterionHats: (args as IHatsPolicyArgs).critrionHats.map((c) => BigInt(c)),
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

        [policyContract, , policyFactory, checkFactory] = await deployZupassSignUpPolicy(
          {
            eventId: (args as IZupassPolicyArgs).eventId,
            signer1: (args as IZupassPolicyArgs).signer1,
            signer2: (args as IZupassPolicyArgs).signer2,
            verifier: (args as IZupassPolicyArgs).zupassVerifier,
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

        [policyContract, , policyFactory, checkFactory] = await deploySemaphoreSignupPolicy(
          {
            semaphore: (args as ISemaphorePolicyArgs).semaphoreContract,
            groupId: BigInt((args as ISemaphorePolicyArgs).groupId),
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

        [policyContract, , policyFactory, checkFactory] = await deployMerkleProofPolicy(
          {
            root: (args as IMerkleProofPolicyArgs).root,
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

        [policyContract, , policyFactory, checkFactory] = await deploySignupTokenPolicy(
          {
            token: (args as ITokenPolicyArgs).token,
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

        [policyContract, , policyFactory, checkFactory] = await deployAnonAadhaarPolicy(
          {
            verifierAddress: (args as IAnonAadhaarPolicyArgs).verifier,
            nullifierSeed: (args as IAnonAadhaarPolicyArgs).nullifierSeed,
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

        [policyContract, , policyFactory, checkFactory] = await deployERC20VotesPolicy(
          {
            snapshotBlock: BigInt((args as IERC20VotesPolicyArgs).snapshotBlock),
            threshold: BigInt((args as IERC20VotesPolicyArgs).threshold),
            token: (args as IERC20VotesPolicyArgs).token,
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
      id: type,
      name: type,
      contract: policyContract,
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
   * Get the voice credit proxy contract object
   * always deploy and save it
   *
   * @param signer - the signer
   * @param voiceCreditProxyType - the voice credit proxy type
   * @param network - the network
   * @param args - the args
   * @returns - the voice credit proxy contract
   */
  async deployAndSaveVoiceCreditProxy(
    signer: Signer,
    voiceCreditProxyType: EInitialVoiceCreditProxies,
    network: ESupportedNetworks,
    args?: IInitialVoiceCreditProxyArgs,
  ): Promise<ConstantInitialVoiceCreditProxy> {
    let contract: ConstantInitialVoiceCreditProxy;

    switch (voiceCreditProxyType) {
      case EInitialVoiceCreditProxies.Constant: {
        [contract] = await deployConstantInitialVoiceCreditProxy(
          {
            amount: args!.amount,
          },
          signer,
          undefined,
          true,
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
    mode: EMode,
  ): Promise<ISetVerifyingKeysArgs> {
    const { zkey: pollJoiningZkeyPath } = this.fileService.getZkeyFilePaths(
      process.env.COORDINATOR_POLL_JOINING_ZKEY_NAME!,
    );

    const { zkey: pollJoinedZkeyPath } = this.fileService.getZkeyFilePaths(
      process.env.COORDINATOR_POLL_JOINED_ZKEY_NAME!,
    );

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

    const { pollJoiningVerifyingKey, pollJoinedVerifyingKey, processVerifyingKey, tallyVerifyingKey } =
      await extractAllVerifyingKeys({
        pollJoiningZkeyPath,
        pollJoinedZkeyPath,
        messageProcessorZkeyPath,
        voteTallyZkeyPath,
      });

    const { stateTreeDepth, pollStateTreeDepth, tallyProcessingStateTreeDepth, voteOptionTreeDepth, messageBatchSize } =
      verifyingKeysRegistryArgs;

    return {
      pollJoiningVerifyingKey: pollJoiningVerifyingKey!,
      pollJoinedVerifyingKey: pollJoinedVerifyingKey!,
      processMessagesVerifyingKey: processVerifyingKey!,
      tallyVotesVerifyingKey: tallyVerifyingKey!,
      stateTreeDepth: Number(stateTreeDepth),
      tallyProcessingStateTreeDepth: Number(tallyProcessingStateTreeDepth),
      voteOptionTreeDepth: Number(voteOptionTreeDepth),
      messageBatchSize: Number(messageBatchSize),
      pollStateTreeDepth: Number(pollStateTreeDepth),
      signer,
      mode,
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
      config.MACI.mode,
    );
    await setVerifyingKeys(verifyingKeysArgs);

    // deploy the smart contracts
    const maciAddresses = await deployMaci({
      stateTreeDepth: config.MACI.stateTreeDepth,
      signer,
      signupPolicyAddress: policyAddress,
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
    let initialVoiceCreditProxyAddress = config.initialVoiceCreditsProxy.address;
    if (!initialVoiceCreditProxyAddress) {
      const initialVoiceCreditProxyContract = await this.deployAndSaveVoiceCreditProxy(
        signer,
        config.initialVoiceCreditsProxy.type,
        chain,
        config.initialVoiceCreditsProxy.args,
      );
      initialVoiceCreditProxyAddress = (await initialVoiceCreditProxyContract.getAddress()) as Hex;
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
      relayers: config.relayers ? config.relayers.map((address) => address as Hex) : [],
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

    await this.redisService.set(
      `poll-${pollId}`,
      JSON.stringify({
        maciContractAddress: maciAddress,
        pollId: pollId.toString(),
        chain,
        endDate: config.endDate,
        isTallied: false,
      } as IStoredPollInfo),
    );

    return { pollId: pollId.toString() };
  }
}
