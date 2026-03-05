#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings";
import { PublicKey, type VerifyingKey } from "@maci-protocol/domainobjs";
import {
  generateTallyCommitments,
  getPollParams,
  verify,
  getSignedupUserData,
  signup,
  joinPoll,
  getJoinedUserData,
  getPoll,
  generateMaciPublicKey,
  generateKeypair,
  mergeSignups,
  checkVerifyingKeys,
  setVerifyingKeys,
  extractAllVerifyingKeys,
  EMode,
  extractVerifyingKeyToFile,
  generateMaciState,
  proveOnChain,
  publish,
  MACI__factory as MACIFactory,
  deployPoll,
  generateProofs,
  deployVerifyingKeysRegistryContract,
  timeTravel,
  fundWallet,
  info,
  success,
  logGreen,
  logRed,
  logYellow,
  ContractStorage,
  EContracts,
  getPolicyTrait,
  getPolicyContractNamesByTrait,
  type ITallyData,
  deployMaci,
  deployFreeForAllSignUpPolicy,
  generateEmptyBallotRoots,
  FreeForAllCheckerFactory__factory as FreeForAllCheckerFactoryFactory,
  FreeForAllPolicyFactory__factory as FreeForAllPolicyFactoryFactory,
} from "@maci-protocol/sdk";
import { ZeroAddress, type Signer } from "ethers";

import fs from "fs";
import path from "path";

import "./cliInit";
import {
  DEFAULT_IVCP_DATA,
  DEFAULT_SG_DATA,
  banner,
  contractAddressesStorePath,
  promptSensitiveValue,
  readContractAddresses,
  readJSONFile,
  resetContractAddresses,
  storeContractAddresses,
} from "./utils";
import { MODE_NAME_TO_ENUM } from "./utils/constants";
import { DEFAULT_INITIAL_VOICE_CREDITS, DEFAULT_VOTE_OPTIONS } from "./utils/defaults";

// set the description version and name of the cli tool
const { description, version, name } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"),
) as { description: string; version: string; name: string };
const program = new Command();
program.name(name).description(description).version(version);

const getSigner = async (): Promise<Signer> => import("@maci-protocol/sdk").then((m) => m.getDefaultSigner());

