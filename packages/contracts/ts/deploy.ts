import { type ContractFactory, type Signer, type BaseContract, type BigNumberish } from "ethers";

import { ContractStorage } from "../tasks/helpers/ContractStorage";
import { Deployment } from "../tasks/helpers/Deployment";
import {
  type TAbi,
  ECheckerFactories,
  type EContracts,
  EInitialVoiceCreditProxiesFactories,
  EPolicyFactories,
} from "../tasks/helpers/types";
import {
  type FreeForAllPolicy,
  type MockToken,
  type TokenPolicy,
  type GitcoinPassportPolicy,
  type SemaphorePolicy,
  type AnonAadhaarPolicy,
  type FreeForAllPolicyFactory as FreeForAllPolicyFactoryContract,
  type FreeForAllCheckerFactory as FreeForAllCheckerFactoryContract,
  type ZupassCheckerFactory as ZupassCheckerFactoryContract,
  type ZupassPolicyFactory as ZupassPolicyFactoryContract,
  type AnonAadhaarCheckerFactory as AnonAadhaarCheckerFactoryContract,
  type AnonAadhaarPolicyFactory as AnonAadhaarPolicyFactoryContract,
  type EASPolicyFactory as EASPolicyFactoryContract,
  type EASCheckerFactory as EASCheckerFactoryContract,
  type ERC20VotesPolicyFactory as ERC20VotesPolicyFactoryContract,
  type ERC20VotesCheckerFactory as ERC20VotesCheckerFactoryContract,
  type ERC20PolicyFactory as ERC20PolicyFactoryContract,
  type ERC20CheckerFactory as ERC20CheckerFactoryContract,
  type GitcoinPassportCheckerFactory as GitcoinPassportCheckerFactoryContract,
  type GitcoinPassportPolicyFactory as GitcoinPassportPolicyFactoryContract,
  type MerkleProofCheckerFactory as MerkleProofCheckerFactoryContract,
  type MerkleProofPolicyFactory as MerkleProofPolicyFactoryContract,
  type SemaphorePolicyFactory as SemaphorePolicyFactoryContract,
  type SemaphoreCheckerFactory as SemaphoreCheckerFactoryContract,
  type HatsPolicyFactory as HatsPolicyFactoryContract,
  type HatsCheckerFactory as HatsCheckerFactoryContract,
  type TokenPolicyFactory as TokenPolicyFactoryContract,
  type TokenCheckerFactory as TokenCheckerFactoryContract,
  type IBasePolicy,
  type FreeForAllChecker,
  type BaseChecker,
  type ZupassChecker,
  type ZupassPolicy,
  type AnonAadhaarChecker,
  type EASPolicy,
  type EASChecker,
  type GitcoinPassportChecker,
  type MerkleProofPolicy,
  type MerkleProofChecker,
  type SemaphoreChecker,
  type TokenChecker,
  type HatsPolicy,
  type HatsChecker,
  type ConstantInitialVoiceCreditProxy,
  type ERC20VotesInitialVoiceCreditProxy,
  type MACI,
  type MockVerifier,
  type PollFactory,
  type MessageProcessorFactory,
  type TallyFactory,
  type PoseidonT3,
  type PoseidonT4,
  type PoseidonT5,
  type PoseidonT6,
  type Verifier,
  type VerifyingKeysRegistry,
  type ERC20VotesChecker,
  type ERC20VotesPolicy,
  type ERC20Checker,
  type ERC20Policy,
  ERC20VotesChecker__factory as ERC20VotesCheckerFactory,
  ERC20VotesPolicy__factory as ERC20VotesPolicyFactory,
  ERC20Checker__factory as ERC20CheckerFactory,
  ERC20Policy__factory as ERC20PolicyFactory,
  FreeForAllPolicy__factory as FreeForAllPolicyFactory,
  FreeForAllChecker__factory as FreeForAllCheckerFactory,
  ZupassPolicy__factory as ZupassPolicyFactory,
  ZupassChecker__factory as ZupassCheckerFactory,
  AnonAadhaarChecker__factory as AnonAadhaarCheckerFactory,
  AnonAadhaarPolicy__factory as AnonAadhaarPolicyFactory,
  SemaphoreChecker__factory as SemaphoreCheckerFactory,
  SemaphorePolicy__factory as SemaphorePolicyFactory,
  EASChecker__factory as EASCheckerFactory,
  EASPolicy__factory as EASPolicyFactory,
  GitcoinPassportChecker__factory as GitcoinPassportCheckerFactory,
  GitcoinPassportPolicy__factory as GitcoinPassportPolicyFactory,
  MerkleProofChecker__factory as MerkleProofCheckerFactory,
  MerkleProofPolicy__factory as MerkleProofPolicyFactory,
  TokenChecker__factory as TokenCheckerFactory,
  TokenPolicy__factory as TokenPolicyFactory,
  HatsChecker__factory as HatsCheckerFactory,
  HatsPolicy__factory as HatsPolicyFactory,
  PoseidonT3__factory as PoseidonT3Factory,
  PoseidonT4__factory as PoseidonT4Factory,
  PoseidonT5__factory as PoseidonT5Factory,
  PoseidonT6__factory as PoseidonT6Factory,
  PollFactory__factory as PollFactoryFactory,
  MACI__factory as MACIFactory,
  MessageProcessorFactory__factory as MessageProcessorFactoryFactory,
  TallyFactory__factory as TallyFactoryFactory,
  type ConstantInitialVoiceCreditProxyFactory as ConstantInitialVoiceCreditProxyFactoryContract,
  ConstantInitialVoiceCreditProxy__factory as ConstantInitialVoiceCreditProxyFactory,
  ERC20VotesInitialVoiceCreditProxy__factory as ERC20VotesInitialVoiceCreditProxyFactory,
  type ERC20VotesInitialVoiceCreditProxyFactory as ERC20VotesInitialVoiceCreditProxyFactoryContract,
  type MockERC20Votes,
  type Factory,
} from "../typechain-types";

