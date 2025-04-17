import { MACI__factory as MACIFactory } from "@maci-protocol/contracts/typechain-types";
import { PublicKey } from "@maci-protocol/domainobjs";
import { ContractTransactionReceipt, isBytesLike } from "ethers";

import type { IIsRegisteredUser, ISignupArgs, ISignupData, IRegisteredUserArgs, IHasUserSignedUpArgs } from "./types";

import { contractExists } from "../utils/contracts";

import { parseSignupEvents } from "./utils";

/**
 * Checks if user is registered with a given public key and get its data
 * @param IRegisteredArgs - The arguments for the check register command
 * @returns whether the user is registered or not and their state index
 */
export const getSignedupUserData = async ({
  maciAddress,
  maciPublicKey,
  signer,
  startBlock,
}: IRegisteredUserArgs): Promise<IIsRegisteredUser> => {
  const maciContract = MACIFactory.connect(maciAddress, signer);
  const publicKey = PublicKey.deserialize(maciPublicKey);
  const startBlockNumber = startBlock || 0;
  const currentBlock = await signer.provider!.getBlockNumber();

  const { stateIndex } = await parseSignupEvents({
    maciContract,
    startBlock: startBlockNumber,
    currentBlock,
    publicKey,
  });

  return {
    isRegistered: stateIndex !== undefined,
    stateIndex,
  };
};

/**
 * Signup a user to the MACI contract
 * @param {SignupArgs} args - The arguments for the signup command
 * @returns {ISignupData} The state index of the user and transaction hash
 */
export const signup = async ({ maciPublicKey, maciAddress, sgData, signer }: ISignupArgs): Promise<ISignupData> => {
  // validate user key
  if (!PublicKey.isValidSerializedPubKey(maciPublicKey)) {
    throw new Error("Invalid MACI public key");
  }

  const userMaciPubKey = PublicKey.deserialize(maciPublicKey);

  const validContract = await contractExists(signer.provider!, maciAddress);

  if (!validContract) {
    throw new Error("There is no contract deployed at the specified address");
  }

  // we validate that the signup data and voice credit data is valid
  if (!isBytesLike(sgData)) {
    throw new Error("invalid signup gateway data");
  }

  const maciContract = MACIFactory.connect(maciAddress, signer);

  let stateIndex = "";
  let receipt: ContractTransactionReceipt | null = null;

  // sign up to the MACI contract
  const tx = await maciContract.signUp(userMaciPubKey.asContractParam(), sgData);
  receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error("The transaction failed");
  }

  // get state index from the event
  const [{ args = [] } = { args: [] }] = await maciContract.queryFilter(
    maciContract.filters.SignUp,
    receipt.blockNumber,
    receipt.blockNumber,
  );

  stateIndex = args[0].toString();

  return {
    stateIndex: stateIndex ? stateIndex.toString() : "",
    transactionHash: receipt.hash,
  };
};

/**
 * Checks if a user is signed up with a given public key
 * @param {IIsSignedUpArgs} args - The arguments for the is signed up command
 * @returns {boolean} Whether the user is signed up or not
 */
export const hasUserSignedUp = async ({
  maciAddress,
  maciPublicKey,
  signer,
}: IHasUserSignedUpArgs): Promise<boolean> => {
  const maciContract = MACIFactory.connect(maciAddress, signer);

  const stateIndex = await maciContract.getStateIndex(PublicKey.deserialize(maciPublicKey).hash());

  return stateIndex !== 0n;
};
