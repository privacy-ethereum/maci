/* eslint-disable import/no-extraneous-dependencies */
import { type IVerifyingKeyContractParams, type VerifyingKey } from "@maci-protocol/domainobjs";
import { expect } from "chai";

import type { IDeployedTestContracts, IDeployedTestContractsArgs } from "../ts/types";
import type { EthereumProvider } from "hardhat/types";

import {
  deployConstantInitialVoiceCreditProxy,
  deployConstantInitialVoiceCreditProxyFactory,
  deployFreeForAllSignUpPolicy,
  deployMaci,
  deployMockVerifier,
  deployVerifyingKeysRegistry,
} from "../ts/deploy";

export const insertSubTreeGasLimit = { gasLimit: 300000 };
export const enqueueGasLimit = { gasLimit: 500000 };
export const fillGasLimit = { gasLimit: 4000000 };

/**
 * Travel in time in a local blockchain node
 * @param provider the provider to use
 * @param seconds the number of seconds to travel for
 */
export async function timeTravel(provider: EthereumProvider, seconds: number): Promise<void> {
  await provider.send("evm_increaseTime", [Number(seconds)]);
  await provider.send("evm_mine", []);
}

/**
 * Compare two verifying keys
 * @param verifyingKey - the off chain verifyingKey
 * @param verifyingKeyOnChain - the on chain verifyingKey
 */
export const compareVerifyingKeys = (
  verifyingKey: VerifyingKey,
  verifyingKeyOnChain: IVerifyingKeyContractParams,
): void => {
  expect(verifyingKey.ic.length).to.eq(verifyingKeyOnChain.ic.length);
  for (let i = 0; i < verifyingKey.ic.length; i += 1) {
    expect(verifyingKey.ic[i].x.toString()).to.eq(verifyingKeyOnChain.ic[i].x.toString());
    expect(verifyingKey.ic[i].y.toString()).to.eq(verifyingKeyOnChain.ic[i].y.toString());
  }
  expect(verifyingKey.alpha1.x.toString()).to.eq(verifyingKeyOnChain.alpha1.x.toString());
  expect(verifyingKey.alpha1.y.toString()).to.eq(verifyingKeyOnChain.alpha1.y.toString());
  expect(verifyingKey.beta2.x[0].toString()).to.eq(verifyingKeyOnChain.beta2.x[0].toString());
  expect(verifyingKey.beta2.x[1].toString()).to.eq(verifyingKeyOnChain.beta2.x[1].toString());
  expect(verifyingKey.beta2.y[0].toString()).to.eq(verifyingKeyOnChain.beta2.y[0].toString());
  expect(verifyingKey.beta2.y[1].toString()).to.eq(verifyingKeyOnChain.beta2.y[1].toString());
  expect(verifyingKey.delta2.x[0].toString()).to.eq(verifyingKeyOnChain.delta2.x[0].toString());
  expect(verifyingKey.delta2.x[1].toString()).to.eq(verifyingKeyOnChain.delta2.x[1].toString());
  expect(verifyingKey.delta2.y[0].toString()).to.eq(verifyingKeyOnChain.delta2.y[0].toString());
  expect(verifyingKey.delta2.y[1].toString()).to.eq(verifyingKeyOnChain.delta2.y[1].toString());
  expect(verifyingKey.gamma2.x[0].toString()).to.eq(verifyingKeyOnChain.gamma2.x[0].toString());
  expect(verifyingKey.gamma2.x[1].toString()).to.eq(verifyingKeyOnChain.gamma2.x[1].toString());
  expect(verifyingKey.gamma2.y[0].toString()).to.eq(verifyingKeyOnChain.gamma2.y[0].toString());
  expect(verifyingKey.gamma2.y[1].toString()).to.eq(verifyingKeyOnChain.gamma2.y[1].toString());
};

/**
 * Deploy a set of smart contracts that can be used for testing.
 * @param initialVoiceCreditBalance - the initial voice credit balance for each user
 * @param stateTreeDepth - the depth of the state tree
 * @param signer - the signer to use
 * @param quiet - whether to suppress console output
 * @param policy - the policy contract to use
 * @returns the deployed contracts
 */
export const deployTestContracts = async ({
  initialVoiceCreditBalance,
  stateTreeDepth,
  signer,
  quiet = true,
  factories,
  policy,
}: IDeployedTestContractsArgs): Promise<IDeployedTestContracts> => {
  const mockVerifierContract = await deployMockVerifier(signer, true);

  let policyContract = policy;

  if (!policyContract) {
    [policyContract] = await deployFreeForAllSignUpPolicy({}, signer, true);
  }

  const constantInitialVoiceCreditProxyFactory = await deployConstantInitialVoiceCreditProxyFactory(signer, true);
  const constantInitialVoiceCreditProxyContract = await deployConstantInitialVoiceCreditProxy(
    { amount: initialVoiceCreditBalance },
    constantInitialVoiceCreditProxyFactory,
    signer,
  );

  // VerifyingKeysRegistry
  const verifyingKeysRegistryContract = await deployVerifyingKeysRegistry(signer, true);
  const [policyContractAddress] = await Promise.all([policyContract.getAddress()]);

  const { maciContract } = await deployMaci({
    policyContractAddress,
    signer,
    stateTreeDepth,
    factories,
    quiet,
  });

  return {
    mockVerifierContract,
    policyContract,
    constantInitialVoiceCreditProxyContract,
    maciContract,
    verifyingKeysRegistryContract,
  };
};
