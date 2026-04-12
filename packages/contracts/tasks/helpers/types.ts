import type { AASigner, Proof } from "../../ts/types";
import type { MACI, MessageProcessor, Poll, Tally, Verifier, VerifyingKeysRegistry } from "../../typechain-types";
import type { EMode, Poll as PollWrapper } from "@maci-protocol/core";
import type { Keypair, PrivateKey } from "@maci-protocol/domainobjs";
import type {
  BaseContract,
  BigNumberish,
  Fragment,
  JsonFragment,
  Signer,
  ContractFactory,
  Interface,
  InterfaceAbi,
} from "ethers";
import type { Libraries, TaskArguments } from "hardhat/types";

/**
 * Interface that represents deploy params
 */
export interface IDeployParams {
  /**
   * Param for verification toggle
   */
  verify: boolean;

  /**
   * Param for incremental deploy toggle
   */
  incremental: boolean;

  /**
   * Consider warning as errors
   */
  strict?: boolean;

  /**
   * Skip steps with less or equal index
   */
  skip?: number;
}

/**
 * Interface that represents merge params
 */
export interface IMergeParams {
  /**
   * The poll id
   */
  poll: BigNumberish;

  /**
   * The number of queue operations to perform
   */
  queueOps?: number;
}

/**
 * Interface that represents task prove params
 */
export interface IProveParams {
  /**
   * The poll id
   */
  poll: BigNumberish;

  /**
   * Coordinator's private key
   */
  coordinatorPrivateKey: string;

  /**
   * The path to the rapidsnark binary
   */
  rapidsnark?: string;

  /**
   * The directory to store the proofs
   */
  outputDir: string;

  /**
   * The path to the process zkey file
   */
  messageProcessorZkey: string;

  /**
   * The path to the process witness generator binary
   */
  messageProcessorWitnessGenerator?: string;

  /**
   * The path to the process wasm file
   */
  messageProcessorWasm?: string;

  /**
   * The file to store the tally proof
   */
  tallyFile: string;

  /**
   * The path to the tally zkey file
   */
  voteTallyZkey: string;

  /**
   * The path to the tally witness generator binary
   */
  voteTallyWitnessGenerator?: string;

  /**
   * The path to the tally wasm file
   */
  voteTallyWasm?: string;

  /**
   * Voting mode
   */
  mode?: EMode;

  /**
   * The file with the serialized maci state
   */
  stateFile?: string;

  /**
   * The block number to start fetching logs from
   */
  startBlock?: number;

  /**
   * The number of blocks to fetch logs from
   */
  blocksPerBatch?: number;

  /**
   * The block number to stop fetching logs from
   */
  endBlock?: number;

  /**
   * The transaction hash of the first transaction
   */
  transactionHash?: string;

  /**
   * Backup files for ipfs messages (name format: ipfsHash1.json, ipfsHash2.json, ..., ipfsHashN.json)
   */
  ipfsMessageBackupFiles?: string;

  /**
   * Submit proofs on-chain
   */
  submitOnChain?: boolean;
}

/**
 * Interface that represents task submitOnChain params
 */
export interface ISubmitOnChainParams {
  /**
   * The poll id
   */
  poll: BigNumberish;

  /**
   * The directory where proofs are stored
   */
  outputDir: string;

  /**
   * The file to store the tally proof
   */
  tallyFile: string;
}

/**
 * Interface that represents prove generator params
 */
export interface IProofGeneratorParams {
  /**
   * Poll class (see maci-core)
   */
  poll: PollWrapper;

  /**
   * MACI contract address
   */
  maciContractAddress: string;

  /**
   * Tally contract address
   */
  tallyContractAddress: string;

  /**
   * Directory to store the proofs
   */
  outputDir: string;

  /**
   * File to store the tally proof
   */
  tallyOutputFile: string;

  /**
   * Message processing circuit files
   */
  messageProcessor: ICircuitFiles;

  /**
   * Tally circuit files
   */
  tally: ICircuitFiles;

  /**
   * Voting mode
   */
  mode: EMode;

  /**
   * Path to the rapidsnark binary
   */
  rapidsnark?: string;

  /**
   * Whether to enable incremental proof generation, resuming from saved salts
   */
  incremental?: boolean;

  /**
   * The poll ID, used to store and retrieve salts for incremental generation
   */
  pollId: string;
}

/**
 * Interface that groups files for circuits (zkey, witnessGenerator, wasm)
 */
export interface ICircuitFiles {
  /**
   * The path to the zkey file
   */
  zkey: string;

  /**
   * The path to the witness generator binary
   */
  witnessGenerator?: string;

