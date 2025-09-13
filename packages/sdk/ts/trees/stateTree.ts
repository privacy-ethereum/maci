/* eslint-disable no-underscore-dangle */
import { MACI__factory as MACIFactory } from "@maci-protocol/contracts/typechain-types";
import { hashLeanIMT, hashLeftRight, PAD_KEY_HASH } from "@maci-protocol/crypto";
import { PublicKey } from "@maci-protocol/domainobjs";
import { LeanIMT, type LeanIMTHashFunction } from "@zk-kit/lean-imt";

import type { IGenerateSignUpTreeArgs, IGenerateSignUpTree, IGenerateSignUpTreeWithEndKeyArgs } from "./types";

import { sleep } from "../utils/utils";

/**
 * Generate a State tree object from the events of a MACI smart contracts
 * @param provider - the ethereum provider
 * @param address - the address of the MACI contract
 * @param fromBlock - the block number from which to start fetching events
 * @param blocksPerRequest - the number of blocks to fetch in each request
 * @param endBlock - the block number at which to stop fetching events
 * @param sleepAmount - the amount of time to sleep between each request
 * @returns State tree
 */
export const generateSignUpTree = async ({
  provider,
  address,
  fromBlock = 0,
  blocksPerRequest = 50,
  endBlock,
  sleepAmount,
}: IGenerateSignUpTreeArgs): Promise<IGenerateSignUpTree> => {
  const lastBlock = endBlock || (await provider.getBlockNumber());

  const maciContract = MACIFactory.connect(address, provider);
  const signUpTree = new LeanIMT(hashLeanIMT as LeanIMTHashFunction);
  signUpTree.insert(PAD_KEY_HASH);
  const publicKeys: PublicKey[] = [];

  // Fetch event logs in batches (lastBlock inclusive)
  for (let i = fromBlock; i <= lastBlock; i += blocksPerRequest + 1) {
    // the last block batch will be either current iteration block + blockPerRequest
    // or the end block if it is set
    const toBlock = i + blocksPerRequest >= lastBlock ? lastBlock : i + blocksPerRequest;

    // eslint-disable-next-line no-await-in-loop
    const signUpLogs = await maciContract.queryFilter(maciContract.filters.SignUp(), i, toBlock);
    signUpLogs.forEach((event) => {
      const publicKeyX = event.args._userPublicKeyX;
      const publicKeyY = event.args._userPublicKeyY;

      const publicKey = new PublicKey([publicKeyX, publicKeyY]);

      publicKeys.push(publicKey);
      signUpTree.insert(hashLeftRight(publicKeyX, publicKeyY));
    });

    if (sleepAmount) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(sleepAmount);
    }
  }

  return {
    signUpTree,
    publicKeys,
  };
};

/**
 * Generate a State tree object from the events of a MACI smart contracts
 * @param provider - the ethereum provider
 * @param address - the address of the MACI contract
 * @param fromBlock - the block number from which to start fetching events
 * @param blocksPerRequest - the number of blocks to fetch in each request
 * @param endBlock - the block number at which to stop fetching events
 * @param sleepAmount - the amount of time to sleep between each request
 * @param userPublicKey - the user public key where we end/stop the signUpTree replica.
 *        If user public key is 4th then the returned signUpTree will have only 4 leaves
 *        (does not matter if MACI' signUpTree has more).
 * @returns State tree
 */
export const generateSignUpTreeWithEndKey = async ({
  provider,
  address,
  fromBlock = 0,
  blocksPerRequest = 50,
  endBlock,
  sleepAmount,
  userPublicKey,
}: IGenerateSignUpTreeWithEndKeyArgs): Promise<IGenerateSignUpTree> => {
  const lastBlock = endBlock || (await provider.getBlockNumber());

  const maciContract = MACIFactory.connect(address, provider);
  const signUpTree = new LeanIMT(hashLeanIMT as LeanIMTHashFunction);
  signUpTree.insert(PAD_KEY_HASH);
  const publicKeys: PublicKey[] = [];

  // Fetch event logs in batches (lastBlock inclusive)
  for (let i = fromBlock; i <= lastBlock; i += blocksPerRequest + 1) {
    // the last block batch will be either current iteration block + blockPerRequest
    // or the end block if it is set
    const toBlock = i + blocksPerRequest >= lastBlock ? lastBlock : i + blocksPerRequest;

    // eslint-disable-next-line no-await-in-loop
    const signUpLogs = await maciContract.queryFilter(maciContract.filters.SignUp(), i, toBlock);
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let j = 0; j < signUpLogs.length; j += 1) {
      const event = signUpLogs[j];
      const publicKeyX = event.args._userPublicKeyX;
      const publicKeyY = event.args._userPublicKeyY;

      const publicKey = new PublicKey([publicKeyX, publicKeyY]);

      publicKeys.push(publicKey);
      signUpTree.insert(hashLeftRight(publicKeyX, publicKeyY));

      // early return cause we found the user
      if (publicKey.equals(userPublicKey)) {
        return {
          signUpTree,
          publicKeys,
        };
      }
    }

    if (sleepAmount) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(sleepAmount);
    }
  }

  return {
    signUpTree,
    publicKeys,
  };
};

/**
 * Generate a sign up tree from the public keys
 * @param publicKeys - the public keys to generate the sign up tree from
 * @returns the sign up tree
 */
export const generateSignUpTreeFromKeys = (publicKeys: PublicKey[]): LeanIMT => {
  const signUpTree = new LeanIMT(hashLeanIMT);
  publicKeys.forEach((key) => {
    signUpTree.insert(key.hash());
  });
  return signUpTree;
};
