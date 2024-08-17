import { LeanIMT } from "@zk-kit/lean-imt";

import type {
  ConstantInitialVoiceCreditProxy,
  FreeForAllGatekeeper,
  MACI,
  MockVerifier,
  PollFactory,
  PoseidonT3,
  PoseidonT4,
  PoseidonT5,
  PoseidonT6,
  VkRegistry,
} from "../typechain-types";
import type { BigNumberish, Provider, Signer } from "ethers";
import type { CircuitInputs } from "maci-core";
import type { Message, PubKey, StateLeaf } from "maci-domainobjs";
import type { PublicSignals } from "snarkjs";

/**
 * The data structure of the verifying key of the SNARK circuit.
 */
export interface IVerifyingKeyStruct {
  alpha1: {
    x: BigNumberish;
    y: BigNumberish;
  };
  beta2: {
    x: [BigNumberish, BigNumberish];
    y: [BigNumberish, BigNumberish];
  };
  gamma2: {
    x: [BigNumberish, BigNumberish];
    y: [BigNumberish, BigNumberish];
  };
  delta2: {
    x: [BigNumberish, BigNumberish];
    y: [BigNumberish, BigNumberish];
  };
  ic: {
    x: BigNumberish;
    y: BigNumberish;
  }[];
}

/**
 * The data structure representing a SNARK proof.
 */
export interface SnarkProof {
  pi_a: bigint[];
  pi_b: bigint[][];
  pi_c: bigint[];
}

/**
 * The data structure representing a Groth16 proof.
 */
export interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

/**
 * The data structure representing a proof output
 */
export interface Proof {
  proof: SnarkProof | Groth16Proof;
  circuitInputs: CircuitInputs;
  publicInputs: PublicSignals;
}

/**
 * An interface holding all of the smart contracts part of MACI.
 */
export interface IDeployedTestContracts {
  mockVerifierContract: MockVerifier;
  gatekeeperContract: FreeForAllGatekeeper;
  constantInitialVoiceCreditProxyContract: ConstantInitialVoiceCreditProxy;
  maciContract: MACI;
  vkRegistryContract: VkRegistry;
}

/**
 * An interface that represents an action that should
 * be applied to a MaciState and its Polls within the
 * genMaciState function.
 */
export interface Action {
  type: string;
  data: Partial<{
    pubKey: PubKey;
    encPubKey: PubKey;
    message: Message;
    voiceCreditBalance: number;
    timestamp: number;
    nullifier: bigint;
    newVoiceCreditBalance: bigint;
    stateIndex: number;
    numSrQueueOps: number;
    pollId: bigint;
    pollAddr: string;
    stateLeaf: bigint;
    messageRoot: bigint;
  }>;
  blockNumber: number;
  transactionIndex: number;
}

/**
 * An interface that represents the deployed Poseidon contracts.
 */
export interface IDeployedPoseidonContracts {
  PoseidonT3Contract: PoseidonT3;
  PoseidonT4Contract: PoseidonT4;
  PoseidonT5Contract: PoseidonT5;
  PoseidonT6Contract: PoseidonT6;
}

/**
 * An interface that represents the arguments for MACI contracts deployment.
 */
export interface IDeployMaciArgs {
  /**
   * The address of the SignUpTokenGatekeeper contract
   */
  signUpTokenGatekeeperContractAddress: string;

  /**
   * The address of the ConstantInitialVoiceCreditProxy contract
   */
  initialVoiceCreditBalanceAddress: string;

  /**
   * The signer to use to deploy the contract
   */
  signer?: Signer;

  /**
   * Poseidon contract addresses (if not provided, they will be deployed automatically)
   */
  poseidonAddresses?: Partial<{
    poseidonT3: string;
    poseidonT4: string;
    poseidonT5: string;
    poseidonT6: string;
  }>;

  /**
   * The depth of the state tree
   */
  stateTreeDepth?: number;

  /**
   * Whether to suppress console output
   */
  quiet?: boolean;
}

/**
 * An interface that represents the deployed MACI contracts.
 */
export interface IDeployedMaci {
  maciContract: MACI;
  pollFactoryContract: PollFactory;
  poseidonAddrs: {
    poseidonT3: string;
    poseidonT4: string;
    poseidonT5: string;
    poseidonT6: string;
  };
}

/**
 * An interface that represents arguments of generation sign up tree and state leaves
 */
export interface IGenSignUpTreeArgs {
  /**
   * The etherum provider
   */
  provider: Provider;

  /**
   * The address of MACI contract
   */
  address: string;

  /**
   * The block number from which to start fetching events
   */
  fromBlock?: number;

  /**
   * The number of blocks to fetch in each request
   */
  blocksPerRequest?: number;

  /**
   * The block number at which to stop fetching events
   */
  endBlock?: number;

  /**
   * The amount of time to sleep between each request
   */
  sleepAmount?: number;
}

/**
 * An interface that represents sign up tree and state leaves
 */
export interface IGenSignUpTree {
  /**
   * Sign up tree
   */
  signUpTree: LeanIMT;

  /**
   * State leaves
   */
  stateLeaves: StateLeaf[];
}