import { generateEmptyBallotRoots } from "./generateEmptyBallotRoots";
import { logMagenta } from "./logger";
import {
  type IDeployPolicyArgs,
  type IDeployMaciArgs,
  type IDeployedMaci,
  type IDeployedPoseidonContracts,
  type IFactoryLike,
  type IGetDeployedPolicyProxyFactoriesArgs,
  type TDeployedProxyFactories,
} from "./types";

/**
 * Creates contract factory from abi and bytecode
 *
 * @param abi - Contract abi
 * @param bytecode - Contract bytecode
 * @param signer - the signer to use to deploy the contract
 * @returns a contract factory with the libraries linked
 */
export const createContractFactory = async (abi: TAbi, bytecode: string, signer?: Signer): Promise<ContractFactory> => {
  const hre = await import("hardhat");
  const deployment = Deployment.getInstance({ hre });
  deployment.setHre(hre);
  const deployer = signer || (await deployment.getDeployer());

  return deployment.createContractFactory(abi, bytecode, deployer);
};

/**
 * Deploy a Smart Contract given a name and some arguments
 * @param contractName - the name of the contract
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @param args - the constructor arguments of the contract
 */
export const deployContract = async <T extends BaseContract>(
  contractName: string,
  signer?: Signer,
  quiet = false,
  ...args: unknown[]
): Promise<T> => {
  logMagenta({ text: `Deploying ${contractName}`, quiet });
  const hre = await import("hardhat");
  const deployment = Deployment.getInstance({ hre });
  deployment.setHre(hre);

  return await deployment.deployContract({ name: contractName as EContracts, signer }, ...args);
};

/**
 * Deploy a VerifyingKeysRegistry contract
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed VerifyingKeysRegistry contract
 */
export const deployVerifyingKeysRegistry = async (signer?: Signer, quiet = false): Promise<VerifyingKeysRegistry> =>
  deployContract<VerifyingKeysRegistry>("VerifyingKeysRegistry", signer, quiet, await signer?.getAddress());

/**
 * Deploy a MockVerifier contract (testing only)
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed MockVerifier contract
 */