  /**
   * The path to the wasm file
   */
  wasm?: string;
}

/**
 * Interface that represents prepare maci state params
 */
export interface IPrepareStateParams {
  /**
   * MACI contract
   */
  maciContract: MACI;

  /**
   * Poll contract
   */
  pollContract: Poll;

  /**
   * Poll id
   */
  pollId: BigNumberish;

  /**
   * MACI private key
   */
  maciPrivateKey: PrivateKey;

  /**
   * Coordinator keypair
   */
  coordinatorKeypair: Keypair;

  /**
   * Eth signer
   */
  signer: Signer;

  /**
   * The directory to store the proofs
   */
  outputDir: string;

  /**
   * Options for state (on-chain fetching or local file)
   */
  options: Partial<{
    /**
     * The file with the serialized maci state
     */
    stateFile: string;

    /**
     * The block number to start fetching logs from
     */
    startBlock: number;

    /**
     * The number of blocks to fetch logs from
     */
    blocksPerBatch: number;

    /**
     * The block number to stop fetching logs from
     */
    endBlock: number;

    /**
     * The transaction hash of the first transaction
     */
    transactionHash: string;
  }>;

  /**
   * Backup files for ipfs messages (name format: ipfsHash.json)
   */
  ipfsMessageBackupFiles?: string[];
}

/**
 * Interface that represents generate proof options
 */
export interface IGenerateProofsOptions {
  /**
   * Hook to call when batch generation is completed
   *
   * @param data - batch data
   */
  onBatchComplete?: (data: IGenerateProofsBatchData) => void;

  /**
   * Hook to call when proof generation is completed
   *
   * @param data - proof generated data
   * @param tally - tally data
   */
  onComplete?: (data: Proof[], tally?: TallyData) => void;

  /**
   * Hook to call when generation is failed
   *
   * @param error - error
   */
  onFail?: (error: Error) => void;
}

/**
 * Interface that represents batch data
 */
export interface IGenerateProofsBatchData {
  /**
   * Batch proofs
   */
  proofs: Proof[];

  /**
   * Current batch
   */
  current: number;

  /**
   * Total batches
   */
  total: number;
}

/**
 * Interface that represents prover params
 */
export interface IProverParams {
  /**
   * Poll contract typechain wrapper
   */
  pollContract: Poll;

  /**
   * MessageProcessor contract typechain wrapper
   */
  messageProcessorContract: MessageProcessor;

  /**
   * MACI contract typechain wrapper
   */
  maciContract: MACI;

  /**
   * VerifyingKeysRegistry contract typechain wrapper
   */
  verifyingKeysRegistryContract: VerifyingKeysRegistry;

  /**
   * Verifier contract typechain wrapper
   */
  verifierContract: Verifier;

  /**
   * Tally contract typechain wrapper
   */
  tallyContract: Tally;
}

/**
 * Interface that represents deploy step catalog
 */
export interface IDeployStepCatalog {
  /**
   * Step name
   */
  name: string;

  /**
   * Deploy task name
   */
  taskName: string;

  /**
   * Params function with deploy arguments
   *
   * @param params deploy params
   * @returns task arguments
   */
  paramsFn: (params: IDeployParams) => Promise<TaskArguments>;
}

/**
 * Interface that represents `Deployment#getContract` params
 */
export interface IGetContractParams {
  /**
   * Contract name
   */
  name: EContracts;

  /**
   * Group key
   */
  key?: string;

  /**
   * Contract address
   */
  address?: string;

  /**
   * Contract abi
   */
  abi?: Interface | InterfaceAbi;

  /**
   * Eth signer
   */
  signer?: Signer;
}

/**
 * Interface that represents deploy step
 */
export interface IDeployStep {
  /**
   * Sequence step id
   */
  id: number;

  /**
   * Step name
   */
  name: string;

  /**
   * Deploy task name
   */
  taskName: string;

  /**
   * Deployment arguments
   */
  args: TaskArguments;
}

/**
 * Interface that represents contract storage named entry
 */
export interface IStorageNamedEntry {
  /**
   * Contract address
   */
  address: string;

  /**
   * Count of deployed instances
   */
  count: number;
}

/**
 * Interface that represents contract storage instance entry
 */
export interface IStorageInstanceEntry {
  /**
   * Entry id
   */
  id: string;

  /**
   * Deployment Transaction Hash
   */
  deploymentTxHash?: string;

  /**
   * Params for verification
   */
  verify?: {
    args?: string;
    name?: string;
    impl?: string;
    subType?: string;
    libraries?: string;
  };
}

/**
 * Interface that represents register contract arguments
 */
