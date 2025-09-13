import { info, logGreen } from "../../../ts/logger";
import { EDeploySteps } from "../../helpers/constants";
import { ContractStorage } from "../../helpers/ContractStorage";
import { Deployment } from "../../helpers/Deployment";
import { EContracts, type IDeployParams } from "../../helpers/types";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(EDeploySteps.PollFactory, "Deploy poll factory").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    const pollFactoryContractAddress = storage.getAddress(EContracts.PollFactory, hre.network.name);

    if (incremental && pollFactoryContractAddress) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the ${EContracts.PollFactory} contract`) });
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

    const linkedPollFactoryContract = await hre.ethers.getContractFactory(EContracts.PollFactory, {
      signer: deployer,
      libraries,
    });

    const pollFactoryContract = await deployment.deployContractWithLinkedLibraries({
      contractFactory: linkedPollFactoryContract,
    });

    await storage.register({
      id: EContracts.PollFactory,
      contract: pollFactoryContract,
      libraries,
      args: [],
      network: hre.network.name,
    });
  }),
);
