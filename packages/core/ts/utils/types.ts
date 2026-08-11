import type { MaciState } from "../MaciState";
import type { Poll } from "../Poll";
import type { EMode } from "./constants";
import type { PathElements } from "@maci-protocol/crypto";
import type {
  Ballot,
  IJsonBallot,
  IJsonPCommand,
  IJsonPublicKey,
  IJsonStateLeaf,
  IJsonVoteCounts,
  Keypair,
  Message,
  VoteCommand,
  PrivateKey,
  PublicKey,
  StateLeaf,
} from "@maci-protocol/domainobjs";

/**
 * A circuit inputs for the circom circuit
 */
export type TCircuitInputs = Record<string, string | bigint | bigint[] | bigint[][] | string[] | bigint[][][]>;

/**
 * Interface for optional salts in tally votes
 */
export interface TallyVotesSalts {
  newResultsRootSalt?: bigint;
  newSpentVoiceCreditSubtotalSalt?: bigint;
  newPerVoteOptionSpentVoiceCreditsRootSalt?: bigint;
}

/**
 * This interface defines the tree depths.
 * @property tallyProcessingStateTreeDepth - The depth of the intermediate state tree.
 * @property voteOptionTreeDepth - The depth of the vote option tree.
 */
export interface ITreeDepths {
  tallyProcessingStateTreeDepth: number;
  voteOptionTreeDepth: number;
  stateTreeDepth: number;
}

/**
 * This interface defines the batch sizes.
 * @property tallyBatchSize - The size of the tally batch.
 * @property messageBatchSize - The size of the message batch.
 */
export interface IBatchSizes {
  tallyBatchSize: number;
  messageBatchSize: number;
}

/**
 * Represents the public API of the MaciState class.
 */
export interface IMaciState {
  // This method is used for signing up users to the state tree.
  signUp(publicKey: PublicKey, initialVoiceCreditBalance: bigint, timestamp: bigint, stateRoot: bigint): number;
  // This method is used for deploying poll.
  deployPoll(
    pollEndTimestamp: bigint,
    treeDepths: ITreeDepths,
    messageBatchSize: number,
    coordinatorKeypair: Keypair,
    voteOptions: bigint,
    mode: EMode,
  ): bigint;
  // These methods are helper functions.
  deployNullPoll(): void;
  copy(): MaciState;
  equals(m: MaciState): boolean;
  toJSON(): IJsonMaciState;
}

/**
 * An interface which represents the public API of the Poll class.
 */
export interface IPoll {
  // Check if nullifier was already used for joining
  hasJoined(nullifier: bigint): boolean;
  // These methods are used for sending a message to the poll from user
  publishMessage(message: Message, encryptionPublicKey: PublicKey): void;
  // These methods are used to generate circuit inputs
  processMessages(pollId: bigint): IProcessMessagesCircuitInputs;
  tallyVotes(salts?: TallyVotesSalts): IVoteTallyCircuitInputs;
  // These methods are helper functions
  hasUnprocessedMessages(): boolean;
  processAllMessages(): { stateLeaves: StateLeaf[]; ballots: Ballot[] };
  hasUntalliedBallots(): boolean;
  copy(): Poll;
  equals(poll: Poll): boolean;
  toJSON(): IJsonPoll;
  setCoordinatorKeypair(serializedPrivateKey: string): void;
  updateChainHash(messageHash: bigint): void;
  padLastBatch(): void;
}

/**
 * This interface defines the JSON representation of a Poll
 */
export interface IJsonPoll {
  stateTreeDepth: number;
  pollEndTimestamp: string;
  treeDepths: ITreeDepths;
  batchSizes: IBatchSizes;
  maxVoteOptions: number;
  voteOptions: string;
  messages: unknown[];
  commands: IJsonPCommand[];
  ballots: IJsonBallot[];
  voteCounts: IJsonVoteCounts[];
  encryptionPublicKeys: string[];
  currentMessageBatchIndex: number;
  publicKeys: IJsonPublicKey[];
  pollStateLeaves: IJsonStateLeaf[];
  results: string[];
  totalBatchesProcessed: number;
  totalSignups: string;
  chainHash: string;
  pollNullifiers: string[];
  batchHashes: string[];
  mode: EMode;
}

/**
 * This interface defines the JSON representation of a MaciState
 */
