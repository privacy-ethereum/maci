/* eslint-disable no-console */
import { EMode } from "@maci-protocol/core";
import { type IVerifyingKeyObjectParams, PublicKey, VerifyingKey } from "@maci-protocol/domainobjs";
import { ZeroAddress } from "ethers";

import type { IVerifyingKeyStruct } from "../../../ts/types";
import type { MACI, Poll, IBasePolicy, PollFactory, VerifyingKeysRegistry } from "../../../typechain-types";

import { extractVerifyingKey } from "../../../ts/proofs";
import { EDeploySteps, FULL_POLICY_NAMES } from "../../helpers/constants";
import { ContractStorage } from "../../helpers/ContractStorage";
import { Deployment } from "../../helpers/Deployment";
import { EContracts } from "../../helpers/types";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(EDeploySteps.Poll, "Deploy poll").then((task) =>
  task.setAction(async (_, hre) => {
    deployment.setHre(hre);

    const maciContractAddress = storage.getAddress(EContracts.MACI, hre.network.name);
    const verifierContractAddress = storage.getAddress(EContracts.Verifier, hre.network.name);
    const verifyingKeysRegistryContractAddress = storage.getAddress(EContracts.VerifyingKeysRegistry, hre.network.name);

    if (!maciContractAddress) {
      throw new Error("Need to deploy MACI contract first");
    }

    if (!verifierContractAddress) {
      throw new Error("Need to deploy Verifier contract first");
    }

    if (!verifyingKeysRegistryContractAddress) {
      throw new Error("Need to deploy VerifyingKeysRegistry contract first");
    }

    const maciContract = await deployment.getContract<MACI>({ name: EContracts.MACI });
    const pollId = await maciContract.nextPollId();

    const coordinatorPublicKey = deployment.getDeployConfigField<string>(EContracts.Poll, "coordinatorPublicKey");
    const pollStartTimestamp = deployment.getDeployConfigField<number>(EContracts.Poll, "pollStartDate");
    const pollEndTimestamp = deployment.getDeployConfigField<number>(EContracts.Poll, "pollEndDate");
    const tallyProcessingStateTreeDepth = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "tallyProcessingStateTreeDepth",
    );
    const messageBatchSize = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "messageBatchSize",
    );
    const stateTreeDepth =
      deployment.getDeployConfigField<number>(EContracts.Poll, "stateTreeDepth") ||
      (await maciContract.stateTreeDepth());
    const voteOptionTreeDepth = deployment.getDeployConfigField<number>(
      EContracts.VerifyingKeysRegistry,
      "voteOptionTreeDepth",
    );
    const relayers = deployment
      .getDeployConfigField<string | undefined>(EContracts.Poll, "relayers")
      ?.split(",")
      .map((value) => value.trim()) || [ZeroAddress];

    const mode = deployment.getDeployConfigField<EMode | null>(EContracts.Poll, "mode") ?? EMode.QV;
    const unserializedKey = PublicKey.deserialize(coordinatorPublicKey);

    const policy =
      deployment.getDeployConfigField<EContracts | null>(EContracts.Poll, "policy") || EContracts.FreeForAllPolicy;
    const fullPolicyName = FULL_POLICY_NAMES[policy as keyof typeof FULL_POLICY_NAMES] as unknown as EContracts;
    const policyContractAddress = storage.mustGetAddress(fullPolicyName, hre.network.name, `poll-${pollId}`);

    const initialVoiceCreditProxy =
      deployment.getDeployConfigField<EContracts | null>(EContracts.Poll, "initialVoiceCreditProxy") ||
      EContracts.ConstantInitialVoiceCreditProxy;
    const initialVoiceCreditProxyContractAddress = storage.mustGetAddress(initialVoiceCreditProxy, hre.network.name);

    const voteOptions = deployment.getDeployConfigField<number>(EContracts.Poll, "voteOptions");

    const verifyingKeysRegistryContract = await deployment.getContract<VerifyingKeysRegistry>({
      name: EContracts.VerifyingKeysRegistry,
      address: verifyingKeysRegistryContractAddress,
    });

    const pollJoiningZkeyPath = deployment.getDeployConfigField<string>(
      EContracts.VerifyingKeysRegistry,
      "zkeys.pollJoiningZkey.zkey",
    );
    const pollJoinedZkeyPath = deployment.getDeployConfigField<string>(
      EContracts.VerifyingKeysRegistry,
      "zkeys.pollJoinedZkey.zkey",
    );

    const [pollJoiningVerifyingKey, pollJoinedVerifyingKey] = await Promise.all([
      pollJoiningZkeyPath && extractVerifyingKey(pollJoiningZkeyPath),
      pollJoinedZkeyPath && extractVerifyingKey(pollJoinedZkeyPath),
    ]).then((verifyingKeys) =>
      verifyingKeys.map(
        (verifyingKey: IVerifyingKeyObjectParams | "" | undefined) =>
          verifyingKey && VerifyingKey.fromObj(verifyingKey),
      ),
    );

    if (!pollJoiningVerifyingKey) {
      throw new Error("Poll joining zkey is not set");
    }

    if (!pollJoinedVerifyingKey) {
      throw new Error("Poll joined zkey is not set");
    }

    const [pollJoiningVerifyingKeySignature, pollJoinedVerifyingKeySignature] = await Promise.all([
      verifyingKeysRegistryContract.generatePollJoiningVerifyingKeySignature(stateTreeDepth),
      verifyingKeysRegistryContract.generatePollJoinedVerifyingKeySignature(stateTreeDepth),
    ]);
    const [pollJoiningVerifyingKeyOnchain, pollJoinedVerifyingKeyOnchain] = await Promise.all([
      verifyingKeysRegistryContract.getPollJoiningVerifyingKeyBySignature(pollJoiningVerifyingKeySignature),
      verifyingKeysRegistryContract.getPollJoinedVerifyingKeyBySignature(pollJoinedVerifyingKeySignature),
    ]);

    const isPollJoiningVerifyingKeySet = pollJoiningVerifyingKey.equals(
      VerifyingKey.fromContract(pollJoiningVerifyingKeyOnchain),
    );

    if (!isPollJoiningVerifyingKeySet) {
      await verifyingKeysRegistryContract
        .setPollJoiningVerifyingKey(stateTreeDepth, pollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct)
        .then((tx) => tx.wait());
    }

    const isPollJoinedVerifyingKeySet = pollJoinedVerifyingKey.equals(
      VerifyingKey.fromContract(pollJoinedVerifyingKeyOnchain),
    );

    if (!isPollJoinedVerifyingKeySet) {
      await verifyingKeysRegistryContract
        .setPollJoinedVerifyingKey(stateTreeDepth, pollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct)
        .then((tx) => tx.wait());
    }

    const receipt = await maciContract
      .deployPoll({
        startDate: pollStartTimestamp,
        endDate: pollEndTimestamp,
        treeDepths: {
          tallyProcessingStateTreeDepth,
          voteOptionTreeDepth,
          stateTreeDepth,
        },
        messageBatchSize,
        coordinatorPublicKey: unserializedKey.asContractParam(),
        verifier: verifierContractAddress,
        verifyingKeysRegistry: verifyingKeysRegistryContractAddress,
        mode,
        policy: policyContractAddress,
        initialVoiceCreditProxy: initialVoiceCreditProxyContractAddress,
        relayers,
        voteOptions,
      })
      .then((tx) => tx.wait());

    if (receipt?.status !== 1) {
      throw new Error("Deploy poll transaction is failed");
    }

    const pollContracts = await maciContract.getPoll(pollId);
    const pollContractAddress = pollContracts.poll;
    const messageProcessorContractAddress = pollContracts.messageProcessor;
    const tallyContractAddress = pollContracts.tally;

    const pollContract = await deployment.getContract<Poll>({ name: EContracts.Poll, address: pollContractAddress });

    const policyContract = await deployment.getContract<IBasePolicy>({
      name: fullPolicyName,
      address: policyContractAddress,
    });

    await policyContract.setTarget(pollContractAddress).then((tx) => tx.wait());

    const messageProcessorContract = await deployment.getContract({
      name: EContracts.MessageProcessor,
      address: messageProcessorContractAddress,
    });

    const tallyContract = await deployment.getContract({
      name: EContracts.Tally,
      address: tallyContractAddress,
    });

    const [pollFactory, messageProcessorFactory, tallyFactory] = await Promise.all([
      deployment.getContract<PollFactory>({
        name: EContracts.PollFactory,
      }),
      deployment.getContract<PollFactory>({
        name: EContracts.MessageProcessorFactory,
      }),
      deployment.getContract<PollFactory>({
        name: EContracts.TallyFactory,
      }),
    ]);

    const [pollImplementation, messageProcessorImplementation, tallyImplementation] = await Promise.all([
      pollFactory.IMPLEMENTATION(),
      messageProcessorFactory.IMPLEMENTATION(),
      tallyFactory.IMPLEMENTATION(),
    ]);

    await Promise.all([
      storage.register({
        id: EContracts.Poll,
        key: `poll-${pollId}`,
        implementation: pollImplementation,
        contract: pollContract,
        args: [],
        network: hre.network.name,
      }),

      storage.register({
        id: EContracts.MessageProcessor,
        key: `poll-${pollId}`,
        implementation: messageProcessorImplementation,
        contract: messageProcessorContract,
        args: [],
        network: hre.network.name,
      }),

      storage.register({
        id: EContracts.Tally,
        key: `poll-${pollId}`,
        implementation: tallyImplementation,
        contract: tallyContract,
        args: [],
        network: hre.network.name,
      }),
    ]);
  }),
);
