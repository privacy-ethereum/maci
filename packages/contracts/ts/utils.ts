import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { Interface, type TransactionReceipt, type BigNumberish, type FeeData, type Network, type Signer } from "ethers";

import fs from "fs";
import os from "os";

import type { Action, SnarkProof, Groth16Proof } from "./types";
import type { Ownable } from "../typechain-types";

import { info, logGreen } from "./logger";

declare global {
  interface ITerminatable {
    terminate: () => Promise<unknown>;
  }

  // eslint-disable-next-line vars-on-top, no-var, camelcase
  var curve_bn128: ITerminatable | undefined;

  // eslint-disable-next-line vars-on-top, no-var, camelcase
  var curve_bls12381: ITerminatable | undefined;
}

const IFACE_CONTRACT_CREATION = new Interface(["event ContractCreation(address indexed newContract)"]);

/**
 * Format a SnarkProof type to an array of strings
 * which can be passed to the Groth16 verifier contract.
 * @param proof the SnarkProof to format
 * @returns an array of strings
 */
export const formatProofForVerifierContract = (proof: SnarkProof | Groth16Proof): string[] =>
  [
    proof.pi_a[0],
    proof.pi_a[1],

    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],

    proof.pi_c[0],
    proof.pi_c[1],
  ].map((x) => x.toString());

/**
 * Pause the thread for n milliseconds
 * @param ms - the amount of time to sleep in milliseconds
 */
export const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/**
 * The comparison function for Actions based on block number and transaction
 * index.
 * @param actions - the array of actions to sort
 * @returns the sorted array of actions
 */
export function sortActions(actions: Action[]): Action[] {
  return actions.slice().sort((a, b) => {
    if (a.blockNumber > b.blockNumber) {
      return 1;
    }

    if (a.blockNumber < b.blockNumber) {
      return -1;
    }

    if (a.transactionIndex > b.transactionIndex) {
      return 1;
    }

    if (a.transactionIndex < b.transactionIndex) {
      return -1;
    }

    return 0;
  });
}

/**
 * Get the default signer from the hardhat node
 * @returns the default signer
 */
export const getDefaultSigner = async (): Promise<Signer> => {
  const { ethers } = await import("hardhat");

  const [signer] = await ethers.getSigners();

  return signer as unknown as Signer;
};

/**
 * Get the default signer network from the hardhat node
 * @returns the default network
 */
export const getDefaultNetwork = async (): Promise<Network | undefined> => {
  const signer = await getDefaultSigner();

  return signer.provider?.getNetwork();
};

/**
 * Get all of the available signers from the hardhat node
 * @dev to be used while testing
 * @returns the signers
 */
export const getSigners = async (): Promise<Signer[]> => {
  const { ethers } = await import("hardhat");

  return ethers.getSigners() as unknown as Promise<Signer[]>;
};

/**
 * Get the current fee data from the blockchain node.
 * This is needed to ensure transaction go through in busy times
 * @returns - the fee data
 */
export const getFeeData = async (): Promise<FeeData | undefined> => {
  const signer = await getDefaultSigner();
  return signer.provider?.getFeeData();
};

/**
 * Transfer ownership of a contract (using Ownable from OpenZeppelin)
 * @param contract - the contract to transfer ownership of
 * @param newOwner - the address of the new owner
 * @param quiet - whether to suppress console output
 */
export const transferOwnership = async <T extends Ownable>(
  contract: T,
  newOwner: string,
  quiet = false,
): Promise<void> => {
  logGreen({ text: info(`Transferring ownership of ${await contract.getAddress()} to ${newOwner}`), quiet });

  const tx = await contract.transferOwnership(newOwner, {
    maxFeePerGas: await getFeeData().then((res) => res?.maxFeePerGas),
  });

  await tx.wait();
};

/**
 * Convert bignumberish to hex
 *
 * @param value - bignumberish string
 * @returns hex representation of it
 */
export function asHex(value: BigNumberish): string {
  return `0x${BigInt(value).toString(16)}`;
}

export function generateMerkleTree(elements: string[][]): StandardMerkleTree<string[]> {
  return StandardMerkleTree.of(elements, ["address"]);
}

/**
 * Check if we are running on an arm chip
 * @returns whether we are running on an arm chip
 */
export const isArm = (): boolean => os.arch().includes("arm");

/*
 * https://github.com/iden3/snarkjs/issues/152
 * Need to cleanup the threads to avoid stalling
 */
export const cleanThreads = async (): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!globalThis) {
    return;
  }

  const curves = ["curve_bn128", "curve_bls12381"];
  await Promise.all(
    curves.map((curve) => globalThis[curve as "curve_bn128" | "curve_bls12381"]?.terminate()).filter(Boolean),
  );
};

/**
 * Remove a file
 * @param filepath - the path to the file
 */
export const unlinkFile = async (filepath: string): Promise<void> => {
  const isFileExists = fs.existsSync(filepath);

  if (isFileExists) {
    await fs.promises.unlink(filepath);
  }
};

/**
 * Get the timestamp of the current block
 * @param signer - the signer to use
 * @returns the start time of the current block or the current time
 */
export const getBlockTimestamp = async (signer: Signer): Promise<number> => {
  const block = await signer.provider?.getBlock("latest");
  return block?.timestamp ?? Math.floor(Date.now() / 1000);
};

/**
 * Get the address of the deployed contract from the transaction receipt
 * This is useful for contracts that are deployed using the CREATE2 opcode
 * or for contracts that emit a ContractCreation event. Useful for Account Abstraction txs
 * @param receipt - the transaction receipt of the contract creation
 * @returns - the address of the deployed contract
 */
export const getDeployedContractAddressFromContractReceipt: (
  receipt: TransactionReceipt | null | undefined,
) => string | undefined = (receipt) => {
  if (!receipt) {
    return undefined;
  }

  const contractCreationLog = receipt.logs.find((log) => {
    try {
      const parsedLog = IFACE_CONTRACT_CREATION.parseLog(log);
      return parsedLog?.name === "ContractCreation";
    } catch (err) {
      // If parseLog fails, this log is not from the ABI
      return false;
    }
  });

  return contractCreationLog ? (IFACE_CONTRACT_CREATION.parseLog(contractCreationLog)?.args[0] as string) : undefined;
};