export const deployMockVerifier = async (signer?: Signer, quiet = false): Promise<MockVerifier> =>
  deployContract<MockVerifier>("MockVerifier", signer, quiet);

/**
 * Deploy a Verifier contract
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed Verifier contract
 */
export const deployVerifier = async (signer?: Signer, quiet = false): Promise<Verifier> =>
  deployContract<Verifier>("Verifier", signer, quiet);

/**
 * Deploy a constant initial voice credit proxy factory contract
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed ConstantInitialVoiceCreditProxyFactory contract
 */
export const deployConstantInitialVoiceCreditProxyFactory = async (
  signer?: Signer,
  quiet = false,
): Promise<ConstantInitialVoiceCreditProxyFactoryContract> => {
  if (!signer) {
    throw new Error("Signer is not provided");
  }

  return await deployContract<ConstantInitialVoiceCreditProxyFactoryContract>(
    EInitialVoiceCreditProxiesFactories.Constant,
    signer,
    quiet,
  );
};

/**
 * Deploy a constant initial voice credit proxy contract
 * @param args - the deploy constant initial voice credit proxy arguments
 * @param signer - the signer to use to deploy the contract
 * @param proxyFactory - the optional proxy factory to reuse for deployment
 * @returns the deployed ConstantInitialVoiceCreditProxy contract
 */
export const deployConstantInitialVoiceCreditProxy = async (
  args: { amount: number },
  proxyFactory: ConstantInitialVoiceCreditProxyFactoryContract,
  signer?: Signer,
): Promise<ConstantInitialVoiceCreditProxy> => {
  if (!signer) {
    throw new Error("Signer is not provided");
  }

  const deployment = Deployment.getInstance();

  return await deployment.deployProxyClone<ConstantInitialVoiceCreditProxy, number[]>({
    factory: new ConstantInitialVoiceCreditProxyFactory(signer),
    proxyFactory: proxyFactory as unknown as IFactoryLike,
    args: [args.amount],
    signer,
  });
};

/**
 * Deploy a ERC20VotesInitialVoiceCreditProxyFactory contract
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed ERC20VotesInitialVoiceCreditProxyFactory contract
 */
export const deployERC20VotesInitialVoiceCreditProxyFactory = async (
  signer?: Signer,
  quiet = false,
): Promise<ERC20VotesInitialVoiceCreditProxyFactoryContract> => {
  if (!signer) {
    throw new Error("Signer is not provided");
  }

  return await deployContract<ERC20VotesInitialVoiceCreditProxyFactoryContract>(
    EInitialVoiceCreditProxiesFactories.ERC20Votes,
    signer,
    quiet,
  );
};

/**
 * Deploy a ERC20VotesInitialVoiceCreditProxy contract
 * @param args - the deploy ERC20VotesInitialVoiceCreditProxy arguments
 * @param signer - the signer to use to deploy the contract
 * @param proxyFactory - the optional proxy factory to reuse for deployment
 * @param quiet- whether to suppress console output
 * @returns the deployed ERC20VotesInitialVoiceCreditProxy contract
 */
export const deployERC20VotesInitialVoiceCreditProxy = async (
  args: { token: string; snapshotBlock: bigint; factor: bigint },
  proxyFactory: ERC20VotesInitialVoiceCreditProxyFactoryContract,
  signer?: Signer,
): Promise<ERC20VotesInitialVoiceCreditProxy> => {
  if (!signer) {
    throw new Error("Signer is not provided");
  }

  const deployment = Deployment.getInstance();

  return await deployment.deployProxyClone<ERC20VotesInitialVoiceCreditProxy, [bigint, string, bigint]>({
    factory: new ERC20VotesInitialVoiceCreditProxyFactory(signer),
    proxyFactory: proxyFactory as unknown as IFactoryLike,
    args: [args.snapshotBlock, args.token, args.factor],
    signer,
  });
};

/**
 * Deploy a MockToken contract
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed MockToken contract
 */
export const deploySignupToken = async (signer?: Signer, quiet = false): Promise<MockToken> =>
  deployContract<MockToken>("MockToken", signer, quiet);