export interface IRegisterContract<ID = EContracts> {
  /**
   * Contract enum identifier
   */
  id: ID;

  /**
   * Contract instance
   */
  contract: BaseContract;

  /**
   * Deploy network name
   */
  network: string;

  /**
   * Contract deployment arguments
   */
  args?: unknown[];

  /**
   * Implementation address
   */
  implementation?: string;

  /**
   * Linked libraries
   */
  libraries?: Libraries;

  /**
   * Group key for same contracts
   */
  key?: BigNumberish;

  /**
   * Contract name with path specified
   */
  name?: string;
}

/**
 * Enum represents policy types
 */
export enum EPolicies {
  FreeForAll = "@excubiae/contracts/contracts/extensions/freeForAll/FreeForAllPolicy.sol:FreeForAllPolicy",
  Token = "@excubiae/contracts/contracts/extensions/token/TokenPolicy.sol:TokenPolicy",
  EAS = "@excubiae/contracts/contracts/extensions/eas/EASPolicy.sol:EASPolicy",
  GitcoinPassport = "@excubiae/contracts/contracts/extensions/gitcoin/GitcoinPassportPolicy.sol:GitcoinPassportPolicy",
  Hats = "@excubiae/contracts/contracts/extensions/hats/HatsPolicy.sol:HatsPolicy",
  Zupass = "@excubiae/contracts/contracts/extensions/zupass/ZupassPolicy.sol:ZupassPolicy",
  Semaphore = "@excubiae/contracts/contracts/extensions/semaphore/SemaphorePolicy.sol:SemaphorePolicy",
  MerkleProof = "@excubiae/contracts/contracts/extensions/merkle/MerkleProofPolicy.sol:MerkleProofPolicy",
  AnonAadhaar = "@excubiae/contracts/contracts/extensions/anonAadhaar/AnonAadhaarPolicy.sol:AnonAadhaarPolicy",
  ERC20Votes = "@excubiae/contracts/contracts/extensions/erc20votes/ERC20VotesPolicy.sol:ERC20VotesPolicy",
  ERC20 = "@excubiae/contracts/contracts/extensions/erc20/ERC20Policy.sol:ERC20Policy",
}

/**
 * Enum represents policyfactory types
 */
export enum EPolicyFactories {
  FreeForAll = "@excubiae/contracts/contracts/extensions/freeForAll/FreeForAllPolicyFactory.sol:FreeForAllPolicyFactory",
  Token = "@excubiae/contracts/contracts/extensions/token/TokenPolicyFactory.sol:TokenPolicyFactory",
  EAS = "@excubiae/contracts/contracts/extensions/eas/EASPolicyFactory.sol:EASPolicyFactory",
  GitcoinPassport = "@excubiae/contracts/contracts/extensions/gitcoin/GitcoinPassportPolicyFactory.sol:GitcoinPassportPolicyFactory",
  Hats = "@excubiae/contracts/contracts/extensions/hats/HatsPolicyFactory.sol:HatsPolicyFactory",
  Zupass = "@excubiae/contracts/contracts/extensions/zupass/ZupassPolicyFactory.sol:ZupassPolicyFactory",
  Semaphore = "@excubiae/contracts/contracts/extensions/semaphore/SemaphorePolicyFactory.sol:SemaphorePolicyFactory",
  MerkleProof = "@excubiae/contracts/contracts/extensions/merkle/MerkleProofPolicyFactory.sol:MerkleProofPolicyFactory",
  AnonAadhaar = "@excubiae/contracts/contracts/extensions/anonAadhaar/AnonAadhaarPolicyFactory.sol:AnonAadhaarPolicyFactory",
  ERC20Votes = "@excubiae/contracts/contracts/extensions/erc20votes/ERC20VotesPolicyFactory.sol:ERC20VotesPolicyFactory",
  ERC20 = "@excubiae/contracts/contracts/extensions/erc20/ERC20PolicyFactory.sol:ERC20PolicyFactory",
}

/**
 * Enum represents checker types
 */