export interface IJsonMaciState {
  stateTreeDepth: number;
  polls: IJsonPoll[];
  publicKeys: IJsonPublicKey[];
  pollBeingProcessed: boolean;
  currentPollBeingProcessed: string;
  totalSignups: number;
}

/**
 * An interface describing the output of the processMessage function
 */
export interface IProcessMessagesOutput {
  stateLeafIndex?: number;
  newStateLeaf?: StateLeaf;
  originalStateLeaf?: StateLeaf;
  originalStateLeafPathElements?: PathElements;
  originalVoteWeight?: bigint;
  originalVoteWeightsPathElements?: PathElements;
  newBallot?: Ballot;
  originalBallot?: Ballot;
  originalBallotPathElements?: PathElements;
  command?: VoteCommand;
}

/**
 * An interface describing the joiningCircuitInputs function arguments
 */
export interface IJoiningCircuitArgs {
  maciPrivateKey: PrivateKey;
  stateLeafIndex: bigint;
  pollPublicKey: PublicKey;
}

/**
 * An interface describing the joinedCircuitInputs function arguments
 */
export interface IJoinedCircuitArgs {
  maciPrivateKey: PrivateKey;
  stateLeafIndex: bigint;
  voiceCreditsBalance: bigint;
}

/**
 * An interface describing the circuit inputs to the PollJoining circuit
 */
export interface IPollJoiningCircuitInputs {
  privateKey: string;
  pollPublicKey: string[];
  stateLeaf: string[];
  siblings: string[][];
  index: string;
  nullifier: string;
  stateRoot: string;
  actualStateTreeDepth: string;
  pollId: string;
}

/**
 * An interface describing the circuit inputs to the PollJoined circuit
 */
export interface IPollJoinedCircuitInputs {
  privateKey: string;
  voiceCreditsBalance: string;
  stateLeaf: string[];
  pathElements: string[][];
  pathIndices: string[];
  stateRoot: string;
  actualStateTreeDepth: string;
}

/**
 * An interface describing the circuit inputs to the ProcessMessage circuit
 */
export interface IProcessMessagesCircuitInputs {
  actualStateTreeDepth: string;
  totalSignups: string;
  batchEndIndex: string;
  index: string;
  msgRoot: string;
  coordinatorPublicKeyHash: string;
  inputBatchHash: string;
  outputBatchHash: string;
  messages: string[];
  coordinatorPrivateKey: string;
  encryptionPublicKeys: string[];
  currentStateRoot: string;
  currentBallotRoot: string;
  currentSbCommitment: string;
  currentSbSalt: string;
  currentStateLeaves: string[];
  currentStateLeavesPathElements: string[][];
  currentBallots: string[];
  currentBallotsPathElements: string[][];
  currentVoteWeights: string[];
  currentVoteWeightsPathElements: string[][];
  newSbSalt: string;
  newSbCommitment: string;
  voteOptions: bigint;
}

/**
 * An interface describing the circuit inputs to the VoteTally circuit
 */
export interface IVoteTallyCircuitInputs {
  stateRoot: string;
  ballotRoot: string;
  voteCountsRoot: string;
  sbSalt: string;
  sbCommitment: string;
  index: bigint;
  currentTallyCommitment: string;
  newTallyCommitment: string;
  totalSignups: bigint;
  ballots: string[];
  ballotPathElements: PathElements;
  votes: string[][];
  voteCounts: string[];
  voteCountsPathElements: PathElements;
  voteCountsData: string[][];
  currentResults: string[];
  currentResultsRootSalt: string;
  currentSpentVoiceCreditSubtotal: string;
  currentSpentVoiceCreditSubtotalSalt: string;
  currentPerVoteOptionSpentVoiceCredits?: string[];
  currentPerVoteOptionSpentVoiceCreditsRootSalt?: string;
  newResultsRootSalt: string;
  newPerVoteOptionSpentVoiceCreditsRootSalt?: string;
  newSpentVoiceCreditSubtotalSalt: string;
}

/**
 * Interface that represents arguments for getting voice credits left
 */
export interface IGetVoiceCreditsLeft {
  /**
   * State leaf
   */
  stateLeaf: StateLeaf;

  /**
   * Original vote weight
   */
  originalVoteWeight: bigint;

  /**
   * New vote weight
   */
  newVoteWeight: bigint;

  /**
   * Voting mode
   */
  mode: EMode;
}