/**
 * Deploy a MockERC20Votes contract
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed MockERC20Votes contract
 */
export const deployMockERC20Votes = async (signer?: Signer, quiet = false): Promise<MockERC20Votes> =>
  deployContract<MockERC20Votes>("MockERC20Votes", signer, quiet, "MockERC20Votes", "MTV");

/**
 * Deploy policy and checker contracts.
 *
 * @param args deploy policy arguments
 * @returns policy and checker contracts
 */
const deployPolicy = async <
  C extends BaseChecker = BaseChecker,
  T extends IBasePolicy = IBasePolicy,
  FC extends BaseContract = BaseContract,
  FG extends BaseContract = BaseContract,
>({
  policyFactoryName,
  checkerFactoryName,
  policyFactory,
  checkerFactory,
  signer,
  policyArgs = [],
  checkerArgs = [],
  factories,
  quiet = true,
}: IDeployPolicyArgs<FC, FG>): Promise<{
  checker: C;
  policy: T;
  checkerProxyFactory: FC;
  policyProxyFactory: FG;
}> => {
  const deployment = Deployment.getInstance();

  const checkerProxyFactory =
    factories?.checker ?? (await deployContract<IFactoryLike>(checkerFactoryName, signer, quiet));

  const policyProxyFactory =
    factories?.policy ?? (await deployContract<IFactoryLike>(policyFactoryName, signer, quiet));

  const checker = await deployment.deployProxyClone<C>({
    factory: checkerFactory,
    proxyFactory: checkerProxyFactory as IFactoryLike,
    args: checkerArgs,
    signer,
  });

  const policy = await deployment.deployProxyClone<T>({
    factory: policyFactory,
    proxyFactory: policyProxyFactory as IFactoryLike,
    args: policyArgs.concat(await checker.getAddress()),
    signer,
  });

  return {
    checker,
    policy,
    checkerProxyFactory: checkerProxyFactory as FC,
    policyProxyFactory: policyProxyFactory as FG,
  };
};

/**
 * Get deployed proxy factories for policy contracts to reuse them.
 *
 * @param args - the argument to get deployed policy proxy factories
 * @returns reusable policy proxy factories or undefined if not deployed
 */
export const getDeployedPolicyProxyFactories = async <C extends Factory, P extends Factory>({
  policy,
  checker,
  signer,
  network,
}: IGetDeployedPolicyProxyFactoriesArgs): Promise<TDeployedProxyFactories<C, P>> => {
  const contractStorage = ContractStorage.getInstance();
  const deployment = Deployment.getInstance();

  const [policyFactoryAddress, checkerFactoryAddress] = contractStorage.getAddresses([policy, checker], network);

  const [policyFactory, checkerFactory] = await Promise.all([
    policyFactoryAddress
      ? await deployment.getContract<P>({
          name: policy.toString() as EContracts,
          address: policyFactoryAddress,
          signer,
        })
      : undefined,

    checkerFactoryAddress
      ? await deployment.getContract<C>({
          name: checker.toString() as EContracts,
          address: checkerFactoryAddress,
          signer,
        })
      : undefined,
  ]);

  return {
    checker: checkerFactory,
    policy: policyFactory,
  };
};

/**
 * Deploy a FreeForAllPolicy contract
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed FreeForAllPolicy contracts
 */