export enum ECheckers {
  FreeForAll = "@excubiae/contracts/contracts/extensions/freeForAll/FreeForAllChecker.sol:FreeForAllChecker",
  Token = "@excubiae/contracts/contracts/extensions/token/TokenChecker.sol:TokenChecker",
  EAS = "@excubiae/contracts/contracts/extensions/eas/EASChecker.sol:EASChecker",
  GitcoinPassport = "@excubiae/contracts/contracts/extensions/gitcoin/GitcoinPassportChecker.sol:GitcoinPassportChecker",
  Hats = "@excubiae/contracts/contracts/extensions/hats/HatsChecker.sol:HatsChecker",
  Zupass = "@excubiae/contracts/contracts/extensions/zupass/ZupassChecker.sol:ZupassChecker",
  Semaphore = "@excubiae/contracts/contracts/extensions/semaphore/SemaphoreChecker.sol:SemaphoreChecker",
  MerkleProof = "@excubiae/contracts/contracts/extensions/merkle/MerkleProofChecker.sol:MerkleProofChecker",
  AnonAadhaar = "@excubiae/contracts/contracts/extensions/anonAadhaar/AnonAadhaarChecker.sol:AnonAadhaarChecker",
  ERC20Votes = "@excubiae/contracts/contracts/extensions/erc20Votes/ERC20VotesChecker.sol:ERC20VotesChecker",
  ERC20 = "@excubiae/contracts/contracts/extensions/erc20/ERC20Checker.sol:ERC20Checker",
}

/**
 * Enum represents checker factory types
 */
export enum ECheckerFactories {
  FreeForAll = "@excubiae/contracts/contracts/extensions/freeForAll/FreeForAllCheckerFactory.sol:FreeForAllCheckerFactory",
  Token = "@excubiae/contracts/contracts/extensions/token/TokenCheckerFactory.sol:TokenCheckerFactory",
  EAS = "@excubiae/contracts/contracts/extensions/eas/EASCheckerFactory.sol:EASCheckerFactory",
  GitcoinPassport = "@excubiae/contracts/contracts/extensions/gitcoin/GitcoinPassportCheckerFactory.sol:GitcoinPassportCheckerFactory",
  Hats = "@excubiae/contracts/contracts/extensions/hats/HatsCheckerFactory.sol:HatsCheckerFactory",
  Zupass = "@excubiae/contracts/contracts/extensions/zupass/ZupassCheckerFactory.sol:ZupassCheckerFactory",
  Semaphore = "@excubiae/contracts/contracts/extensions/semaphore/SemaphoreCheckerFactory.sol:SemaphoreCheckerFactory",
  MerkleProof = "@excubiae/contracts/contracts/extensions/merkle/MerkleProofCheckerFactory.sol:MerkleProofCheckerFactory",
  AnonAadhaar = "@excubiae/contracts/contracts/extensions/anonAadhaar/AnonAadhaarCheckerFactory.sol:AnonAadhaarCheckerFactory",
  ERC20Votes = "@excubiae/contracts/contracts/extensions/erc20votes/ERC20VotesCheckerFactory.sol:ERC20VotesCheckerFactory",
  ERC20 = "@excubiae/contracts/contracts/extensions/erc20/ERC20CheckerFactory.sol:ERC20CheckerFactory",
}

/**
 * Enum represents initial voice credit proxies
 */
export enum EInitialVoiceCreditProxies {
  Constant = "ConstantInitialVoiceCreditProxy",
  ERC20Votes = "ERC20VotesInitialVoiceCreditProxy",
}

/**
 * Enum represents initial voice credit proxies factories
 */
export enum EInitialVoiceCreditProxiesFactories {
  Constant = "ConstantInitialVoiceCreditProxyFactory",
  ERC20Votes = "ERC20VotesInitialVoiceCreditProxyFactory",
}

/**
 * Enum represents deployed contracts
 */
export enum EContracts {
  ConstantInitialVoiceCreditProxy = "ConstantInitialVoiceCreditProxy",
  ConstantInitialVoiceCreditProxyFactory = "ConstantInitialVoiceCreditProxyFactory",
  ERC20VotesInitialVoiceCreditProxy = "ERC20VotesInitialVoiceCreditProxy",
  ERC20VotesInitialVoiceCreditProxyFactory = "ERC20VotesInitialVoiceCreditProxyFactory",
  ERC20Policy = "ERC20Policy",
  FreeForAllPolicy = "FreeForAllPolicy",
  AnonAadhaarPolicy = "AnonAadhaarPolicy",
  EASPolicy = "EASPolicy",
  GitcoinPassportPolicy = "GitcoinPassportPolicy",
  HatsPolicy = "HatsPolicy",
  ZupassPolicy = "ZupassPolicy",
  TokenPolicy = "TokenPolicy",
  ERC20VotesPolicy = "ERC20VotesPolicy",
  ZupassGroth16Verifier = "ZupassGroth16Verifier",
  SemaphorePolicy = "SemaphorePolicy",
  MerkleProofPolicy = "MerkleProofPolicy",
  Verifier = "Verifier",
  MACI = "MACI",
  PollFactory = "PollFactory",
  MessageProcessorFactory = "MessageProcessorFactory",
  TallyFactory = "TallyFactory",
  PoseidonT3 = "PoseidonT3",
  PoseidonT4 = "PoseidonT4",
  PoseidonT5 = "PoseidonT5",
  PoseidonT6 = "PoseidonT6",
  VerifyingKeysRegistry = "VerifyingKeysRegistry",
  Poll = "Poll",
  Tally = "Tally",
  MessageProcessor = "MessageProcessor",
}

