import type { MACI, IBasePolicy } from "../../../typechain-types";

import { generateEmptyBallotRoots } from "../../../ts/generateEmptyBallotRoots";
import { info, logGreen } from "../../../ts/logger";
import { EDeploySteps, FULL_POLICY_NAMES } from "../../helpers/constants";
import { ContractStorage } from "../../helpers/ContractStorage";
import { Deployment } from "../../helpers/Deployment";
import { EContracts, type IDeployParams } from "../../helpers/types";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

const DEFAULT_STATE_TREE_DEPTH = 10;

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(EDeploySteps.Maci, "Deploy MACI contract").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    const maciContractAddress = storage.getAddress(EContracts.MACI, hre.network.name);

    if (incremental && maciContractAddress) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the ${EContracts.MACI} contract`) });
      return;
    }

    const poseidonT3ContractAddress = storage.mustGetAddress(EContracts.PoseidonT3, hre.network.name);
    const poseidonT4ContractAddress = storage.mustGetAddress(EContracts.PoseidonT4, hre.network.name);
    const poseidonT5ContractAddress = storage.mustGetAddress(EContracts.PoseidonT5, hre.network.name);
    const poseidonT6ContractAddress = storage.mustGetAddress(EContracts.PoseidonT6, hre.network.name);

    const libraries = {
      "contracts/crypto/PoseidonT3.sol:PoseidonT3": poseidonT3ContractAddress,
      "contracts/crypto/PoseidonT4.sol:PoseidonT4": poseidonT4ContractAddress,
      "contracts/crypto/PoseidonT5.sol:PoseidonT5": poseidonT5ContractAddress,
      "contracts/crypto/PoseidonT6.sol:PoseidonT6": poseidonT6ContractAddress,
    };

    const maciContractFactory = await hre.ethers.getContractFactory(EContracts.MACI, {
      signer: deployer,
      libraries,
    });

    const policy =
      deployment.getDeployConfigField<EContracts | null>(EContracts.MACI, "policy") || EContracts.FreeForAllPolicy;
    const fullPolicyName = FULL_POLICY_NAMES[policy as keyof typeof FULL_POLICY_NAMES] as unknown as EContracts;
    const policyContractAddress = storage.mustGetAddress(fullPolicyName, hre.network.name);
    const pollFactoryContractAddress = storage.mustGetAddress(EContracts.PollFactory, hre.network.name);
    const messageProcessorFactoryContractAddress = storage.mustGetAddress(
      EContracts.MessageProcessorFactory,
      hre.network.name,
    );
    const tallyFactoryContractAddress = storage.mustGetAddress(EContracts.TallyFactory, hre.network.name);

    const stateTreeDepth =
      deployment.getDeployConfigField<number | null>(EContracts.MACI, "stateTreeDepth") ?? DEFAULT_STATE_TREE_DEPTH;

    const emptyBallotRoots = generateEmptyBallotRoots(stateTreeDepth);

    const maciContract = await deployment.deployContractWithLinkedLibraries<MACI>(
      { contractFactory: maciContractFactory },
      pollFactoryContractAddress,
      messageProcessorFactoryContractAddress,
      tallyFactoryContractAddress,
      policyContractAddress,
      stateTreeDepth,
      emptyBallotRoots,
    );

    const policyContract = await deployment.getContract<IBasePolicy>({
      name: fullPolicyName,
      address: policyContractAddress,
    });
    const maciInstanceAddress = await maciContract.getAddress();

    await policyContract.setTarget(maciInstanceAddress).then((tx) => tx.wait());

    await storage.register({
      id: EContracts.MACI,
      contract: maciContract,
      libraries,
      args: [
        pollFactoryContractAddress,
        messageProcessorFactoryContractAddress,
        tallyFactoryContractAddress,
        policyContractAddress,
        stateTreeDepth,
        emptyBallotRoots.map((root) => root.toString()),
      ],
      network: hre.network.name,
    });
  }),
);
