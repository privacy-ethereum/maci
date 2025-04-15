import { ZeroAddress } from "ethers";
import {
  MACI__factory as MACIFactory,
  Poll__factory as PollFactory,
  Tally__factory as TallyFactory,
} from "maci-contracts/typechain-types";

import type { IGetPollArgs, IGetPollData } from "../utils/interfaces";

import { banner } from "../utils/banner";
import { logError, logGreen, success } from "../utils/theme";

/**
 * Get deployed poll from MACI contract
 * @param {IGetPollArgs} args - The arguments for the get poll command
 * @returns {IGetPollData} poll data
 */
export const getPoll = async ({
  maciAddress,
  signer,
  provider,
  pollId,
  quiet = true,
}: IGetPollArgs): Promise<IGetPollData> => {
  banner(quiet);

  if (!signer && !provider) {
    logError("No signer and provider are provided");
  }

  const maciContract = MACIFactory.connect(maciAddress, signer ?? provider);
  const id =
    pollId === undefined ? await maciContract.nextPollId().then((nextPollId) => nextPollId - 1n) : BigInt(pollId);

  if (id < 0n) {
    logError(`Invalid poll id ${id}`);
  }

  const pollContracts = await maciContract.polls(id);

  if (pollContracts.poll === ZeroAddress) {
    logError(`MACI contract doesn't have any deployed poll ${id}`);
  }

  const pollContract = PollFactory.connect(pollContracts.poll, signer ?? provider);

  const [[deployTime, duration], mergedStateRoot] = await Promise.all([
    pollContract.getDeployTimeAndDuration(),
    pollContract.mergedStateRoot(),
  ]);
  const isMerged = mergedStateRoot !== BigInt(0);
  const numSignups = await (isMerged ? pollContract.numSignups() : maciContract.numSignUps());

  // get the poll mode
  const tallyContract = TallyFactory.connect(pollContracts.tally, signer ?? provider);
  const mode = await tallyContract.mode();

  logGreen(
    quiet,
    success(
      [
        `ID: ${id}`,
        `Deploy time: ${new Date(Number(deployTime) * 1000).toString()}`,
        `End time: ${new Date(Number(deployTime + duration) * 1000).toString()}`,
        `Number of signups ${numSignups}`,
        `State tree merged: ${mergedStateRoot}`,
        `Mode: ${mode === 0n ? "Quadratic Voting" : "Non-Quadratic Voting"}`,
      ].join("\n"),
    ),
  );

  return {
    id,
    address: pollContracts.poll,
    deployTime,
    duration,
    numSignups,
    isMerged,
    mode,
  };
};