/**
 * Interface that represents verify arguments
 */
export interface IVerifyFullArgs {
  /**
   * Ignore verified status
   */
  force?: boolean;
}

/**
 * Interface that represents verification subtask arguments
 * This is extracted from hardhat etherscan plugin
 */
export interface IVerificationSubtaskArgs {
  /**
   * Contract address
   */
  address: string;

  /**
   * Constructor arguments
   */
  constructorArguments: unknown[];

  /**
   * Fully qualified name of the contract
   */
  contract?: string;

  /**
   * Libraries
   */
  libraries?: Libraries;

  /**
   * Whether force verification or not
   */
  force?: boolean;
}

/**
 * Interface that represents tree merge params
 */
export interface ITreeMergeParams {
  /**
   * Ethers signer
   */
  deployer: Signer;

  /**
   * Poll contract
   */
  pollContract: Poll;
}

/**
 * Interface for the tally file data.
 */
export interface TallyData {
  /**
   * The MACI address.
   */
  maci: string;

  /**
   * The ID of the poll.
   */
  pollId: string;

  /**
   * The name of the network for which these proofs
   * are valid for
   */
  network?: string;

  /**
   * The chain ID for which these proofs are valid for
   */
  chainId?: string;

  /**
   * Voting mode
   */
  mode: EMode;

  /**
   * The address of the Tally contract.
   */
  tallyAddress: string;

  /**
   * The new tally commitment.
   */
  newTallyCommitment: string;

  /**
   * The results of the poll.
   */
  results: {
    /**
     * The tally of the results.
     */
    tally: string[];

    /**
     * The salt of the results.
     */
    salt: string;

    /**
     * The commitment of the results.
     */
    commitment: string;
  };

  /**
   * The total spent voice credits.
   */
  totalSpentVoiceCredits: {
    /**
     * The spent voice credits.
     */
    spent: string;

    /**
     * The salt of the spent voice credits.
     */
    salt: string;

    /**
     * The commitment of the spent voice credits.
     */
    commitment: string;
  };

  /**
   * The per vote option spent voice credits.
   */
  perVoteOptionSpentVoiceCredits?: {
    /**
     * The tally of the per vote option spent voice credits.
     */
    tally: string[];

    /**
     * The salt of the per vote option spent voice credits.
     */
    salt: string;

    /**
     * The commitment of the per vote option spent voice credits.
     */
    commitment: string;
  };
}

/**
 * Interface that represents submit results params
 */
export interface ISubmitResultsParams {
  /**
   * Start index for submitting batch results
   */
  start?: number;

  /**
   * End index for submitting batch results
   */
  end?: number;
}

/**
 * Type representing the ABI of a contract
 */
export type TAbi = string | readonly (string | Fragment | JsonFragment)[];

/**
 * Interface that represents deploy params
 */
export interface IDeployContractParams<ID = EContracts> {
  /**
   * Contract name
   */
  name: ID;

  /**
   * Contract abi
   */
  abi?: TAbi;

  /**
   * Contract bytecode
   */
  bytecode?: string;

  /**
   * Eth signer
   */
  signer?: Signer | AASigner;
}

/**
 * Interface that represents deploy params
 */
export interface IDeployContractWithLinkedLibrariesParams {
  /**
   * Contract factory
   */
  contractFactory: ContractFactory;

  /**
   * Eth signer
   */
  signer?: Signer;
}

/**
 * Interface for storing proof generation salts
 */
export interface ProofGenerationSalts {
  /** The salt for the new results root */
  newResultsRootSalt: string;
  /** The salt for the new spent voice credit subtotal */
  newSpentVoiceCreditSubtotalSalt: string;
  /** The salt for the new per vote option spent voice credits root */
  newPerVoteOptionSpentVoiceCreditsRootSalt: string;
  /** The tally batch number this salt belongs to */
  tallyBatchNumber?: number;
  /** Unix timestamp when this salt was generated */
  timestamp?: number;
}

/**
 * Interface for storing all salts for a poll
 */
export interface PollSaltsData {
  pollId: string;
  tallyProofSalts: ProofGenerationSalts[];
  processProofSalts?: {
    newSbCommitment: string;
    numBatchesProcessed?: number;
  }[];
}
