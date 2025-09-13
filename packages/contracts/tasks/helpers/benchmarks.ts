/* eslint-disable no-console */
import { type Message, type Keypair } from "@maci-protocol/domainobjs";
import { TransactionReceipt } from "ethers";

import { error, logGreen, logRed, success } from "../../ts/logger";
import { type MACI, type Poll } from "../../typechain-types";

import { type Deployment } from "./Deployment";
import { EContracts } from "./types";

/**
 * Utility function to send a batch of messages to a poll contract
 * @dev This function will attempt to send a batch of messages to a poll contract
 * and if it fails, it will attempt to send a smaller batch size
 * @param deployment - The deployment instance
 * @param message - The message to send
 * @param keypair - The keypair to sign the message with
 * @param batchSize - The number of messages to send
 */
export async function publishBatch(
  deployment: Deployment,
  message: Message,
  keypair: Keypair,
  batchSize: number,
): Promise<void> {
  // then try and publish a large batch of votes
  const maciContract = await deployment.getContract<MACI>({
    name: EContracts.MACI,
  });
  const lastPollId = (await maciContract.nextPollId()) - 1n;

  const pollContract = await deployment.getContract<Poll>({
    name: EContracts.Poll,
    key: `poll-${lastPollId}`,
  });

  const messageBatch = Array.from({ length: batchSize }, () => message.asContractParam());
  const publicKeyBatch = Array.from({ length: batchSize }, () => keypair.publicKey.asContractParam());
  const deployer = await deployment.getDeployer();

  let optimalBatchSize = batchSize;
  let multiplier = 1;

  while (optimalBatchSize > 0) {
    const finalMessageBatch = messageBatch.slice(0, optimalBatchSize);
    const finalPublicKeyBatch = publicKeyBatch.slice(0, optimalBatchSize);

    try {
      // eslint-disable-next-line no-await-in-loop
      const [feeData, nonce, gasLimit] = await Promise.all([
        deployer.provider?.getFeeData(),
        deployer.provider?.getTransactionCount(deployer),
        pollContract.publishMessageBatch.estimateGas(finalMessageBatch, finalPublicKeyBatch),
      ]);

      // eslint-disable-next-line no-await-in-loop
      const tx = await pollContract.publishMessageBatch(finalMessageBatch, finalPublicKeyBatch, {
        gasPrice: feeData?.gasPrice && !feeData.maxFeePerGas ? Number(feeData.gasPrice) * multiplier : undefined,
        maxFeePerGas: feeData?.maxFeePerGas ? Number(feeData.maxFeePerGas) * multiplier : undefined,
        maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas
          ? Number(feeData.maxPriorityFeePerGas) * multiplier
          : undefined,
        nonce,
        gasLimit,
      });

      const twoMinutesTimeout = 1000 * 60 * 2;

      // eslint-disable-next-line no-await-in-loop
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout error"));
            clearTimeout(timeout);
          }, twoMinutesTimeout);
        }),
      ]);

      if (receipt instanceof TransactionReceipt) {
        logGreen({ text: success(`Successfully published batch of ${optimalBatchSize} messages`) });
        logGreen({ text: success(`Gas used: ${receipt.gasUsed.toString()} wei`) });
        logGreen({ text: success(`Tx: ${tx.hash}`) });

        break; // If successful, we've found the largest working batch size
      } else {
        throw new Error("Invalid receipt");
      }
    } catch (err) {
      // If this size doesn't work, reduce by 1 and try again
      optimalBatchSize -= 1;
      multiplier += 1;
    }
  }

  if (optimalBatchSize > 0) {
    logGreen({ text: success(`Found optimal batch size: ${optimalBatchSize}`) });
  } else {
    logRed({ text: error("Unable to publish even a single message") });
  }
}
