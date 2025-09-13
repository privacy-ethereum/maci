import type {
  ConstantInitialVoiceCreditProxyFactory,
  ERC20VotesInitialVoiceCreditProxyFactory,
} from "../../../typechain-types";

import { info, logGreen } from "../../../ts/logger";
import { EDeploySteps } from "../../helpers/constants";
import { ContractStorage } from "../../helpers/ContractStorage";
import { Deployment } from "../../helpers/Deployment";
import {
  EContracts,
  EInitialVoiceCreditProxies,
  EInitialVoiceCreditProxiesFactories,
  type IDeployParams,
} from "../../helpers/types";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment
  .deployTask(EDeploySteps.InitialVoiceCreditProxyFactory, "Deploy initial voice credit proxy factory")
  .then((task) =>
    task.setAction(async ({ incremental }: IDeployParams, hre) => {
      deployment.setHre(hre);
      const deployer = await deployment.getDeployer();

      const { deployConstantInitialVoiceCreditProxyFactory, deployERC20VotesInitialVoiceCreditProxyFactory } =
        await import("../../../ts/deploy");

      const voiceCreditProxyType = deployment.getDeployConfigField(EContracts.Poll, "initialVoiceCreditProxy");

      const needDeploy = deployment.getDeployConfigField(voiceCreditProxyType as EInitialVoiceCreditProxies, "deploy");

      if (needDeploy === false) {
        return;
      }

      const skipDeployConstantInitialVoiceCreditProxy = voiceCreditProxyType !== EInitialVoiceCreditProxies.Constant;
      const skipDeployERC20VotesInitialVoiceCreditProxy =
        voiceCreditProxyType !== EInitialVoiceCreditProxies.ERC20Votes;

      if (!skipDeployConstantInitialVoiceCreditProxy) {
        const constantInitialVoiceCreditProxyFactoryAddress = storage.getAddress(
          EInitialVoiceCreditProxiesFactories.Constant,
          hre.network.name,
        );

        if (incremental && constantInitialVoiceCreditProxyFactoryAddress) {
          logGreen({
            text: info(`Skipping deployment of the ${EInitialVoiceCreditProxiesFactories.Constant} contract`),
          });
          return;
        }

        const constantProxyFactoryAddress = storage.getAddress(
          EInitialVoiceCreditProxiesFactories.Constant,
          hre.network.name,
        );
        const constantInitialVoiceCreditProxyContractFactory = constantProxyFactoryAddress
          ? await deployment.getContract<ConstantInitialVoiceCreditProxyFactory>({
              name: EContracts.ConstantInitialVoiceCreditProxyFactory,
              address: constantProxyFactoryAddress,
              signer: deployer,
            })
          : await deployConstantInitialVoiceCreditProxyFactory(deployer, true);

        await storage.register({
          id: EInitialVoiceCreditProxiesFactories.Constant,
          contract: constantInitialVoiceCreditProxyContractFactory,
          args: [],
          network: hre.network.name,
        });
      }

      if (!skipDeployERC20VotesInitialVoiceCreditProxy) {
        const erc20VotesInitialVoiceCreditProxyFactoryAddress = storage.getAddress(
          EInitialVoiceCreditProxiesFactories.ERC20Votes,
          hre.network.name,
        );

        if (incremental && erc20VotesInitialVoiceCreditProxyFactoryAddress) {
          logGreen({
            text: info(`Skipping deployment of the ${EContracts.ERC20VotesInitialVoiceCreditProxyFactory} contract`),
          });
          return;
        }

        const erc20VotesProxyFactoryAddress = storage.getAddress(
          EInitialVoiceCreditProxiesFactories.ERC20Votes,
          hre.network.name,
        );
        const erc20VotesInitialVoiceCreditProxyContractFactory = erc20VotesProxyFactoryAddress
          ? await deployment.getContract<ERC20VotesInitialVoiceCreditProxyFactory>({
              name: EContracts.ERC20VotesInitialVoiceCreditProxyFactory,
              address: erc20VotesProxyFactoryAddress,
              signer: deployer,
            })
          : await deployERC20VotesInitialVoiceCreditProxyFactory(deployer, true);

        await storage.register({
          id: EInitialVoiceCreditProxiesFactories.ERC20Votes,
          contract: erc20VotesInitialVoiceCreditProxyContractFactory,
          args: [],
          network: hre.network.name,
        });
      }
    }),
  );
