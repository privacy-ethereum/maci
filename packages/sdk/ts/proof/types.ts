import type { ITallyData } from "../tally/types";
import type { Groth16Proof, SnarkProof } from "@maci-protocol/contracts";
import type { EMode, TCircuitInputs } from "@maci-protocol/core";
import type { BigNumberish, Signer } from "ethers";
import type { PublicSignals } from "snarkjs";

/**
 * Interface for the arguments to the proveOnChain command
 */
export interface IProveOnChainArgs {
  /**
   * The id of the poll
   */
  pollId: bigint;

  /**
   * The directory containing the proofs
   */
  proofDir: string;

  /**
   * A signer object
   */
  signer: Signer;

  /**
   * The address of the MACI contract
   */
  maciAddress: string;

  /**
   * The tally file
   */
  tallyFile?: string;

  /**
   * Whether to use batch submission
   */
  useBatchSubmission?: boolean;
}

/**
 * Proof interface for sdk commands
 */
export interface IProof {
  /**
   * Proof
   */
  proof: SnarkProof | Groth16Proof;

  /**
   * Circuit inputs
   */
  circuitInputs: TCircuitInputs;

  /**
   * Public signals
   */
  publicInputs: PublicSignals;
}

/**
 * Arguments for the generateProofs function
 */
export interface IGenerateProofsArgs {
  /**
   * The output directory
   */
  outputDir: string;

  /**
   * The coordinator private key
   */
  coordinatorPrivateKey: string;

  /**
   * The signer
   */
  signer: Signer;

  /**
   * The maci contract address
   */
  maciAddress: string;

  /**
   * The poll id
   */
  pollId: BigNumberish;

  /**
   * The ipfs message backup files
   */
  ipfsMessageBackupFiles?: string[];

  /**
   * The state file
   */
  stateFile?: string;

  /**
   * The transaction hash
   */
  transactionHash?: string;

  /**
   * The start block
   */
  startBlock?: number;

  /**
   * The end block
   */
  endBlock?: number;

  /**
   * The blocks per batch
   */
  blocksPerBatch?: number;

  /**
   * The rapidsnark path
   */
  rapidsnark?: string;

  /**
   * The path to the process dat file
   */
  messageProcessorWitnessDatFile?: string;

  /**
   * The path to the tally dat file
   */
  voteTallyWitnessDatFile?: string;

  /**
   * The use quadratic voting
   */
  mode: EMode;

  /**
   * Whether to use wasm or rapidsnark
   */
  useWasm?: boolean;

  /**
   * The tally zkey
   */
  voteTallyZkey: string;

  /**
   * The tally witness generator
   */
  voteTallyWitnessGenerator?: string;

  /**
   * The tally wasm
   */
  voteTallyWasm?: string;

  /**
   * The process zkey
   */
  messageProcessorZkey: string;

  /**
   * The process witness generator
   */
  messageProcessorWitnessGenerator?: string;

  /**
   * The process wasm
   */
  messageProcessorWasm?: string;

  /**
   * The tally file
   */
  tallyFile: string;

  /**
   * Whether to use incremental proof generation
   */
  incremental?: boolean;
}

/**
 * Interface for the data returned by the generateProofs function
 */
export interface IGenerateProofsData {
  /**
   * The Process proofs
   */
  processProofs: IProof[];

  /**
   * Tally proofs
   */
  tallyProofs: IProof[];

  /**
   * Tally data
   */
  tallyData: ITallyData;
}

/**
 * Interface for the poll joining artifacts
 */
export interface IPollJoiningArtifacts {
  /**
   * The zkey
   */
  zKey: Uint8Array;

  /**
   * The wasm
   */
  wasm: Uint8Array;
}

/**
 * The url of the poll joining artifacts
 */
export interface IPollJoiningArtifactsUrl {
  /**
   * The url of the poll joining zkey
   */
  zKeyUrl: string;

  /**
   * The url of the poll joining wasm
   */
  wasmUrl: string;
}

/**
 * The arguments to download the poll joining artifacts for the browser
 */
export interface IDownloadPollJoiningArtifactsBrowserArgs {
  /**
   * The depth of the state tree
   */
  stateTreeDepth: number;

  /**
   * Whether to download the testing artifacts
   */
  testing?: boolean;
}
