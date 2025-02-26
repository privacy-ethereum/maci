import type { Signer } from "ethers";
import type { CircuitInputs } from "maci-core";
import type { SnarkProof } from "maci-sdk";
import type { Groth16Proof, PublicSignals } from "snarkjs";

export interface DeployedContracts {
  maciAddress: string;
  pollFactoryAddress: string;
  poseidonT3Address: string;
  poseidonT4Address: string;
  poseidonT5Address: string;
  poseidonT6Address: string;
  initialVoiceCreditProxyAddress: string;
  signUpGatekeeperAddress: string;
  verifierAddress: string;
}

export interface PollContracts {
  poll: string;
  messageProcessor: string;
  tally: string;
  signupGatekeeper: string;
}

/**
 * Proof interface for cli commands
 */
export interface Proof {
  proof: SnarkProof | Groth16Proof;
  circuitInputs: CircuitInputs;
  publicInputs: PublicSignals;
}

// snark js related interfaces
export type BigNumberish = number | string | bigint;

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
 * Interface for the arguments to the deploy command
 */
export interface DeployArgs {
  /**
   * The depth of the state tree
   */
  stateTreeDepth: number;

  /**
   * A signer object
   */
  signer: Signer;

  /**
   * The initial voice credits to be minted
   */
  initialVoiceCredits?: number;

  /**
   * The address of the initialVoiceCreditsProxy contract
   */
  initialVoiceCreditsProxyAddress?: string;

  /**
   * The address of the signupGatekeeper contract
   */
  signupGatekeeperAddress?: string;

  /**
   * The address of the PoseidonT3 contract
   */
  poseidonT3Address?: string;

  /**
   * The address of the PoseidonT4 contract
   */
  poseidonT4Address?: string;

  /**
   * The address of the PoseidonT5 contract
   */
  poseidonT5Address?: string;

  /**
   * The address of the PoseidonT6 contract
   */
  poseidonT6Address?: string;

  /**
   * Whether to log the output
   */
  quiet?: boolean;
}

/**
 * Interface for the arguments to the genProof command
 */
export interface GenProofsArgs {
  /**
   * The directory to store the proofs
   */
  outputDir: string;

  /**
   * The file to store the tally proof
   */
  tallyFile: string;

  /**
   * The path to the tally zkey file
   */
  tallyZkey: string;

  /**
   * The path to the process zkey file
   */
  processZkey: string;

  /**
   * The id of the poll
   */
  pollId: bigint;

  /**
   * A signer object
   */
  signer: Signer;

  /**
   * The path to the rapidsnark binary
   */
  rapidsnark?: string;

  /**
   * The path to the process witnessgen binary
   */
  processWitgen?: string;

  /**
   * The path to the process dat file
   */
  processDatFile?: string;

  /**
   * The path to the tally witnessgen binary
   */
  tallyWitgen?: string;

  /**
   * The path to the tally dat file
   */
  tallyDatFile?: string;

  /**
   * The coordinator's private key
   */
  coordinatorPrivKey?: string;

  /**
   * The address of the MACI contract
   */
  maciAddress?: string;

  /**
   * The transaction hash of the first transaction
   */
  transactionHash?: string;

  /**
   * The path to the process wasm file
   */
  processWasm?: string;

  /**
   * The path to the tally wasm file
   */
  tallyWasm?: string;

  /**
   * Whether to use wasm or rapidsnark
   */
  useWasm?: boolean;

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
   * Whether to log the output
   */
  quiet?: boolean;

  /**
   * Whether to use quadratic voting or not
   */
  useQuadraticVoting?: boolean;

  /**
   * Backup files for ipfs messages (name format: ipfsHash.json)
   */
  ipfsMessageBackupFiles?: string[];
}

/**
 * Interface for the arguments to the FundWallet command
 */
export interface FundWalletArgs {
  /**
   * The amount to fund
   */
  amount: number;

  /**
   * The address of the wallet to fund
   */
  address: string;

  /**
   * A signer object
   */
  signer: Signer;

  /**
   * Whether to log the output
   */
  quiet?: boolean;
}

/**
 * Interface for the arguments to the TimeTravel command
 */
export interface TimeTravelArgs {
  /**
   * The number of seconds to time travel
   */
  seconds: number;

  /**
   * A signer object
   */
  signer: Signer;

  /**
   * Whether to log the output
   */
  quiet?: boolean;
}

/**
 * Interface for the arguments to the DeployVkRegistry command
 */
export interface DeployVkRegistryArgs {
  /**
   * A signer object
   */
  signer: Signer;

  /**
   * Whether to log the output
   */
  quiet?: boolean;
}
