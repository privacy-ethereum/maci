import {
  type generateMaciStateFromContract,
  type MACI,
  type Verifier,
  type VerifyingKeysRegistry,
  type FreeForAllPolicy,
  type ConstantInitialVoiceCreditProxy,
  type IIpfsMessage,
} from "@maci-protocol/sdk";

import type { User } from "./user";
import type { Signer } from "ethers";

/**
 * A util interface that represents a vote object
 */
export interface IVote {
  voteOptionIndex: bigint;
  voteWeight: bigint;
  nonce: bigint;
}

/**
 * A util interface that represents a briber object
 */
export interface IBriber {
  voteOptionIndices: bigint[];
}

/**
 * A util interface that represents a change user keys object
 */
export interface IChangeUsersKeys {
  voteOptionIndex: bigint;
  voteWeight: bigint;
}

/**
 * A util interface that represents a test suite
 */
export interface ITestSuite {
  name: string;
  description: string;
  numVotesPerUser: number;
  numUsers: number;
  expectedTally: number[];
  expectedSpentVoiceCredits: number[];
  expectedTotalSpentVoiceCredits: number;
  bribers?: IBriber[];
  votes?: IVote[][];
  changeUsersKeys?: IChangeUsersKeys[][];
}

/**
 * A util interface that represents deployed test contracts
 */
export interface IDeployedTestContracts {
  maci: MACI;
  verifier: Verifier;
  verifyingKeysRegistry: VerifyingKeysRegistry;
  policy: FreeForAllPolicy;
  initialVoiceCreditProxy: ConstantInitialVoiceCreditProxy;
}

/**
 * A util interface that represents testing data from the TestingClass object
 */
export interface IContractsData {
  initialized: boolean;
  users?: User[];
  maciContractAddress?: string;
  maciState?: Awaited<ReturnType<typeof generateMaciStateFromContract>>;
  polls?: string[];
}

export interface IRelayTestMessagesArgs {
  messages: IIpfsMessage[];
  maciAddress: string;
  signer: Signer;
  pollId: number;
}

/**
 * Interface for the paths to the zkey files and the wasm and witnessGenerator files
 */
export interface ITestingClassPaths {
  /**
   * Path to the pollJoining zkey file
   */
  pollJoiningZkeyPath: string;

  /**
   * Path to the pollJoined zkey file
   */
  pollJoinedZkeyPath: string;

  /**
   * Path to the MessageProcessor zkey file
   */
  messageProcessorZkeyPath: string;

  /**
   * Path to the VoteTally zkey file
   */
  voteTallyZkeyPath: string;

  /**
   * Path to the poll joining wasm file
   */
  pollJoiningWasm: string;

  /**
   * Path to the poll witnessGenerator file
   */
  pollWitnessGenerator: string;

  /**
   * Path to the rapidsnark file
   */
  rapidsnark: string;
}