export const deployFreeForAllSignUpPolicy = async (
  factories?: TDeployedProxyFactories<FreeForAllCheckerFactoryContract, FreeForAllPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<
  [FreeForAllPolicy, FreeForAllChecker, FreeForAllPolicyFactoryContract, FreeForAllCheckerFactoryContract]
> => {
  const { policy, checker, policyProxyFactory, checkerProxyFactory } = await deployPolicy<
    FreeForAllChecker,
    FreeForAllPolicy,
    FreeForAllCheckerFactoryContract,
    FreeForAllPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.FreeForAll,
    checkerFactoryName: ECheckerFactories.FreeForAll,
    checkerFactory: new FreeForAllCheckerFactory(signer),
    policyFactory: new FreeForAllPolicyFactory(signer),
    factories,
    signer: signer!,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a EASPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed EASPolicy contracts
 */
export const deployEASSignUpPolicy = async (
  args: {
    eas: string;
    attester: string;
    schema: Uint8Array | string;
  },
  factories?: TDeployedProxyFactories<EASCheckerFactoryContract, EASPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<[EASPolicy, EASChecker, EASPolicyFactoryContract, EASCheckerFactoryContract]> => {
  const { policy, checker, policyProxyFactory, checkerProxyFactory } = await deployPolicy<
    EASChecker,
    EASPolicy,
    EASCheckerFactoryContract,
    EASPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.EAS,
    checkerFactoryName: ECheckerFactories.EAS,
    checkerFactory: new EASCheckerFactory(signer),
    policyFactory: new EASPolicyFactory(signer),
    checkerArgs: [args.eas, args.attester, args.schema],
    factories,
    signer: signer!,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a ZupassPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed ZupassPolicy contracts
 */
export const deployZupassSignUpPolicy = async (
  args: {
    eventId: BigNumberish;
    signer1: BigNumberish;
    signer2: BigNumberish;
    verifier: string;
  },
  factories?: TDeployedProxyFactories<ZupassCheckerFactoryContract, ZupassPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<[ZupassPolicy, ZupassChecker, ZupassPolicyFactoryContract, ZupassCheckerFactoryContract]> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    ZupassChecker,
    ZupassPolicy,
    ZupassCheckerFactoryContract,
    ZupassPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.Zupass,
    checkerFactoryName: ECheckerFactories.Zupass,
    checkerFactory: new ZupassCheckerFactory(signer),
    policyFactory: new ZupassPolicyFactory(signer),
    signer: signer!,
    checkerArgs: [args.eventId, args.signer1, args.signer2, args.verifier],
    factories,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a GitcoinPassportPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed GitcoinPassportPolicy contracts
 */
export const deployGitcoinPassportPolicy = async (
  args: { decoderAddress: string; minimumScore: number },
  factories?: TDeployedProxyFactories<GitcoinPassportCheckerFactoryContract, GitcoinPassportPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<
  [
    GitcoinPassportPolicy,
    GitcoinPassportChecker,
    GitcoinPassportPolicyFactoryContract,
    GitcoinPassportCheckerFactoryContract,
  ]
> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    GitcoinPassportChecker,
    GitcoinPassportPolicy,
    GitcoinPassportCheckerFactoryContract,
    GitcoinPassportPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.GitcoinPassport,
    checkerFactoryName: ECheckerFactories.GitcoinPassport,
    checkerFactory: new GitcoinPassportCheckerFactory(signer),
    policyFactory: new GitcoinPassportPolicyFactory(signer),
    signer: signer!,
    checkerArgs: [args.decoderAddress, args.minimumScore.toString()],
    factories,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a MerkleProofPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed MerkleProofPolicy contracts
 */
export const deployMerkleProofPolicy = async (
  args: { root: Uint8Array | string },
  factories?: TDeployedProxyFactories<MerkleProofCheckerFactoryContract, MerkleProofPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<
  [MerkleProofPolicy, MerkleProofChecker, MerkleProofPolicyFactoryContract, MerkleProofCheckerFactoryContract]
> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    MerkleProofChecker,
    MerkleProofPolicy,
    MerkleProofCheckerFactoryContract,
    MerkleProofPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.MerkleProof,
    checkerFactoryName: ECheckerFactories.MerkleProof,
    checkerFactory: new MerkleProofCheckerFactory(signer),
    policyFactory: new MerkleProofPolicyFactory(signer),
    checkerArgs: [args.root],
    factories,
    signer: signer!,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a SemaphorePolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed SemaphorePolicy contracts
 */
export const deploySemaphoreSignupPolicy = async (
  args: {
    semaphore: string;
    groupId: BigNumberish;
  },
  factories?: TDeployedProxyFactories<SemaphoreCheckerFactoryContract, SemaphorePolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<[SemaphorePolicy, SemaphoreChecker, SemaphorePolicyFactoryContract, SemaphoreCheckerFactoryContract]> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    SemaphoreChecker,
    SemaphorePolicy,
    SemaphoreCheckerFactoryContract,
    SemaphorePolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.Semaphore,
    checkerFactoryName: ECheckerFactories.Semaphore,
    checkerFactory: new SemaphoreCheckerFactory(signer),
    policyFactory: new SemaphorePolicyFactory(signer),
    checkerArgs: [args.semaphore, args.groupId.toString()],
    factories,
    signer: signer!,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a HatsPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed HatsPolicy contracts
 */
export const deployHatsSignupPolicy = async (
  args: {
    hats: string;
    criterionHats: BigNumberish[];
  },
  factories?: TDeployedProxyFactories<HatsCheckerFactoryContract, HatsPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<[HatsPolicy, HatsChecker, HatsPolicyFactoryContract, HatsCheckerFactoryContract]> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    HatsChecker,
    HatsPolicy,
    HatsCheckerFactoryContract,
    HatsPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.Hats,
    checkerFactoryName: ECheckerFactories.Hats,
    checkerFactory: new HatsCheckerFactory(signer),
    policyFactory: new HatsPolicyFactory(signer),
    checkerArgs: [args.hats, args.criterionHats],
    factories,
    signer: signer!,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};
/**
 * Deploy a TokenPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed SignupTokenPolicy contract
 */
export const deploySignupTokenPolicy = async (
  args: {
    token: string;
  },
  factories?: TDeployedProxyFactories<TokenCheckerFactoryContract, TokenPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<[TokenPolicy, TokenChecker, TokenPolicyFactoryContract, TokenCheckerFactoryContract]> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    TokenChecker,
    TokenPolicy,
    TokenCheckerFactoryContract,
    TokenPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.Token,
    checkerFactoryName: ECheckerFactories.Token,
    checkerFactory: new TokenCheckerFactory(signer),
    policyFactory: new TokenPolicyFactory(signer),
    checkerArgs: [args.token],
    factories,
    signer: signer!,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a ERC20VotesPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed ERC20VotesPolicy contracts
 */
export const deployERC20VotesPolicy = async (
  args: {
    snapshotBlock: bigint;
    token: string;
    threshold: bigint;
  },
  factories?: TDeployedProxyFactories<ERC20VotesCheckerFactoryContract, ERC20VotesPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<
  [ERC20VotesPolicy, ERC20VotesChecker, ERC20VotesPolicyFactoryContract, ERC20VotesCheckerFactoryContract]
> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    ERC20VotesChecker,
    ERC20VotesPolicy,
    ERC20VotesCheckerFactoryContract,
    ERC20VotesPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.ERC20Votes,
    checkerFactoryName: ECheckerFactories.ERC20Votes,
    checkerFactory: new ERC20VotesCheckerFactory(signer),
    policyFactory: new ERC20VotesPolicyFactory(signer),
    signer: signer!,
    checkerArgs: [args.token, args.snapshotBlock, args.threshold],
    factories,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy a ERC20Policy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed ERC20Policy contracts
 */
export const deployERC20Policy = async (
  args: {
    token: string;
    threshold: bigint;
  },
  factories?: TDeployedProxyFactories<ERC20CheckerFactoryContract, ERC20PolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<[ERC20Policy, ERC20Checker, ERC20PolicyFactoryContract, ERC20CheckerFactoryContract]> => {
  const { policy, checker, checkerProxyFactory, policyProxyFactory } = await deployPolicy<
    ERC20Checker,
    ERC20Policy,
    ERC20CheckerFactoryContract,
    ERC20PolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.ERC20,
    checkerFactoryName: ECheckerFactories.ERC20,
    checkerFactory: new ERC20CheckerFactory(signer),
    policyFactory: new ERC20PolicyFactory(signer),
    signer: signer!,
    checkerArgs: [args.token, args.threshold],
    factories,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy an AnonAadhaarPolicy contract
 * @param args - the arguments to deploy policy
 * @param factories - the optional proxy factories to reuse for deployment
 * @param signer - the signer to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed AnonAadhaarPolicy contracts
 */
export const deployAnonAadhaarPolicy = async (
  args: {
    verifierAddress: string;
    nullifierSeed: string;
  },
  factories?: TDeployedProxyFactories<AnonAadhaarCheckerFactoryContract, AnonAadhaarPolicyFactoryContract>,
  signer?: Signer,
  quiet = false,
): Promise<
  [AnonAadhaarPolicy, AnonAadhaarChecker, AnonAadhaarPolicyFactoryContract, AnonAadhaarCheckerFactoryContract]
> => {
  const { policy, checker, policyProxyFactory, checkerProxyFactory } = await deployPolicy<
    AnonAadhaarChecker,
    AnonAadhaarPolicy,
    AnonAadhaarCheckerFactoryContract,
    AnonAadhaarPolicyFactoryContract
  >({
    policyFactoryName: EPolicyFactories.AnonAadhaar,
    checkerFactoryName: ECheckerFactories.AnonAadhaar,
    checkerFactory: new AnonAadhaarCheckerFactory(signer),
    policyFactory: new AnonAadhaarPolicyFactory(signer),
    checkerArgs: [args.verifierAddress, args.nullifierSeed],
    factories,
    signer: signer!,
    quiet,
  });

  return [policy, checker, policyProxyFactory, checkerProxyFactory];
};

/**
 * Deploy Poseidon contracts
 * @param signer - the signer to use to deploy the contracts
 * @param quiet - whether to suppress console output
 * @returns the deployed Poseidon contracts
 */
export const deployPoseidonContracts = async (
  signer?: Signer,
  { poseidonT3, poseidonT4, poseidonT5, poseidonT6 }: IDeployMaciArgs["poseidonAddresses"] = {},
  quiet = false,
): Promise<IDeployedPoseidonContracts> => {
  const PoseidonT3Contract = !poseidonT3
    ? await deployContract<PoseidonT3>("PoseidonT3", signer, quiet)
    : PoseidonT3Factory.connect(poseidonT3);

  const PoseidonT4Contract = !poseidonT4
    ? await deployContract<PoseidonT4>("PoseidonT4", signer, quiet)
    : PoseidonT4Factory.connect(poseidonT4);

  const PoseidonT5Contract = !poseidonT5
    ? await deployContract<PoseidonT5>("PoseidonT5", signer, quiet)
    : PoseidonT5Factory.connect(poseidonT5);

  const PoseidonT6Contract = !poseidonT6
    ? await deployContract<PoseidonT6>("PoseidonT6", signer, quiet)
    : PoseidonT6Factory.connect(poseidonT6);

  return {
    PoseidonT3Contract,
    PoseidonT4Contract,
    PoseidonT5Contract,
    PoseidonT6Contract,
  };
};

/**
 * Deploy a contract with linked libraries
 * @param contractFactory - the contract factory to use
 * @param signer - the signer to use for deployment (optional)
 * @param args - the constructor arguments of the contract
 * @returns the deployed contract instance
 */
export const deployContractWithLinkedLibraries = async <T extends BaseContract>(
  contractFactory: ContractFactory,
  signer?: Signer,
  ...args: unknown[]
): Promise<T> => {
  const hre = await import("hardhat");
  const deployment = Deployment.getInstance({ hre });
  deployment.setHre(hre);

  return deployment.deployContractWithLinkedLibraries({ contractFactory, signer }, ...args);
};

/**
 * Deploy a Poll Factory contract
 * @param signer - the signer object to use to deploy the contract
 * @param quiet - whether to suppress console output
 * @returns the deployed Poll Factory contract
 */
export const deployPollFactory = async (
  signer: Signer,
  factory: typeof PollFactoryFactory | undefined,
  quiet = false,
): Promise<PollFactory> => {
  const poseidonContracts = await deployPoseidonContracts(signer, {}, quiet);
  const [poseidonT3Contract, poseidonT4Contract, poseidonT5Contract, poseidonT6Contract] = await Promise.all([
    poseidonContracts.PoseidonT3Contract.getAddress(),
    poseidonContracts.PoseidonT4Contract.getAddress(),
    poseidonContracts.PoseidonT5Contract.getAddress(),
    poseidonContracts.PoseidonT6Contract.getAddress(),
  ]);

  const pollFactory = factory || PollFactoryFactory;

  const contractFactory = await createContractFactory(
    pollFactory.abi,
    pollFactory.linkBytecode({
      "contracts/crypto/PoseidonT3.sol:PoseidonT3": poseidonT3Contract,
      "contracts/crypto/PoseidonT4.sol:PoseidonT4": poseidonT4Contract,
      "contracts/crypto/PoseidonT5.sol:PoseidonT5": poseidonT5Contract,
      "contracts/crypto/PoseidonT6.sol:PoseidonT6": poseidonT6Contract,
    }),
    signer,
  );

  return deployContractWithLinkedLibraries(contractFactory);
};

/**
 * Deploy a MACI contract
 * @param {IDeployMaciArgs} args - deploy arguments
 * @returns {IDeployedMaci} the deployed MACI contract
 */
export const deployMaci = async ({
  policyContractAddress,
  signer,
  poseidonAddresses,
  stateTreeDepth = 10,
  factories,
  quiet = true,
}: IDeployMaciArgs): Promise<IDeployedMaci> => {
  const emptyBallotRoots = generateEmptyBallotRoots(stateTreeDepth);

  const { PoseidonT3Contract, PoseidonT4Contract, PoseidonT5Contract, PoseidonT6Contract } =
    await deployPoseidonContracts(signer, poseidonAddresses, quiet);

  const poseidonAddrs = await Promise.all([
    PoseidonT3Contract.getAddress(),
    PoseidonT4Contract.getAddress(),
    PoseidonT5Contract.getAddress(),
    PoseidonT6Contract.getAddress(),
  ]).then(([poseidonT3, poseidonT4, poseidonT5, poseidonT6]) => ({
    poseidonT3,
    poseidonT4,
    poseidonT5,
    poseidonT6,
  }));

  const contractsToLink = [MACIFactory, PollFactoryFactory, MessageProcessorFactoryFactory, TallyFactoryFactory];

  // Link Poseidon contracts to MACI
  const linkedContractFactories =
    factories ||
    (await Promise.all(
      contractsToLink.map(async (factory) =>
        createContractFactory(
          factory.abi,
          factory.linkBytecode({
            "contracts/crypto/PoseidonT3.sol:PoseidonT3": poseidonAddrs.poseidonT3,
            "contracts/crypto/PoseidonT4.sol:PoseidonT4": poseidonAddrs.poseidonT4,
            "contracts/crypto/PoseidonT5.sol:PoseidonT5": poseidonAddrs.poseidonT5,
            "contracts/crypto/PoseidonT6.sol:PoseidonT6": poseidonAddrs.poseidonT6,
          }),
          signer,
        ),
      ),
    ));

  const [maciContractFactory, pollFactoryContractFactory, messageProcessorFactory, tallyFactory] =
    linkedContractFactories;

  const pollFactoryContract = await deployContractWithLinkedLibraries<PollFactory>(pollFactoryContractFactory);

  const messageProcessorFactoryContract =
    await deployContractWithLinkedLibraries<MessageProcessorFactory>(messageProcessorFactory);

  const tallyFactoryContract = await deployContractWithLinkedLibraries<TallyFactory>(tallyFactory);

  const [pollAddress, messageProcessorAddress, tallyAddress] = await Promise.all([
    pollFactoryContract.getAddress(),
    messageProcessorFactoryContract.getAddress(),
    tallyFactoryContract.getAddress(),
  ]);

  const maciContract = await deployContractWithLinkedLibraries<MACI>(
    maciContractFactory,
    signer,
    pollAddress,
    messageProcessorAddress,
    tallyAddress,
    policyContractAddress,
    stateTreeDepth,
    emptyBallotRoots,
  );

  return {
    maciContract,
    pollFactoryContract,
    messageProcessorFactoryContract,
    tallyFactoryContract,
    poseidonAddrs,
  };
};
