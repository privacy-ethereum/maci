import { extractVk } from "maci-sdk";

import fs from "fs";

import { ExtractVkToFileArgs } from "../utils/interfaces";

/**
 * Command to confirm that the verifying keys in the contract match the
 * local ones
 * @note see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing
 * @param CheckVerifyingKeysArgs - The arguments for the checkVerifyingKeys command
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
}: ExtractVkToFileArgs): Promise<void> => {
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
