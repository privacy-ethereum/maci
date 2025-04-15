import { extractVk } from "@maci-protocol/contracts";
import { VkRegistry__factory as VkRegistryFactory } from "@maci-protocol/contracts/typechain-types";
import { type IVkContractParams, VerifyingKey } from "@maci-protocol/domainobjs";

import fs from "fs";

import type { IGetAllVksArgs, IExtractAllVksArgs, IMaciVks, IMaciVerifyingKeys, IExtractVkToFileArgs } from "./types";

/**
 * Get all the verifying keys from the contract
 * @param args - The arguments for the getAllVks function
 * @returns The verifying keys
 */
export const getAllOnChainVks = async ({
  vkRegistryAddress,
  signer,
  stateTreeDepth,
  voteOptionTreeDepth,
  messageBatchSize,
  intStateTreeDepth,
  mode,
}: IGetAllVksArgs): Promise<IMaciVerifyingKeys> => {
  const vkRegistryContractInstance = VkRegistryFactory.connect(vkRegistryAddress, signer);

  const [pollJoiningVkOnChain, pollJoinedVkOnChain, processVkOnChain, tallyVkOnChain] = await Promise.all([
    vkRegistryContractInstance.getPollJoiningVk(stateTreeDepth),
    vkRegistryContractInstance.getPollJoinedVk(stateTreeDepth),
    vkRegistryContractInstance.getProcessVk(stateTreeDepth, voteOptionTreeDepth, messageBatchSize, mode),
    vkRegistryContractInstance.getTallyVk(stateTreeDepth, intStateTreeDepth, voteOptionTreeDepth, mode),
  ]);

  return {
    pollJoiningVkOnChain,
    pollJoinedVkOnChain,
    processVkOnChain,
    tallyVkOnChain,
  };
};

/**
 * Compare two verifying keys
 * @param vkOnChain - the verifying key on chain
 * @param vk - the local verifying key
 * @returns whether they are equal or not
 */
export const compareVks = (
  vkOnChain: VerifyingKey | IVkContractParams,
  vk?: VerifyingKey | IVkContractParams,
): boolean => {
  if (!vk) {
    throw new Error("Verifying key is not provided");
  }

  let isEqual = vk.ic.length === vkOnChain.ic.length;
  for (let i = 0; i < vk.ic.length; i += 1) {
    isEqual = isEqual && vk.ic[i].x.toString() === vkOnChain.ic[i].x.toString();
    isEqual = isEqual && vk.ic[i].y.toString() === vkOnChain.ic[i].y.toString();
  }

  isEqual = isEqual && vk.alpha1.x.toString() === vkOnChain.alpha1.x.toString();
  isEqual = isEqual && vk.alpha1.y.toString() === vkOnChain.alpha1.y.toString();
  isEqual = isEqual && vk.beta2.x[0].toString() === vkOnChain.beta2.x[0].toString();
  isEqual = isEqual && vk.beta2.x[1].toString() === vkOnChain.beta2.x[1].toString();
  isEqual = isEqual && vk.beta2.y[0].toString() === vkOnChain.beta2.y[0].toString();
  isEqual = isEqual && vk.beta2.y[1].toString() === vkOnChain.beta2.y[1].toString();
  isEqual = isEqual && vk.delta2.x[0].toString() === vkOnChain.delta2.x[0].toString();
  isEqual = isEqual && vk.delta2.x[1].toString() === vkOnChain.delta2.x[1].toString();
  isEqual = isEqual && vk.delta2.y[0].toString() === vkOnChain.delta2.y[0].toString();
  isEqual = isEqual && vk.delta2.y[1].toString() === vkOnChain.delta2.y[1].toString();
  isEqual = isEqual && vk.gamma2.x[0].toString() === vkOnChain.gamma2.x[0].toString();
  isEqual = isEqual && vk.gamma2.x[1].toString() === vkOnChain.gamma2.x[1].toString();
  isEqual = isEqual && vk.gamma2.y[0].toString() === vkOnChain.gamma2.y[0].toString();
  isEqual = isEqual && vk.gamma2.y[1].toString() === vkOnChain.gamma2.y[1].toString();

  return isEqual;
};

/**
 * Extract all the verifying keys
 * @param args - The arguments for the extractAllVks function
 * @returns The verifying keys
 */
export const extractAllVks = async ({
  pollJoiningZkeyPath,
  pollJoinedZkeyPath,
  processMessagesZkeyPath,
  tallyVotesZkeyPath,
}: IExtractAllVksArgs): Promise<IMaciVks> => {
  // extract the vks
  const pollJoiningVk = pollJoiningZkeyPath ? VerifyingKey.fromObj(await extractVk(pollJoiningZkeyPath)) : undefined;
  const pollJoinedVk = pollJoinedZkeyPath ? VerifyingKey.fromObj(await extractVk(pollJoinedZkeyPath)) : undefined;

  const processVk = processMessagesZkeyPath
    ? VerifyingKey.fromObj(await extractVk(processMessagesZkeyPath))
    : undefined;
  const tallyVk = tallyVotesZkeyPath ? VerifyingKey.fromObj(await extractVk(tallyVotesZkeyPath)) : undefined;

  return {
    pollJoiningVk,
    pollJoinedVk,
    processVk,
    tallyVk,
  };
};

/**
 * Command to confirm that the verifying keys in the contract match the local ones
 * @note see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing
 * @param args The arguments for the checkVerifyingKeys command
 * @returns Whether the verifying keys match or not
 */
export const extractVkToFile = async ({
  processMessagesZkeyPathQv,
  tallyVotesZkeyPathQv,
  processMessagesZkeyPathNonQv,
  pollJoinedZkeyPath,
  pollJoiningZkeyPath,
  tallyVotesZkeyPathNonQv,
  outputFilePath,
}: IExtractVkToFileArgs): Promise<void> => {
  const [processVkQv, tallyVkQv, processVkNonQv, tallyVkNonQv, pollJoiningVk, pollJoinedVk] = await Promise.all([
    extractVk(processMessagesZkeyPathQv),
    extractVk(tallyVotesZkeyPathQv),
    extractVk(processMessagesZkeyPathNonQv),
    extractVk(tallyVotesZkeyPathNonQv),
    extractVk(pollJoiningZkeyPath),
    extractVk(pollJoinedZkeyPath),
  ]);

  await fs.promises.writeFile(
    outputFilePath,
    JSON.stringify({ processVkQv, tallyVkQv, processVkNonQv, tallyVkNonQv, pollJoiningVk, pollJoinedVk }),
  );
};
