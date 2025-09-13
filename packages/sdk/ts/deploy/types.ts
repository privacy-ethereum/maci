import { type TAbi } from "@maci-protocol/contracts";
import { type EMode } from "@maci-protocol/core";
import { type PublicKey } from "@maci-protocol/domainobjs";

import type { Signer } from "ethers";

/**
 * The arguments for the deploy poll command
 */
export interface IDeployPollArgs {
  /**
   * The address of the MACI contract
   */
  maciAddress: string;

  /**
   * The start timestamp of the poll
   */
  pollStartTimestamp: number;

  /**
   * The end timestamp of the poll
   */
  pollEndTimestamp: number;

  /**
   * The depth of the integer state tree
   */
  tallyProcessingStateTreeDepth: number;

  /**
   * The depth of the vote option tree
   */
  voteOptionTreeDepth: number;

  /**
   * The batch size of the messages
   */
  messageBatchSize: number;

  /**
   * The poll state tree depth
   */
  stateTreeDepth: number;

  /**
   * The coordinator public key
   */
  coordinatorPublicKey: PublicKey;

  /**
   * The address of the verifier contract
   */
  verifierContractAddress: string;

  /**
   * The address of the verifying keys registry contract
   */
  verifyingKeysRegistryContractAddress: string;

  /**
   * The mode of the poll
   */
  mode: EMode;

  /**
   * The address of the policy contract
   */
  policyContractAddress: string;

  /**
   * The address of the initial voice credit proxy contract
   */
  initialVoiceCreditProxyContractAddress?: string;

  /**
   * The addresses of the relayers
   */
  relayers: string[];

  /**
   * The number of vote options
   */
  voteOptions: number;

  /**
   * The initial voice credits to be minted
   */
  initialVoiceCredits?: number;

  /**
   * Free for all checker factory address (use for deployment optimization if there is no signup policy)
   */
  freeForAllCheckerFactoryAddress?: string;

  /**
   * Free for all policy factory address (use for deployment optimization if there is no signup policy)
   */
  freeForAllPolicyFactoryAddress?: string;

  /**
   * The address of the initial voice credit proxy factory contract (use for deployment optimization if there is no initial voice credit proxy)
   */
  initialVoiceCreditProxyFactoryAddress?: string;

  /**
   * The signer
   */
  signer: Signer;
}

/**
 * The addresses of the deployed poll contracts
 */
export interface IPollContractsData {
  /**
   * The address of the poll contract
   */
  pollContractAddress: string;

  /**
   * The address of the message processor contract
   */
  messageProcessorContractAddress: string;

  /**
   * The address of the tally contract
   */
  tallyContractAddress: string;

  /**
   * The poll id
   */
  pollId: bigint;

  /**
   * The address of the policy contract
   */
  policyContractAddress: string;

  /**
   * The address of the initial voice credit proxy contract
   */
  initialVoiceCreditProxyContractAddress: string;
}

/**
 * An interface that represents the arguments for MACI contracts deployment.
 */
export interface IDeployMaciArgs {
  /**
   * The depth of the state tree
   */
  stateTreeDepth: number;

  /**
   * The address of the policy contract
   */
  signupPolicyAddress: string;

  /**
   * The signer to use to deploy the contract
   */
  signer: Signer;

  /**
   * The address of the PollFactory contract
   */
  pollFactoryAddress?: string;

  /**
   * The address of the MessageProcessorFactory contract
   */
  messageProcessorFactoryAddress?: string;

  /**
   * The address of the TallyFactory contract
   */
  tallyFactoryAddress?: string;

  /**
   * Poseidon contract addresses (if not provided, they will be deployed automatically)
   */
  poseidonAddresses?: Partial<{
    poseidonT3: string;
    poseidonT4: string;
    poseidonT5: string;
    poseidonT6: string;
  }>;
}

/**
 * An interface that represents the deployed MACI contracts.
 */
export interface IMaciContracts {
  /**
   * The address of the MACI contract
   */
  maciContractAddress: string;

  /**
   * The address of the PollFactory contract
   */
  pollFactoryContractAddress: string;

  /**
   * The address of the MessageProcessorFactory contract
   */
  messageProcessorFactoryContractAddress: string;

  /**
   * The address of the TallyFactory contract
   */
  tallyFactoryContractAddress: string;

  /**
   * The addresses of the Poseidon contracts
   */
  poseidonAddresses: {
    poseidonT3: string;
    poseidonT4: string;
    poseidonT5: string;
    poseidonT6: string;
  };
}

/**
 * Interface for the arguments to the DeployVerifyingKeyRegistry command
 */
export interface IDeployVerifyingKeyRegistryArgs {
  /**
   * A signer object
   */
  signer: Signer;
}

/**
 * Arguments for deploying a factory
 */
export interface IDeployFactoryArgs {
  /**
   * The abi of the factory
   */
  abi: TAbi;

  /**
   * The bytecode of the factory
   */
  bytecode: string;

  /**
   * The signer to use
   */
  signer: Signer;

  /**
   * The arguments
   */
  args?: unknown[];

  /**
   * The address of the factory
   */
  address?: string;
}