// add the commands
program
  .command("create")
  .description("deploy the contracts")
  .option("--poseidonT3Address <poseidonT3Address>", "PoseidonT3 contract address")
  .option("--poseidonT4Address <poseidonT4Address>", "PoseidonT4 contract address")
  .option("--poseidonT5Address <poseidonT5Address>", "PoseidonT5 contract address")
  .option("--poseidonT6Address <poseidonT6Address>", "PoseidonT6 contract address")
  .option("-g, --signupPolicyAddress <signupPolicyAddress>", "the signup policy contract address")
  .option(
    "--freeForAllCheckerFactoryAddress <freeForAllCheckerFactoryAddress>",
    "the free for all checker factory address (optional, using for deployment optimization)",
  )
  .option(
    "--freeForAllPolicyFactoryAddress <freeForAllPolicyFactoryAddress>",
    "the free for all policy factory address (optional, using for deployment optimization)",
  )
  .requiredOption("--signupPolicyContractName <signupPolicyContractName>", "the signup policy contract name")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .requiredOption("-s, --stateTreeDepth <stateTreeDepth>", "the state tree depth", parseInt)
  .action(async (args) => {
    try {
      const signer = await getSigner();

      banner(args.quiet);

      const network = await signer.provider?.getNetwork();

      const [poseidonT3, poseidonT4, poseidonT5, poseidonT6] = readContractAddresses({
        contractNames: [EContracts.PoseidonT3, EContracts.PoseidonT4, EContracts.PoseidonT5, EContracts.PoseidonT6],
        network: network?.name,
      });

      let [signupPolicyContractAddress] = readContractAddresses({
        contractNames: [args.signupPolicyContractName.toString() as EContracts],
        network: network?.name,
      });

      if (!signupPolicyContractAddress) {
        const checkerFactory = args.freeForAllCheckerFactoryAddress
          ? FreeForAllCheckerFactoryFactory.connect(args.freeForAllCheckerFactoryAddress, signer)
          : undefined;

        const policyFactory = args.freeForAllPolicyFactoryAddress
          ? FreeForAllPolicyFactoryFactory.connect(args.freeForAllPolicyFactoryAddress, signer)
          : undefined;

        const [contract] = await deployFreeForAllSignUpPolicy(
          { checker: checkerFactory, policy: policyFactory },
          signer,
          true,
        );
        signupPolicyContractAddress = await contract.getAddress();
      }

      // deploy MACI, PollFactory and poseidon
      const {
        maciContractAddress,
        pollFactoryContractAddress,
        tallyFactoryContractAddress,
        messageProcessorFactoryContractAddress,
        poseidonAddresses,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress,
      } = await deployMaci({
        signupPolicyAddress: signupPolicyContractAddress,
        poseidonAddresses: {
          poseidonT3,
          poseidonT4,
          poseidonT5,
          poseidonT6,
        },
        signer,
        stateTreeDepth: args.stateTreeDepth,
      });

      const emptyBallotRoots = generateEmptyBallotRoots(args.stateTreeDepth);

      // save to the JSON File
      await storeContractAddresses({
        data: {
          [args.signupPolicyContractName]: { address: signupPolicyContractAddress, args: [] },
          [EContracts.Verifier]: { address: verifierContractAddress, args: [] },
          [EContracts.VerifyingKeysRegistry]: { address: verifyingKeysRegistryContractAddress, args: [] },
          [EContracts.MACI]: {
            address: maciContractAddress,
            args: [
              pollFactoryContractAddress,
              messageProcessorFactoryContractAddress,
              tallyFactoryContractAddress,
              signupPolicyContractAddress,
              args.stateTreeDepth,
              emptyBallotRoots.map((root) => root.toString()),
            ],
          },
          [EContracts.MessageProcessorFactory]: { address: messageProcessorFactoryContractAddress, args: [] },
          [EContracts.TallyFactory]: { address: tallyFactoryContractAddress, args: [] },
          [EContracts.PollFactory]: { address: pollFactoryContractAddress, args: [] },
          [EContracts.PoseidonT3]: { address: poseidonAddresses.poseidonT3, args: [] },
          [EContracts.PoseidonT4]: { address: poseidonAddresses.poseidonT4, args: [] },
          [EContracts.PoseidonT5]: { address: poseidonAddresses.poseidonT5, args: [] },
          [EContracts.PoseidonT6]: { address: poseidonAddresses.poseidonT6, args: [] },
        },
        signer,
      });

      logGreen({ quiet: args.quiet, text: success(`MACI deployed at:  ${maciContractAddress}`) });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("checkVerifyingKeys")
  .description("check that the verifying keys in the contract match the local ones")
  .option("-m, --mode <mode>", "Voting mode (qv, non-qv, full)", (value) => MODE_NAME_TO_ENUM[value], EMode.QV)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option("-k, --vk-contract <vkContract>", "the VerifyingKeysRegistry contract address")
  .requiredOption("-s, --state-tree-depth <stateTreeDepth>", "the state tree depth", parseInt)
  .requiredOption(
    "-i, --tally-processing-state-tree-depth <tallyProcessingStateTreeDepth>",
    "the intermediate state tree depth",
    parseInt,
  )
  .requiredOption("-v, --vote-option-tree-depth <voteOptionTreeDepth>", "the vote option tree depth", parseInt)
  .requiredOption("-b, --message-batch-size <messageBatchSize>", "the message batch size", parseInt)
  .requiredOption(
    "-p, --message-processor-zkey <messageProcessorZkeyPath>",
    "the message processor zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "-t, --vote-tally-zkey <voteTallyZkeyPath>",
    "the vote tally zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--poll-joining-zkey <pollJoiningZkey>",
    "the poll joining zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--poll-joined-zkey <pollJoinedZkey>",
    "the poll joined zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();
      const [contractAddress] = readContractAddresses({
        contractNames: [EContracts.VerifyingKeysRegistry],
        network: network?.name,
        defaultAddresses: [args.vkContract],
      });

      logYellow({ quiet: args.quiet, text: info("Retrieving verifying keys from the contract...") });

      await checkVerifyingKeys({
        stateTreeDepth: args.stateTreeDepth,
        tallyProcessingStateTreeDepth: args.tallyProcessingStateTreeDepth,
        voteOptionTreeDepth: args.voteOptionTreeDepth,
        messageBatchSize: args.messageBatchSize,
        messageProcessorZkeyPath: args.messageProcessorZkey,
        voteTallyZkeyPath: args.voteTallyZkey,
        pollJoiningZkeyPath: args.pollJoiningZkey,
        pollJoinedZkeyPath: args.pollJoinedZkey,
        verifyingKeysRegistry: contractAddress,
        mode: args.mode,
        signer,
      });

      logGreen({ quiet: args.quiet, text: success("Verifying keys match") });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("generateMaciPubKey")
  .description("generate a new MACI public key")
  .requiredOption("-k, --private-key <privateKey>", "the private key")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action((args) => {
    const publicKey = generateMaciPublicKey(args.privateKey);
    logGreen({ quiet: args.quiet, text: success(`Public key: ${publicKey}`) });
  });
program
  .command("generateMaciKeyPair")
  .description("generate a new MACI key pair")
  .option("-s, --seed <seed>", "seed value for keypair", (value) => (value ? BigInt(value) : undefined), undefined)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .action((args) => {
    const { publicKey, privateKey, publicKeyAsContractParam } = generateKeypair({ seed: args.seed });
    logGreen({ quiet: args.quiet, text: success(`Public key: ${publicKey}`) });
    logGreen({ quiet: args.quiet, text: success(`Private key: ${privateKey}`) });
    logGreen({
      quiet: args.quiet,
      text: success(
        `Public key as contract param:
         X: ${publicKeyAsContractParam.x}
         Y: ${publicKeyAsContractParam.y}`,
      ),
    });
  });
program
  .command("deployVerifyingKeysRegistry")
  .description("deploy a new verification key registry contract")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (args) => {
    try {
      banner(args.quiet);

      const signer = await getSigner();
      // assume that the vkRegistry contract is the first one to be deployed
      const isContractAddressesStoreExists = fs.existsSync(contractAddressesStorePath);

      if (isContractAddressesStoreExists) {
        const network = await signer.provider?.getNetwork();
        resetContractAddresses(network?.name);
      }

      // deploy and store the address
      const verifyingKeysRegistryAddress = await deployVerifyingKeysRegistryContract({ signer });
      await storeContractAddresses({
        data: { [EContracts.VerifyingKeysRegistry]: { address: verifyingKeysRegistryAddress, args: [] } },
        signer,
      });

      logGreen({
        quiet: args.quiet,
        text: success(`VerifyingKeysRegistry deployed at: ${verifyingKeysRegistryAddress}`),
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("show")
  .description("show the deployed contract addresses")
  .action(async () => {
    try {
      banner(false);

      if (!fs.existsSync(contractAddressesStorePath)) {
        throw new Error("No contracts have been deployed yet");
      }

      const signer = await getSigner();
      const [address, network] = await Promise.all([signer.getAddress(), signer.provider?.getNetwork()]);

      const contractStorage = ContractStorage.getInstance();
      contractStorage.printContracts(address, network?.name ?? "hardhat");
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("deployPoll")
  .description("deploy a new poll")
  .option("-k, --verifyingKeysRegistryAddress <verifyingKeysRegistryAddress>", "the vk registry contract address")
  .requiredOption("--start <pollStartDate>", "the poll start date", parseInt)
  .requiredOption("--end <pollEndDate>", "the poll end date", parseInt)
  .requiredOption(
    "-i, --tally-processing-state-tree-depth <tallyProcessingStateTreeDepth>",
    "the int state tree depth",
    parseInt,
  )
  .requiredOption("-b, --message-batch-size <messageBatchSize>", "the message batch size", parseInt)
  .requiredOption("-s, --state-tree-depth <stateTreeDepth>", "the state tree depth", parseInt)
  .requiredOption("-v, --vote-option-tree-depth <voteOptionTreeDepth>", "the vote option tree depth", parseInt)
  .requiredOption("-p, --public-key <publicKey>", "the coordinator public key")
  .option("-m, --mode <mode>", "Voting mode (qv, non-qv, full)", (value) => MODE_NAME_TO_ENUM[value], EMode.QV)
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("--relayers <relayers>", "the relayer addresses", (value) => value.split(",").map((item) => item.trim()))
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option("-o, --vote-options <voteOptions>", "the number of vote options", parseInt)
  .option("--initial-voice-credits <initialVoiceCredits>", "the initial voice credits", parseInt)
  .option("--initial-voice-credits-proxy <initialVoiceCreditsProxy>", "the initial voice credits proxy address")
  .option("--signup-policy <signupPolicy>", "the signup policy contract address")
  .action(async (args) => {
    try {
      banner(args.quiet);

      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress, initialVoiceCreditProxyAddress, initialVoiceCreditProxyFactoryAddress] =
        readContractAddresses({
          contractNames: [
            EContracts.VerifyingKeysRegistry,
            EContracts.MACI,
            EContracts.ConstantInitialVoiceCreditProxy,
            EContracts.ConstantInitialVoiceCreditProxyFactory,
            EContracts.Verifier,
          ],
          network: network?.name,
          defaultAddresses: [args.verifyingKeysRegistryAddress, args.maciAddress, args.initialVoiceCreditsProxy],
        });

      const maciContract = MACIFactory.connect(maciAddress, signer);

      const nextPollId = await maciContract.nextPollId();

      const policyTrait = await getPolicyTrait({ maciAddress, signer });
      const policyContractName = getPolicyContractNamesByTrait(policyTrait);

      const [signupPolicyContractAddress] = readContractAddresses({
        contractNames: [policyContractName.toString() as EContracts],
        keys: [nextPollId.toString()],
        network: network?.name,
        defaultAddresses: [args.signupPolicy],
      });

      const {
        pollId,
        pollContractAddress,
        tallyContractAddress,
        messageProcessorContractAddress,
        initialVoiceCreditProxyContractAddress,
        policyContractAddress,
      } = await deployPoll({
        initialVoiceCredits: args.initialVoiceCredits || DEFAULT_INITIAL_VOICE_CREDITS,
        pollStartTimestamp: args.start,
        pollEndTimestamp: args.end,
        tallyProcessingStateTreeDepth: args.tallyProcessingStateTreeDepth,
        messageBatchSize: args.messageBatchSize,
        stateTreeDepth: args.stateTreeDepth,
        voteOptionTreeDepth: args.voteOptionTreeDepth,
        coordinatorPublicKey: PublicKey.deserialize(args.publicKey),
        maciAddress,
        relayers: args.relayers ?? [ZeroAddress],
        mode: args.mode,
        signer,
        voteOptions: args.voteOptions ?? DEFAULT_VOTE_OPTIONS,
        policyContractAddress: signupPolicyContractAddress,
        initialVoiceCreditProxyFactoryAddress,
        initialVoiceCreditProxyContractAddress: initialVoiceCreditProxyAddress,
      });

      logGreen({ quiet: args.quiet, text: success(`Poll ID: ${pollId}`) });
      logGreen({ quiet: args.quiet, text: success(`Poll contract address: ${pollContractAddress}`) });
      logGreen({ quiet: args.quiet, text: success(`Tally contract address: ${tallyContractAddress}`) });
      logGreen({
        quiet: args.quiet,
        text: success(`Message processor contract address: ${messageProcessorContractAddress}`),
      });
      logGreen({
        quiet: args.quiet,
        text: success(`Initial voice credit proxy contract address: ${initialVoiceCreditProxyContractAddress}`),
      });
      logGreen({
        quiet: args.quiet,
        text: success(`Signup policy contract address: ${policyContractAddress}`),
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("joinPoll")
  .description("join the poll")
  .requiredOption("-k, --private-key <privateKey>", "the private key")
  .option("-s, --sg-data <sgData>", "the signup policy data")
  .option("-v, --ivcp-data <ivcpData>", "the initial voice credit proxy data")
  .option(
    "-n, --new-voice-credit-balance <newVoiceCreditBalance>",
    "the voice credit balance of the user for the poll",
    BigInt,
  )
  .requiredOption("-p, --poll-id <pollId>", "the id of the poll", BigInt)
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("--state-file <stateFile>", "the path to the state file containing the serialized maci state")
  .option("--start-block <startBlock>", "the block number to start looking for events from", parseInt)
  .option("--end-block <endBlock>", "the block number to end looking for events from", parseInt)
  .option("--blocks-per-batch <blockPerBatch>", "the number of blocks to process per batch", parseInt)
  .option("--transaction-hash <transactionHash>", "transaction hash of MACI contract creation")
  .option("--poll-joining-wasm <pollJoiningWasm>", "the path to the poll joining wasm binary")
  .requiredOption(
    "--poll-joining-zkey <pollZkeyPath>",
    "the poll join zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option("-w, --wasm", "whether to use the wasm binaries")
  .option("-r, --rapidsnark <rapidsnark>", "the path to the rapidsnark binary")
  .option("-g, --poll-witness-generator <pollWitnessGenerator>", "the path to the poll witness generation binary")
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });
      const privateKey = args.privateKey || (await promptSensitiveValue("Insert your MACI private key"));

      const data = await joinPoll({
        maciAddress,
        privateKey,
        stateFile: args.stateFile,
        pollId: args.pollId,
        signer,
        startBlock: args.startBlock,
        endBlock: args.endBlock,
        blocksPerBatch: args.blocksPerBatch,
        pollJoiningZkey: args.pollJoiningZkey,
        pollJoiningWasm: args.pollJoiningWasm,
        useWasm: args.wasm,
        rapidsnark: args.rapidsnark,
        pollWitnessGenerator: args.pollWitnessGenerator,
        sgDataArg: args.sgData ?? DEFAULT_SG_DATA,
        ivcpDataArg: args.ivcpData ?? DEFAULT_IVCP_DATA,
      });

      logGreen({ quiet: args.quiet, text: info(`User joined poll with nullifier: ${data.nullifier}`) });
      logGreen({ quiet: args.quiet, text: info(`User joined poll with state index: ${data.pollStateIndex}`) });
      logGreen({ quiet: args.quiet, text: info(`User joined poll with ${data.voiceCredits} voice credits`) });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("setVerifyingKeys")
  .description("set the verifying keys")
  .requiredOption("-s, --state-tree-depth <stateTreeDepth>", "the state tree depth", parseInt)
  .requiredOption(
    "-i, --tally-processing-state-tree-depth <tallyProcessingStateTreeDepth>",
    "the intermediate state tree depth",
    parseInt,
  )
  .requiredOption("-v, --vote-option-tree-depth <voteOptionTreeDepth>", "the vote option tree depth", parseInt)
  .requiredOption("-b, --message-batch-size <messageBatchSize>", "the message batch size", parseInt)
  .option("--poll-state-tree-depth <pollStateTreeDepth>", "the poll state tree depth", parseInt)
  .option(
    "--poll-joining-zkey <pollJoiningZkeyPath>",
    "the poll joining zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "--poll-joined-zkey <pollJoinedZkeyPath>",
    "the poll joined zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "--message-processor-zkey-qv <messageProcessorZkeyPathQv>",
    "the message processor qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "--vote-tally-zkey-qv <voteTallyZkeyPathQv>",
    "the vote tally qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "--message-processor-zkey-non-qv <messageProcessorZkeyPathNonQv>",
    "the message processor non-qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "--vote-tally-zkey-non-qv <voteTallyZkeyPathNonQv>",
    "the vote tally non-qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "--message-processor-zkey-full <messageProcessorZkeyPathFull>",
    "the message processor full zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "--vote-tally-zkey-full <tallyVotesZkeyPathFull>",
    "the vote tally full zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "-m, --modes <modes>",
    "Comma-separated list of voting modes (qv, non-qv, full)",
    (value) => value.split(",").map((v) => MODE_NAME_TO_ENUM[v.trim()]),
    [EMode.QV],
  )
  .option("-k, --vk-registry <vkRegistry>", "the vk registry contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();
      const [verifyingKeysRegistryAddress] = readContractAddresses({
        contractNames: [EContracts.VerifyingKeysRegistry],
        network: network?.name,
        defaultAddresses: [args.vkRegistry],
      });

      const processKeys = {
        [EMode.QV]: args.messageProcessorZkeyQv,
        [EMode.NON_QV]: args.messageProcessorZkeyNonQv,
        [EMode.FULL]: args.messageProcessorZkeyFull,
      };

      const tallyKeys = {
        [EMode.QV]: args.voteTallyZkeyQv,
        [EMode.NON_QV]: args.voteTallyZkeyNonQv,
        [EMode.FULL]: args.voteTallyZkeyFull,
      };

      const { pollJoiningVerifyingKey, pollJoinedVerifyingKey } = await extractAllVerifyingKeys({
        pollJoiningZkeyPath: args.pollJoiningZkey,
        pollJoinedZkeyPath: args.pollJoinedZkey,
      });

      const keysResults = await Promise.all(
        args.modes.map((mode) =>
          extractAllVerifyingKeys({
            messageProcessorZkeyPath: processKeys[mode],
            voteTallyZkeyPath: tallyKeys[mode],
          }),
        ),
      );

      const processVerifyingKeys: VerifyingKey[] = [];
      const tallyVerifyingKeys: VerifyingKey[] = [];

      keysResults.forEach(({ processVerifyingKey, tallyVerifyingKey }, idx) => {
        if (!processVerifyingKey || !tallyVerifyingKey) {
          throw new Error(`Verifying keys for mode ${args.modes[idx]} are not valid`);
        }

        processVerifyingKeys.push(processVerifyingKey);
        tallyVerifyingKeys.push(tallyVerifyingKey);
      });

      await setVerifyingKeys({
        stateTreeDepth: args.stateTreeDepth,
        tallyProcessingStateTreeDepth: args.tallyProcessingStateTreeDepth,
        voteOptionTreeDepth: args.voteOptionTreeDepth,
        messageBatchSize: args.messageBatchSize,
        pollStateTreeDepth: args.pollStateTreeDepth || args.stateTreeDepth,
        pollJoiningVerifyingKey: pollJoiningVerifyingKey!,
        pollJoinedVerifyingKey: pollJoinedVerifyingKey!,
        processMessagesVerifyingKeys: processVerifyingKeys,
        tallyVotesVerifyingKeys: tallyVerifyingKeys,
        verifyingKeysRegistryAddress,
        modes: args.modes,
        signer,
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("publish")
  .description("publish a new message to a MACI Poll contract")
  .requiredOption(
    "-p, --public-key <publicKey>",
    "the MACI public key which should replace the user's public key in the state tree",
  )
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-k, --private-key <privateKey>", "your serialized MACI private key")
  .requiredOption("-i, --state-index <stateIndex>", "the user's state index", BigInt)
  .requiredOption("-v, --vote-option-index <voteOptionIndex>", "the vote option index", BigInt)
  .requiredOption("-n, --nonce <nonce>", "the message nonce", BigInt)
  .option("-s, --salt <salt>", "the message salt", BigInt)
  .requiredOption("-o, --poll-id <pollId>", "the poll id", BigInt)
  .requiredOption("-w, --new-vote-weight <newVoteWeight>", "the new vote weight", BigInt)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });
      const privateKey = args.privateKey || (await promptSensitiveValue("Insert your MACI private key"));

      const { hash } = await publish({
        publicKey: args.publicKey,
        stateIndex: args.stateIndex,
        voteOptionIndex: args.voteOptionIndex,
        nonce: args.nonce,
        pollId: args.pollId,
        newVoteWeight: args.newVoteWeight,
        maciAddress,
        salt: args.salt,
        privateKey,
        signer,
      });

      logGreen({
        quiet: args.quiet,
        text: success(`Message published successfully. Transaction hash: ${hash}`),
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });

program
  .command("mergeSignups")
  .description("merge the signups accumulator queue")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .requiredOption("-p, --poll-id <pollId>", "the poll id", BigInt)
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      const receipt = await mergeSignups({
        pollId: args.pollId,
        maciAddress,
        signer,
      });

      logGreen({ quiet: args.quiet, text: info(`Transaction hash: ${receipt.hash}`) });
      logGreen({
        quiet: args.quiet,
        text: success(`Executed mergeSignups(); gas used: ${receipt.gasUsed.toString()}`),
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("timeTravel")
  .description("fast-forward the time (only works for local hardhat testing")
  .requiredOption("-s, --seconds <seconds>", "the number of seconds to fast-forward", parseInt)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (args) => {
    try {
      banner(args.quiet);

      const signer = await getSigner();

      await timeTravel({ seconds: args.seconds, signer });

      logGreen({ quiet: args.quiet, text: success(`Fast-forwarded ${args.seconds} seconds`) });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("extractVerifyingKeyToFile")
  .description("extract vkey to json file")
  .requiredOption(
    "--poll-joining-zkey <pollJoiningZkey>",
    "the poll joining zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--poll-joined-zkey <pollJoinedZkey>",
    "the poll joined zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--message-processor-zkey-qv <messageProcessorZkeyPathQv>",
    "the message processor qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--vote-tally-zkey-qv <voteTallyZkeyPathQv>",
    "the vote tally qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--message-processor-zkey-non-qv <messageProcessorZkeyPathNonQv>",
    "the message processor non-qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--message-processor-zkey-full <messageProcessorZkeyPathFull>",
    "the message processor full zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "--vote-tally-zkey-non-qv <voteTallyZkeyPathNonQv>",
    "the vote tally non-qv zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption("-o, --output-file <outputFile>", "the output file path of extracted vkeys")
  .action(async (args) => {
    try {
      await extractVerifyingKeyToFile({
        messageProcessorZkeyPathQv: args.messageProcessorZkeyQv,
        messageProcessorZkeyPathFull: args.messageProcessorZkeyFull,
        voteTallyZkeyPathQv: args.voteTallyZkeyQv,
        messageProcessorZkeyPathNonQv: args.messageProcessorZkeyNonQv,
        voteTallyZkeyPathNonQv: args.voteTallyZkeyNonQv,
        pollJoiningZkeyPath: args.pollJoiningZkey,
        pollJoinedZkeyPath: args.pollJoinedZkey,
        outputFilePath: args.outputFile,
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("signup")
  .description("Sign up to a MACI contract")
  .requiredOption("-p, --public-key <publicKey>", "the MACI public key")
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-s, --sg-data <sgData>", "the signup gateway data")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      const data = await signup({
        maciPublicKey: args.publicKey,
        maciAddress,
        sgData: args.sgData ?? DEFAULT_SG_DATA,
        signer,
      });

      logGreen({
        quiet: args.quiet,
        text: success(`State index: ${data.stateIndex.toString()}\n Transaction hash: ${data.transactionHash}`),
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("isRegisteredUser")
  .description("Checks if user is registered with their public key and get their data")
  .requiredOption("-p, --public-key <publicKey>", "the MACI public key")
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      const data = await getSignedupUserData({
        maciPublicKey: args.publicKey,
        maciAddress,
        signer,
      });

      if (data.isRegistered) {
        logGreen({ quiet: args.quiet, text: success(`State index: ${data.stateIndex?.toString()}`) });
      } else {
        logRed({ quiet: args.quiet, text: "User is not registered" });
      }
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("isJoinedUser")
  .description("Checks if user is joined to the poll with public key")
  .requiredOption("-p, --public-key <publicKey>", "the MACI public key")
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", BigInt)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("--start-block <startBlock>", "the block number to start looking for events from", parseInt)
  .option("--end-block <endBlock>", "the block number to end looking for events from", parseInt)
  .option("--blocks-per-batch <blockPerBatch>", "the number of blocks to process per batch", parseInt)
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      const data = await getJoinedUserData({
        pollPublicKey: args.publicKey,
        startBlock: args.startBlock!,
        maciAddress,
        pollId: args.pollId,
        signer,
      });

      if (data.isJoined) {
        logGreen({
          quiet: args.quiet,
          text: success(
            [
              `Poll state index: ${data.pollStateIndex?.toString()}, registered: ${data.isJoined}`,
              `Voice credits: ${data.voiceCredits?.toString()}`,
            ].join("\n"),
          ),
        });
      } else {
        logRed({ quiet: args.quiet, text: "User has not joined the poll" });
      }
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });

program
  .command("getPoll")
  .description("Get deployed poll from MACI contract")
  .option("-p, --poll <poll>", "the poll id")
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      const details = await getPoll({
        pollId: args.poll,
        maciAddress,
        signer,
      });

      const modeNames = {
        [EMode.QV]: "Quadratic Voting",
        [EMode.NON_QV]: "Non-Quadratic Voting",
        [EMode.FULL]: "Full Credits Voting",
      };

      const status = details.isOpen ? "Open" : "Closed";

      logGreen({
        quiet: args.quiet,
        text: success(
          [
            `ID: ${details.id}`,
            `Start time: ${new Date(Number(details.startDate) * 1000).toString()}`,
            `End time: ${new Date(Number(details.endDate) * 1000).toString()}`,
            `Status: ${status}`,
            `Number of signups ${details.totalSignups}`,
            `State tree merged: ${details.isMerged}`,
            `Mode: ${modeNames[details.mode as EMode]}`,
          ].join("\n"),
        ),
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("fundWallet")
  .description("Fund a wallet with Ether")
  .requiredOption("-a, --amount <amount>", "the amount of Ether", parseInt)
  .requiredOption("-w, --address <address>", "the address to fund")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (args) => {
    try {
      banner(args.quiet);

      const signer = await getSigner();

      const hash = await fundWallet({ amount: args.amount, address: args.address, signer });

      logYellow({ quiet: args.quiet, text: info(`Transaction hash: ${hash}`) });
      logGreen({
        quiet: args.quiet,
        text: success(`Successfully funded ${args.address} with ${args.amount} wei`),
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("verify")
  .description("verify the results of a poll")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", BigInt)
  .requiredOption(
    "-t, --tally-file <tallyFile>",
    "the tally file with results, per vote option spent credits, spent voice credits total",
  )
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (args) => {
    try {
      banner(args.quiet);
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      // read the tally file
      const isTallyFileExists = fs.existsSync(args.tallyFile);

      if (!args.tallyFile || !isTallyFileExists) {
        throw new Error(`Unable to open ${args.tallyFile}`);
      }

      const tallyData = await readJSONFile<ITallyData>(args.tallyFile);

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      const pollParams = await getPollParams({ pollId: args.pollId, maciContractAddress: maciAddress, signer });
      const tallyCommitments = generateTallyCommitments({
        tallyData,
        voteOptionTreeDepth: pollParams.voteOptionTreeDepth,
      });

      await verify({
        tallyData,
        pollId: args.pollId,
        maciAddress,
        signer,
        tallyCommitments,
        totalVoteOptions: pollParams.totalVoteOptions,
        voteOptionTreeDepth: pollParams.voteOptionTreeDepth,
      });

      logGreen({ quiet: args.quiet, text: success("The tally commitment is correct") });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("generateProofs")
  .description("generate the proofs for a poll")
  .option("-k, --private-key <privateKey>", "your serialized MACI private key")
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", BigInt)
  .requiredOption(
    "-t, --tally-file <tallyFile>",
    "the tally file with results, per vote option spent credits, spent voice credits total",
  )
  .option("-r, --rapidsnark <rapidsnark>", "the path to the rapidsnark binary")
  .option(
    "-g, --message-processor-witness-generator <messageProcessorWitnessGenerator>",
    "the path to the process witness generation binary",
  )
  .option("--message-processor-witnessDat <messageProcessorWitnessDat>", "the path to the process witness dat file")
  .option(
    "--vote-tally-witness-generator <voteTallyWitnessGenerator>",
    "the path to the tally witness generation binary",
  )
  .option("--vote-tally-witnessDat <voteTallyWitnessDat>", "the path to the tally witness dat file")
  .requiredOption("--poll-joining-zkey <processJoinZkey>", "the path to the poll join zkey")
  .requiredOption("--message-processor-zkey <messageProcessorZkey>", "the path to the process zkey")
  .requiredOption("--vote-tally-zkey <voteTallyZkey>", "the path to the tally zkey")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-p, --rpc-provider <provider>", "the rpc provider URL")
  .requiredOption("-f, --output <outputDir>", "the output directory for proofs")
  .option("--transaction-hash <transactionHash>", "transaction hash of MACI contract creation")
  .option("-w, --wasm", "whether to use the wasm binaries")
  .option("--message-processor-wasm <messageProcessorWasm>", "the path to the process witness generation wasm binary")
  .option("--vote-tally-wasm <voteTallyWasm>", "the path to the tally witness generation wasm binary")
  .option("--state-file <stateFile>", "the path to the state file containing the serialized maci state")
  .option("--start-block <startBlock>", "the block number to start looking for events from", parseInt)
  .option("--end-block <endBlock>", "the block number to end looking for events from", parseInt)
  .option("--blocks-per-batch <blockPerBatch>", "the number of blocks to process per batch", parseInt)
  .option("-m, --mode <mode>", "Voting mode (qv, non-qv, full)", (value) => MODE_NAME_TO_ENUM[value], EMode.QV)
  .option(
    "-b, --ipfs-message-backup-files <ipfsMessageBackupFiles>",
    "Backup files for ipfs messages (name format: ipfsHash1.json, ipfsHash2.json, ..., ipfsHashN.json)",
    (value: string | undefined) => value?.split(/\s*,\s*/),
  )
  .action(
    async ({
      quiet,
      maciAddress,
      pollId,
      ipfsMessageBackupFiles,
      stateFile,
      startBlock,
      endBlock,
      blocksPerBatch,
      privateKey,
      transactionHash,
      output,
      tallyFile,
      voteTallyZkey,
      voteTallyWitnessGenerator,
      voteTallyWasm,
      messageProcessorZkey,
      messageProcessorWitnessGenerator,
      messageProcessorWasm,
      mode,
      voteTallyWitnessDat,
      messageProcessorWitnessDat,
      wasm,
      rapidsnark,
    }) => {
      try {
        banner(quiet);
        const signer = await getSigner();
        const network = await signer.provider?.getNetwork();

        const [maciContractAddress] = readContractAddresses({
          contractNames: [EContracts.MACI],
          network: network?.name,
          defaultAddresses: [maciAddress],
        });

        const coordinatorPrivateKey = privateKey || (await promptSensitiveValue("Insert your MACI private key"));

        await generateProofs({
          maciAddress: maciContractAddress,
          coordinatorPrivateKey,
          pollId: Number(pollId),
          ipfsMessageBackupFiles,
          stateFile: stateFile || "",
          transactionHash: transactionHash || "",
          startBlock,
          endBlock,
          blocksPerBatch,
          signer,
          outputDir: output,
          tallyFile,
          voteTallyZkey,
          voteTallyWitnessGenerator,
          voteTallyWasm,
          messageProcessorZkey,
          messageProcessorWitnessGenerator,
          messageProcessorWasm,
          mode,
          voteTallyWitnessDatFile: voteTallyWitnessDat,
          messageProcessorWitnessDatFile: messageProcessorWitnessDat,
          useWasm: wasm,
          rapidsnark,
        });
      } catch (error) {
        program.error((error as Error).message, { exitCode: 1 });
      }
    },
  );
program
  .command("generateLocalState")
  .description("generate a local MACI state from the smart contracts events")
  .requiredOption("-o, --output <outputPath>", "the path where to write the state")
  .requiredOption("-p, --poll-id <pollId>", "the id of the poll", BigInt)
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-k, --private-key <privateKey>", "your serialized MACI private key")
  .option("--start-block <startBlock>", "the start block number", parseInt)
  .option("--end-block <endBlock>", "the end block number", parseInt)
  .option("--blocks-per-batch <blockPerBatch>", "the blocks per batch", parseInt)
  .option("--transaction-hash <transactionHash>", "the transaction hash")
  .option("-s, --sleep <sleep>", "the sleep time between batches", parseInt)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option(
    "-b, --ipfs-message-backup-files <ipfsMessageBackupFiles>",
    "Backup files for ipfs messages (name format: ipfsHash1.json, ipfsHash2.json, ..., ipfsHashN.json)",
    (value: string | undefined) => value?.split(/\s*,\s*/),
  )
  .option("-l, --logs-output <logsOutputPath>", "the path where to save the logs for debugging and auditing purposes")
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      const coordinatorPrivateKey = args.privateKey || (await promptSensitiveValue("Insert your MACI private key"));

      await generateMaciState({
        outputPath: args.output.toString(),
        pollId: args.pollId,
        maciAddress,
        coordinatorPrivateKey,
        provider: args.rpcProvider,
        endBlock: args.endBlock,
        startBlock: args.startBlock,
        blockPerBatch: args.blocksPerBatch,
        transactionHash: args.transactionHash,
        ipfsMessageBackupFiles: args.ipfsMessageBackupFiles,
        sleep: args.sleep,
        signer,
        logsOutputPath: args.logsOutput,
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("proveOnChain")
  .description("prove the results of a poll on chain")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", BigInt)
  .option(
    "-t, --tally-file <tallyFile>",
    "the tally file with results, per vote option spent credits, spent voice credits total",
  )
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .requiredOption("-f, --proof-dir <proofDir>", "the proof output directory from the generateProofs subcommand")
  .action(async (args) => {
    try {
      const signer = await getSigner();
      const network = await signer.provider?.getNetwork();

      const [maciAddress] = readContractAddresses({
        contractNames: [EContracts.MACI],
        network: network?.name,
        defaultAddresses: [args.maciAddress],
      });

      await proveOnChain({
        pollId: args.pollId,
        tallyFile: args.tallyFile,
        proofDir: args.proofDir,
        maciAddress,
        signer,
      });
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });

if (require.main === module) {
  program.parseAsync(process.argv);
}
