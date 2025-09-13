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
deployment.deployTask(EDeploySteps.TallyFactory, "Deploy tally factory").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    const tallyFactoryContractAddress = storage.getAddress(EContracts.TallyFactory, hre.network.name);

    if (incremental && tallyFactoryContractAddress) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the ${EContracts.TallyFactory} contract`) });
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

    const linkedTallyFactoryContract = await hre.ethers.getContractFactory(EContracts.TallyFactory, {
      signer: deployer,
      libraries,
    });

    const tallyFactoryContract = await deployment.deployContractWithLinkedLibraries({
      contractFactory: linkedTallyFactoryContract,
    });

    await storage.register({
      id: EContracts.TallyFactory,
      contract: tallyFactoryContract,
      libraries,
      args: [],
      network: hre.network.name,
    });
  }),
);
