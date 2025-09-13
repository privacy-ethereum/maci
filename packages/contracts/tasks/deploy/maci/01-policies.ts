import { hexToBigInt, uuidToBigInt } from "@pcd/util";

import type {
  EASCheckerFactory,
  EASPolicyFactory,
  ERC20VotesCheckerFactory,
  ERC20VotesPolicyFactory,
  ERC20CheckerFactory,
  ERC20PolicyFactory,
  FreeForAllCheckerFactory,
  FreeForAllPolicyFactory,
  GitcoinPassportCheckerFactory,
  GitcoinPassportPolicyFactory,
  HatsCheckerFactory,
  HatsPolicyFactory,
  MerkleProofCheckerFactory,
  MerkleProofPolicyFactory,
  SemaphoreCheckerFactory,
  SemaphorePolicyFactory,
  ZupassCheckerFactory,
  ZupassPolicyFactory,
} from "../../../typechain-types";

import { info, logGreen } from "../../../ts/logger";
import { EDeploySteps, ESupportedChains } from "../../helpers/constants";
import { ContractStorage } from "../../helpers/ContractStorage";
import { Deployment } from "../../helpers/Deployment";
import {
  ECheckerFactories,
  ECheckers,
  EContracts,
  EPolicyFactories,
  EPolicies,
  type IDeployParams,
} from "../../helpers/types";

const deployment = Deployment.getInstance();
const storage = ContractStorage.getInstance();

/**
 * Deploy step registration and task itself
 */
