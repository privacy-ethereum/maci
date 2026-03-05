import type { Poll, MessageProcessor, Tally, MACI } from "@maci-protocol/contracts/typechain-types";
import type { BigNumberish, Provider, Signer } from "ethers";

/**
 * Interface for the arguments to the get poll command
 */
export interface IGetPollArgs {
  /**
   * A signer object
   */
  signer?: Signer;

  /**
   * A provider fallback object
   */
  provider?: Provider;

  /**
   * The address of the MACI contract
   */
  maciAddress: string;

  /**
   * The poll id. If not specified, latest poll id will be used
   */
  pollId?: BigNumberish;
}

/**
 * Interface that represents get poll contracts data
 */
export interface IGetPollContractsData {
  /**
   * Poll id
   */
  id: bigint;

  /**
   * MACI contract
   */
  maci: MACI;

  /**
   * Poll contract
   */
  poll: Poll;

  /**
   * MessageProcessor contract
   */
  messageProcessor: MessageProcessor;

  /**
   * Tally contract
   */
  tally: Tally;
}

/**
 * Interface for the return data to the get poll command
 */
export interface IGetPollData {
  /**
   * The poll id
   */
  id: BigNumberish;

  /**
   * The poll address
   */
  address: string;

  /**
   * The poll deployment timestamp
   */
  startDate: BigNumberish;

  /**
   * The poll end timestamp
   */
  endDate: BigNumberish;

  /**
   * The poll number of signups
   */
  totalSignups: BigNumberish;

  /**
   * Whether the MACI contract's state root has been merged
   */
  isMerged: boolean;

  /**
   * Whether the poll is currently open for voting
   */
  isOpen: boolean;

  /**
   * Mode of the poll
   */
  mode: BigNumberish;
}

/**
 * Arguments for the get poll params command
 */
export interface IGetPollParamsArgs {
  /**
   * The poll id
   */
  pollId: bigint;
  /**
   * The signer
   */
  signer: Signer;
  /**
   * The MACI contract address
   */
  maciContractAddress: string;
}

/**
 * Poll parameters
 */
export interface IPollParams {
  /**
   * The message batch size
   */
  messageBatchSize: number;
  /**
   * The number of vote options
   */
  totalVoteOptions: number;

  /**
   * Tally Batch Size
   */
  tallyBatchSize: number;

  /**
   * The vote option tree depth
   */
  voteOptionTreeDepth: number;

  /**
   * The depth of the tree holding the user ballots
   */
  tallyProcessingStateTreeDepth: number;
}

/**
 * Inputs for circuit PollJoining
 */
export interface IPollJoiningInputs {
  privateKey: bigint;
  pollPublicKey: bigint[][];
  stateLeaf: bigint[];
  siblings: bigint[][];
  indices: bigint[];
  nullifier: bigint;
  credits: bigint;
  stateRoot: bigint;
  actualStateTreeDepth: bigint;
  pollId: bigint;
}

/**
 * Inputs for circuit PollJoined
 */
export interface IPollJoinedInputs {
  privateKey: bigint;
  voiceCreditsBalance: bigint;
  stateLeaf: bigint[];
  pathElements: bigint[][];
  pathIndices: bigint[];
  credits: bigint;
  stateRoot: bigint;
}
