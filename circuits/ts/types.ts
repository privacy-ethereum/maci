import type { CircuitConfig } from "circomkit";
import type { CircuitInputs } from "maci-core";
import type { Groth16Proof, PublicSignals } from "snarkjs";

export type BigNumberish = number | string | bigint;

/**
 * Interface that represents Verification key
 */
export interface ISnarkJSVerificationKey {
  protocol: BigNumberish;
  curve: BigNumberish;
  nPublic: BigNumberish;
  vk_alpha_1: BigNumberish[];
  vk_beta_2: BigNumberish[][];
  vk_gamma_2: BigNumberish[][];
  vk_delta_2: BigNumberish[][];
  vk_alphabeta_12: BigNumberish[][][];
  IC: BigNumberish[][];
}

/**
 * Return type for proof generation function
 */
export interface FullProveResult {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}

/**
 * Parameters for the genProof function
 */
export interface IGenProofOptions {
  inputs: CircuitInputs;
  zkeyPath: string;
  useWasm?: boolean;
  rapidsnarkExePath?: string;
  witnessExePath?: string;
  wasmPath?: string;
  silent?: boolean;
}

/**
 * Inputs for circuit PollJoining
 */
export interface IPollJoiningInputs {
  privKey: bigint;
  pollPrivKey: bigint;
  pollPubKey: bigint[][];
  stateLeaf: bigint[];
  siblings: bigint[][];
  indices: bigint[];
  nullifier: bigint;
  credits: bigint;
  stateRoot: bigint;
  actualStateTreeDepth: bigint;
  inputHash: bigint;
}

/**
 * Inputs for circuit ProcessMessages
 */
export interface IProcessMessagesInputs {
  actualStateTreeDepth: bigint;
  inputHash: bigint;
  packedVals: bigint;
  pollEndTimestamp: bigint;
  inputBatchHash: bigint;
  outputBatchHash: bigint;
  msgs: bigint[];
  coordPrivKey: bigint;
  coordPubKey: [bigint, bigint];
  encPubKeys: bigint[];
  currentStateRoot: bigint;
  currentStateLeaves: bigint[];
  currentStateLeavesPathElements: bigint[][];
  currentSbCommitment: bigint;
  currentSbSalt: bigint;
  newSbCommitment: bigint;
  newSbSalt: bigint;
  currentBallotRoot: bigint;
  currentBallots: bigint[];
  currentBallotsPathElements: bigint[][];
  currentVoteWeights: bigint[];
  currentVoteWeightsPathElements: bigint[][];
}

/**
 * Inputs for circuit TallyVotes
 */
export interface ITallyVotesInputs {
  stateRoot: bigint;
  ballotRoot: bigint;
  sbSalt: bigint;
  packedVals: bigint;
  sbCommitment: bigint;
  currentTallyCommitment: bigint;
  newTallyCommitment: bigint;
  inputHash: bigint;
  ballots: bigint[];
  ballotPathElements: bigint[];
  votes: bigint[][];
  currentResults: bigint[];
  currentResultsRootSalt: bigint;
  currentSpentVoiceCreditSubtotal: bigint;
  currentSpentVoiceCreditSubtotalSalt: bigint;
  currentPerVOSpentVoiceCredits: bigint[];
  currentPerVOSpentVoiceCreditsRootSalt: bigint;
  newResultsRootSalt: bigint;
  newPerVOSpentVoiceCreditsRootSalt: bigint;
  newSpentVoiceCreditSubtotalSalt: bigint;
}

/**
 * Extend CircuitConfig type to include the name of the circuit
 */
export interface CircuitConfigWithName extends CircuitConfig {
  name: string;
}