deployment.deployTask(EDeploySteps.Policies, "Deploy policies").then((task) =>
  task.setAction(async ({ incremental }: IDeployParams, hre) => {
    deployment.setHre(hre);
    const deployer = await deployment.getDeployer();

    const {
      deployFreeForAllSignUpPolicy,
      deployZupassSignUpPolicy,
      deployEASSignUpPolicy,
      deployGitcoinPassportPolicy,
      deployMerkleProofPolicy,
      deploySemaphoreSignupPolicy,
      deployHatsSignupPolicy,
      getDeployedPolicyProxyFactories,
      deployERC20VotesPolicy,
      deployERC20Policy,
    } = await import("../../../ts/deploy");

    const freeForAllPolicyContractAddress = storage.getAddress(EPolicies.FreeForAll, hre.network.name);
    const easPolicyContractAddress = storage.getAddress(EPolicies.EAS, hre.network.name);
    const hatsPolicyContractAddress = storage.getAddress(EPolicies.Hats, hre.network.name);
    const gitcoinPolicyContractAddress = storage.getAddress(EPolicies.GitcoinPassport, hre.network.name);
    const zupassPolicyContractAddress = storage.getAddress(EPolicies.Zupass, hre.network.name);
    const semaphorePolicyContractAddress = storage.getAddress(EPolicies.Semaphore, hre.network.name);
    const merkleProofPolicyContractAddress = storage.getAddress(EPolicies.MerkleProof, hre.network.name);
    const erc20VotesPolicyContractAddress = storage.getAddress(EPolicies.ERC20Votes, hre.network.name);
    const erc20PolicyContractAddress = storage.getAddress(EPolicies.ERC20, hre.network.name);

    const deployFreeForAllPolicy = deployment.getDeployConfigField(EContracts.FreeForAllPolicy, "deploy");
    const deployEASPolicy = deployment.getDeployConfigField(EContracts.EASPolicy, "deploy");
    const deployGitcoinPolicy = deployment.getDeployConfigField(EContracts.GitcoinPassportPolicy, "deploy");
    const deployZupassPolicy = deployment.getDeployConfigField(EContracts.ZupassPolicy, "deploy");
    const deploySemaphorePolicy = deployment.getDeployConfigField(EContracts.SemaphorePolicy, "deploy");
    const deployHatsSinglePolicy = deployment.getDeployConfigField(EContracts.HatsPolicy, "deploy");
    const deployMerkleGateekeper = deployment.getDeployConfigField(EContracts.MerkleProofPolicy, "deploy");
    const deployERC20VotesExcubiaePolicy = deployment.getDeployConfigField(EContracts.ERC20VotesPolicy, "deploy");
    const deployERC20ExcubiaePolicy = deployment.getDeployConfigField(EContracts.ERC20Policy, "deploy");

    const skipDeployFreeForAllPolicy = deployFreeForAllPolicy !== true;
    const skipDeployEASPolicy = deployEASPolicy !== true;
    const skipDeployGitcoinPolicy = deployGitcoinPolicy !== true;
    const skipDeployZupassPolicy = deployZupassPolicy !== true;
    const skipDeploySemaphorePolicy = deploySemaphorePolicy !== true;
    const skipDeployHatsPolicy = deployHatsSinglePolicy !== true;
    const skipDeployMerkleProofPolicy = deployMerkleGateekeper !== true;
    const skipDeployERC20VotesPolicy = deployERC20VotesExcubiaePolicy !== true;
    const skipDeployERC20Policy = deployERC20ExcubiaePolicy !== true;
    const canSkipDeploy =
      incremental &&
      (freeForAllPolicyContractAddress || skipDeployFreeForAllPolicy) &&
      (easPolicyContractAddress || skipDeployEASPolicy) &&
      (gitcoinPolicyContractAddress || skipDeployGitcoinPolicy) &&
      (zupassPolicyContractAddress || skipDeployZupassPolicy) &&
      (semaphorePolicyContractAddress || skipDeploySemaphorePolicy) &&
      (hatsPolicyContractAddress || skipDeployHatsPolicy) &&
      (merkleProofPolicyContractAddress || skipDeployMerkleProofPolicy) &&
      (erc20VotesPolicyContractAddress || skipDeployERC20VotesPolicy) &&
      (erc20PolicyContractAddress || skipDeployERC20Policy) &&
      (!skipDeployFreeForAllPolicy ||
        !skipDeployEASPolicy ||
        !skipDeployGitcoinPolicy ||
        !skipDeployZupassPolicy ||
        !skipDeploySemaphorePolicy ||
        !skipDeployHatsPolicy ||
        !skipDeployMerkleProofPolicy ||
        !skipDeployERC20VotesPolicy ||
        !skipDeployERC20Policy);

    if (canSkipDeploy) {
      // eslint-disable-next-line no-console
      logGreen({ text: info(`Skipping deployment of the Policy contract`) });
      return;
    }

    if (!skipDeployFreeForAllPolicy) {
      const factories = await getDeployedPolicyProxyFactories<FreeForAllCheckerFactory, FreeForAllPolicyFactory>({
        policy: EPolicyFactories.FreeForAll,
        checker: ECheckerFactories.FreeForAll,
        network: hre.network.name,
        signer: deployer,
      });

      const [
        freeForAllPolicyContract,
        freeForAllCheckerContract,
        freeForAllPolicyFactoryContract,
        freeForAllCheckerFactoryContract,
      ] = await deployFreeForAllSignUpPolicy(factories, deployer);

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        freeForAllPolicyFactoryContract.IMPLEMENTATION(),
        freeForAllCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.FreeForAll,
          contract: freeForAllPolicyContract,
          name: EPolicies.FreeForAll,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.FreeForAll,
          contract: freeForAllCheckerContract,
          name: ECheckers.FreeForAll,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.FreeForAll,
          contract: freeForAllPolicyFactoryContract,
          name: EPolicyFactories.FreeForAll,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.FreeForAll,
          contract: freeForAllCheckerFactoryContract,
          name: ECheckerFactories.FreeForAll,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    const isSupportedEASPolicyNetwork = ![ESupportedChains.Hardhat, ESupportedChains.Coverage].includes(
      hre.network.name as ESupportedChains,
    );

    if (!skipDeployEASPolicy && isSupportedEASPolicyNetwork) {
      const easAddress = deployment.getDeployConfigField<string>(EContracts.EASPolicy, "easAddress", true);
      const encodedSchema = deployment.getDeployConfigField<string>(EContracts.EASPolicy, "schema", true);
      const attester = deployment.getDeployConfigField<string>(EContracts.EASPolicy, "attester", true);

      const factories = await getDeployedPolicyProxyFactories<EASCheckerFactory, EASPolicyFactory>({
        policy: EPolicyFactories.EAS,
        checker: ECheckerFactories.EAS,
        network: hre.network.name,
        signer: deployer,
      });

      const [easPolicyContract, easCheckerContract, easPolicyFactoryContract, easCheckerFactoryContract] =
        await deployEASSignUpPolicy(
          {
            eas: easAddress,
            attester,
            schema: encodedSchema,
          },
          factories,
          deployer,
          true,
        );

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        easPolicyFactoryContract.IMPLEMENTATION(),
        easCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.EAS,
          contract: easPolicyContract,
          name: EPolicies.EAS,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.EAS,
          contract: easCheckerContract,
          name: ECheckers.EAS,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.EAS,
          contract: easPolicyFactoryContract,
          name: EPolicyFactories.EAS,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.EAS,
          contract: easCheckerFactoryContract,
          name: ECheckerFactories.EAS,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    const isSupportedGitcoinPolicyNetwork = ![
      ESupportedChains.Hardhat,
      ESupportedChains.Coverage,
      ESupportedChains.Sepolia,
      ESupportedChains.Mainnet,
    ].includes(hre.network.name as ESupportedChains);

    if (!skipDeployGitcoinPolicy && isSupportedGitcoinPolicyNetwork) {
      const gitcoinPolicyDecoderAddress = deployment.getDeployConfigField<string>(
        EContracts.GitcoinPassportPolicy,
        "decoderAddress",
        true,
      );
      const gitcoinPolicyPassingScore = deployment.getDeployConfigField<number>(
        EContracts.GitcoinPassportPolicy,
        "passingScore",
        true,
      );

      const factories = await getDeployedPolicyProxyFactories<
        GitcoinPassportCheckerFactory,
        GitcoinPassportPolicyFactory
      >({
        policy: EPolicyFactories.GitcoinPassport,
        checker: ECheckerFactories.GitcoinPassport,
        network: hre.network.name,
        signer: deployer,
      });

      const [
        gitcoinPolicyContract,
        gitcoinCheckerContract,
        gitcoinPolicyFactoryContract,
        gitcoinCheckerFactoryContract,
      ] = await deployGitcoinPassportPolicy(
        {
          decoderAddress: gitcoinPolicyDecoderAddress,
          minimumScore: gitcoinPolicyPassingScore,
        },
        factories,
        deployer,
        true,
      );

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        gitcoinPolicyFactoryContract.IMPLEMENTATION(),
        gitcoinCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.GitcoinPassport,
          contract: gitcoinPolicyContract,
          name: EPolicies.GitcoinPassport,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.GitcoinPassport,
          contract: gitcoinCheckerContract,
          name: ECheckers.GitcoinPassport,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.GitcoinPassport,
          contract: gitcoinPolicyFactoryContract,
          name: EPolicyFactories.GitcoinPassport,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.GitcoinPassport,
          contract: gitcoinCheckerFactoryContract,
          name: ECheckerFactories.GitcoinPassport,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    if (!skipDeployZupassPolicy) {
      const eventId = deployment.getDeployConfigField<string>(EContracts.ZupassPolicy, "eventId", true);
      const validEventId = uuidToBigInt(eventId);
      const signer1 = deployment.getDeployConfigField<string>(EContracts.ZupassPolicy, "signer1", true);
      const validSigner1 = hexToBigInt(signer1);
      const signer2 = deployment.getDeployConfigField<string>(EContracts.ZupassPolicy, "signer2", true);
      const validSigner2 = hexToBigInt(signer2);
      let verifier = deployment.getDeployConfigField<string | undefined>(EContracts.ZupassPolicy, "zupassVerifier");

      if (!verifier) {
        const verifierContract = await deployment.deployContract({
          name: EContracts.ZupassGroth16Verifier,
          signer: deployer,
        });
        verifier = await verifierContract.getAddress();
      }

      const factories = await getDeployedPolicyProxyFactories<ZupassCheckerFactory, ZupassPolicyFactory>({
        policy: EPolicyFactories.Zupass,
        checker: ECheckerFactories.Zupass,
        network: hre.network.name,
        signer: deployer,
      });

      const [zupassPolicyContract, zupassCheckerContract, zupassPolicyFactoryContract, zupassCheckerFactoryContract] =
        await deployZupassSignUpPolicy(
          { eventId: validEventId, signer1: validSigner1, signer2: validSigner2, verifier },
          factories,
          deployer,
        );

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        zupassPolicyFactoryContract.IMPLEMENTATION(),
        zupassCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.Zupass,
          contract: zupassPolicyContract,
          name: EPolicies.Zupass,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.Zupass,
          contract: zupassCheckerContract,
          name: ECheckers.Zupass,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.Zupass,
          contract: zupassCheckerFactoryContract,
          name: ECheckerFactories.Zupass,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.Zupass,
          contract: zupassPolicyFactoryContract,
          name: EPolicyFactories.Zupass,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    if (!skipDeploySemaphorePolicy) {
      const semaphoreContractAddress = deployment.getDeployConfigField<string>(
        EContracts.SemaphorePolicy,
        "semaphoreContract",
        true,
      );
      const groupId = deployment.getDeployConfigField<number>(EContracts.SemaphorePolicy, "groupId", true);

      const factories = await getDeployedPolicyProxyFactories<SemaphoreCheckerFactory, SemaphorePolicyFactory>({
        policy: EPolicyFactories.Semaphore,
        checker: ECheckerFactories.Semaphore,
        network: hre.network.name,
        signer: deployer,
      });

      const [
        semaphorePolicyContract,
        semaphoreCheckerContract,
        semaphorePolicyFactoryContract,
        semaphoreCheckerFactoryContract,
      ] = await deploySemaphoreSignupPolicy(
        { semaphore: semaphoreContractAddress, groupId },
        factories,
        deployer,
        true,
      );

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        semaphorePolicyFactoryContract.IMPLEMENTATION(),
        semaphoreCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.Semaphore,
          contract: semaphorePolicyContract,
          name: EPolicies.Semaphore,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.Semaphore,
          contract: semaphoreCheckerContract,
          name: ECheckers.Semaphore,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.Semaphore,
          contract: semaphorePolicyFactoryContract,
          name: EPolicyFactories.Semaphore,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.Semaphore,
          contract: semaphoreCheckerFactoryContract,
          name: ECheckerFactories.Semaphore,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    if (!skipDeployHatsPolicy) {
      // get args
      const criterionHats = deployment.getDeployConfigField<string[]>(EContracts.HatsPolicy, "criterionHats", true);
      const hatsProtocolAddress = deployment.getDeployConfigField<string>(
        EContracts.HatsPolicy,
        "hatsProtocolAddress",
        true,
      );

      const factories = await getDeployedPolicyProxyFactories<HatsCheckerFactory, HatsPolicyFactory>({
        policy: EPolicyFactories.Hats,
        checker: ECheckerFactories.Hats,
        network: hre.network.name,
        signer: deployer,
      });

      const [hatsPolicyContract, hatsCheckerContract, hatsPolicyFactoryContract, hatsCheckerFactoryContract] =
        await deployHatsSignupPolicy({ hats: hatsProtocolAddress, criterionHats }, factories, deployer, true);

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        hatsPolicyFactoryContract.IMPLEMENTATION(),
        hatsCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.Hats,
          contract: hatsPolicyContract,
          name: EPolicies.Hats,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.Hats,
          contract: hatsCheckerContract,
          name: ECheckers.Hats,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.Hats,
          contract: hatsPolicyFactoryContract,
          name: EPolicyFactories.Hats,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.Hats,
          contract: hatsCheckerFactoryContract,
          name: ECheckerFactories.Hats,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    if (!skipDeployMerkleProofPolicy) {
      const root = deployment.getDeployConfigField<string>(EContracts.MerkleProofPolicy, "root", true);

      const factories = await getDeployedPolicyProxyFactories<MerkleProofCheckerFactory, MerkleProofPolicyFactory>({
        policy: EPolicyFactories.MerkleProof,
        checker: ECheckerFactories.MerkleProof,
        network: hre.network.name,
        signer: deployer,
      });

      const [
        merkleProofPolicyContract,
        merkleProofCheckerContract,
        merkleProofPolicyFactoryContract,
        merkleProofCheckerFactoryContract,
      ] = await deployMerkleProofPolicy({ root }, factories, deployer, true);

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        merkleProofPolicyFactoryContract.IMPLEMENTATION(),
        merkleProofCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.MerkleProof,
          contract: merkleProofPolicyContract,
          name: EPolicies.MerkleProof,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.MerkleProof,
          contract: merkleProofCheckerContract,
          name: ECheckers.MerkleProof,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.MerkleProof,
          contract: merkleProofPolicyFactoryContract,
          name: EPolicyFactories.MerkleProof,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.MerkleProof,
          contract: merkleProofCheckerFactoryContract,
          name: ECheckerFactories.MerkleProof,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    if (!skipDeployERC20VotesPolicy) {
      const token = deployment.getDeployConfigField<string>(EContracts.ERC20VotesPolicy, "token", true);
      const threshold = deployment.getDeployConfigField<number>(EContracts.ERC20VotesPolicy, "threshold", true);
      const snapshotBlock = deployment.getDeployConfigField<number>(EContracts.ERC20VotesPolicy, "snapshotBlock", true);

      const factories = await getDeployedPolicyProxyFactories<ERC20VotesCheckerFactory, ERC20VotesPolicyFactory>({
        policy: EPolicyFactories.ERC20Votes,
        checker: ECheckerFactories.ERC20Votes,
        network: hre.network.name,
        signer: deployer,
      });

      const [
        erc20VotesPolicyContract,
        erc20VotesCheckerContract,
        erc20VotesPolicyFactoryContract,
        erc20VotesCheckerFactoryContract,
      ] = await deployERC20VotesPolicy(
        {
          token,
          threshold: BigInt(threshold),
          snapshotBlock: BigInt(snapshotBlock),
        },
        factories,
        deployer,
        true,
      );

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        erc20VotesPolicyFactoryContract.IMPLEMENTATION(),
        erc20VotesCheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.ERC20Votes,
          contract: erc20VotesPolicyContract,
          name: EPolicies.ERC20Votes,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.ERC20Votes,
          contract: erc20VotesCheckerContract,
          name: ECheckers.ERC20Votes,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.ERC20Votes,
          contract: erc20VotesPolicyFactoryContract,
          name: EPolicyFactories.ERC20Votes,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.ERC20Votes,
          contract: erc20VotesCheckerFactoryContract,
          name: ECheckerFactories.ERC20Votes,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }

    if (!skipDeployERC20Policy) {
      const token = deployment.getDeployConfigField<string>(EContracts.ERC20Policy, "token", true);
      const threshold = deployment.getDeployConfigField<number>(EContracts.ERC20Policy, "threshold", true);

      const factories = await getDeployedPolicyProxyFactories<ERC20CheckerFactory, ERC20PolicyFactory>({
        policy: EPolicyFactories.ERC20Votes,
        checker: ECheckerFactories.ERC20Votes,
        network: hre.network.name,
        signer: deployer,
      });

      const [erc20PolicyContract, erc20CheckerContract, erc20PolicyFactoryContract, erc20CheckerFactoryContract] =
        await deployERC20Policy(
          {
            token,
            threshold: BigInt(threshold),
          },
          factories,
          deployer,
          true,
        );

      const [policyContractImplementation, checkerContractImplementation] = await Promise.all([
        erc20PolicyFactoryContract.IMPLEMENTATION(),
        erc20CheckerFactoryContract.IMPLEMENTATION(),
      ]);

      await Promise.all([
        storage.register({
          id: EPolicies.ERC20,
          contract: erc20PolicyContract,
          name: EPolicies.ERC20,
          implementation: policyContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckers.ERC20,
          contract: erc20CheckerContract,
          name: ECheckers.ERC20,
          implementation: checkerContractImplementation,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: EPolicyFactories.ERC20,
          contract: erc20PolicyFactoryContract,
          name: EPolicyFactories.ERC20,
          args: [],
          network: hre.network.name,
        }),
        storage.register({
          id: ECheckerFactories.ERC20,
          contract: erc20CheckerFactoryContract,
          name: ECheckerFactories.ERC20,
          args: [],
          network: hre.network.name,
        }),
      ]);
    }
  }),
);
