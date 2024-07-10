/* eslint-disable no-console */
import { PubKey } from "maci-domainobjs";

import type { MACI, Poll } from "../../../typechain-types";

import { EMode } from "../../../ts/constants";
import { ContractStorage } from "../../helpers/ContractStorage";
import { Deployment } from "../../helpers/Deployment";
import { EContracts } from "../../helpers/types";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment.deployTask("poll:deploy-poll", "Deploy poll").then((task) =>
  task.setAction(async (_, hre) => {
    deployment.setHre(hre);

    const maciContractAddress = storage.getAddress(EContracts.MACI, hre.network.name);
    const verifierContractAddress = storage.getAddress(EContracts.Verifier, hre.network.name);
    const vkRegistryContractAddress = storage.getAddress(EContracts.VkRegistry, hre.network.name);

    if (!maciContractAddress) {
      throw new Error("Need to deploy MACI contract first");
    }

    if (!verifierContractAddress) {
      throw new Error("Need to deploy Verifier contract first");
    }

    if (!vkRegistryContractAddress) {
      throw new Error("Need to deploy VkRegistry contract first");
    }

    const maciContract = await deployment.getContract<MACI>({ name: EContracts.MACI });
    const pollId = await maciContract.nextPollId();

    const coordinatorPubkey = deployment.getDeployConfigField<string>(EContracts.Poll, "coordinatorPubkey");
    const pollDuration = deployment.getDeployConfigField<number>(EContracts.Poll, "pollDuration");
    const intStateTreeDepth = deployment.getDeployConfigField<number>(EContracts.VkRegistry, "intStateTreeDepth");
    const messageBatchSize = deployment.getDeployConfigField<number>(EContracts.VkRegistry, "messageBatchSize");
    const voteOptionTreeDepth = deployment.getDeployConfigField<number>(EContracts.VkRegistry, "voteOptionTreeDepth");

    const useQuadraticVoting =
      deployment.getDeployConfigField<boolean | null>(EContracts.Poll, "useQuadraticVoting") ?? false;
    const unserializedKey = PubKey.deserialize(coordinatorPubkey);
    const mode = useQuadraticVoting ? EMode.QV : EMode.NON_QV;

    const [pollContractAddress, messageProcessorContractAddress, tallyContractAddress] =
      await maciContract.deployPoll.staticCall(
        pollDuration,
        {
          intStateTreeDepth,
          voteOptionTreeDepth,
        },
        messageBatchSize,
        unserializedKey.asContractParam(),
        verifierContractAddress,
        vkRegistryContractAddress,
        mode,
      );

    const tx = await maciContract.deployPoll(
      pollDuration,
      {
        intStateTreeDepth,
        voteOptionTreeDepth,
      },
      messageBatchSize,
      unserializedKey.asContractParam(),
      verifierContractAddress,
      vkRegistryContractAddress,
      mode,
    );

    const receipt = await tx.wait();

    if (receipt?.status !== 1) {
      throw new Error("Deploy poll transaction is failed");
    }

    const pollContract = await deployment.getContract<Poll>({ name: EContracts.Poll, address: pollContractAddress });
    const [maxVoteOptions, extContracts] = await Promise.all([
      pollContract.maxVoteOptions(),
      pollContract.extContracts(),
    ]);

    const messageProcessorContract = await deployment.getContract({
      name: EContracts.MessageProcessor,
      address: messageProcessorContractAddress,
    });

    const tallyContract = await deployment.getContract({
      name: EContracts.Tally,
      address: tallyContractAddress,
    });

    await Promise.all([
      storage.register({
        id: EContracts.Poll,
        key: `poll-${pollId}`,
        contract: pollContract,
        args: [
          pollDuration,
          maxVoteOptions,
          {
            intStateTreeDepth,
            voteOptionTreeDepth,
          },
          {
            messageBatchSize,
          },
          unserializedKey.asContractParam(),
          extContracts,
        ],
        network: hre.network.name,
      }),

      storage.register({
        id: EContracts.MessageProcessor,
        key: `poll-${pollId}`,
        contract: messageProcessorContract,
        args: [verifierContractAddress, vkRegistryContractAddress, pollContractAddress, mode],
        network: hre.network.name,
      }),

      storage.register({
        id: EContracts.Tally,
        key: `poll-${pollId}`,
        contract: tallyContract,
        args: [
          verifierContractAddress,
          vkRegistryContractAddress,
          pollContractAddress,
          messageProcessorContractAddress,
          mode,
        ],
        network: hre.network.name,
      }),
    ]);
  }),
);
