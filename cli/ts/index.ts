#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings";

import fs from "fs";
import path from "path";

import "./cliInit";
import {
  genKeyPair,
  genMaciPubKey,
  airdrop,
  deployVkRegistryContract,
  deploy,
  showContracts,
  deployPoll,
  mergeMessages,
  publish,
  setVerifyingKeys,
  mergeSignups,
  timeTravel,
  signup,
  topup,
  verify,
  genProofs,
  fundWallet,
  proveOnChain,
  checkVerifyingKeys,
  genLocalState,
} from "./commands";

// set the description version and name of the cli tool
const { description, version, name } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"),
) as { description: string; version: string; name: string };
const program = new Command();
program.name(name).description(description).version(version);
// add the commands
program
  .command("create")
  .description("deploy the contracts")
  .option("-i, --initialVoiceCredits <initialVoiceCredits>", "the initial voice credits", parseInt)
  .option(
    "-p, --initialVoiceCreditsProxyAddress <initialVoiceCreditsProxyAddress>",
    "the initial voice credits proxy contract address",
  )
  .option("-g, --signupGatekeeperAddress <signupGatekeeperAddress>", "the signup gatekeeper contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .requiredOption("-s, --stateTreeDepth <stateTreeDepth>", "the state tree depth", parseInt)
  .action(async (cmdOptions) => {
    try {
      await deploy(
        cmdOptions.stateTreeDepth,
        cmdOptions.initialVoiceCredits,
        cmdOptions.initialVoiceCreditsProxyAddress,
        cmdOptions.signupGatekeeperAddress,
        cmdOptions.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("checkVerifyingKeys")
  .description("check that the verifying keys in the contract match the local ones")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option("-vk, --vk-contract <vkContract>", "the VkRegistry contract address")
  .requiredOption("-s, --state-tree-depth <stateTreeDepth>", "the state tree depth", parseInt)
  .requiredOption("-i, --int-state-tree-depth <intStateTreeDepth>", "the intermediate state tree depth", parseInt)
  .requiredOption("-m, --msg-tree-depth <messageTreeDepth>", "the message tree depth", parseInt)
  .requiredOption("-v, --vote-option-tree-depth <voteOptionTreeDepth>", "the vote option tree depth", parseInt)
  .requiredOption("-b, --msg-batch-depth <messageBatchDepth>", "the message batch depth", parseInt)
  .requiredOption(
    "-p, --process-messages-zkey <processMessagesZkeyPath>",
    "the process messages zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "-t, --tally-votes-zkey <tallyVotesZkeyPath>",
    "the tally votes zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option(
    "-ss, --subsidy-zkey <subsidyZkeyPath>",
    "the subsidy zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .action(async (cmdOptions) => {
    try {
      await checkVerifyingKeys(
        cmdOptions.stateTreeDepth,
        cmdOptions.intStateTreeDepth,
        cmdOptions.msgTreeDepth,
        cmdOptions.voteOptionTreeDepth,
        cmdOptions.msgBatchDepth,
        cmdOptions.processMessagesZkey,
        cmdOptions.tallyVotesZkey,
        cmdOptions.vkContract,
        cmdOptions.subsidyZkey,
        cmdOptions.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("genMaciPubKey")
  .description("generate a new MACI public key")
  .requiredOption("-sk, --privkey <privkey>", "the private key")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action((cmdObj) => {
    genMaciPubKey(cmdObj.privkey, cmdObj.quiet);
  });
program
  .command("genMaciKeyPair")
  .description("generate a new MACI key pair")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action((cmdObj) => {
    genKeyPair(cmdObj.quiet);
  });
program
  .command("airdrop")
  .description("airdrop topup credits to the coordinator")
  .requiredOption("-a, --amount <amount>", "the amount of topup", parseInt)
  .option("-x, --contract <contract>", "the MACI contract address")
  .option("-o, --poll-id <pollId>", "poll id", parseInt)
  .option("-t, --token-address <tokenAddress>", "the token address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await airdrop(cmdObj.amount, cmdObj.contract, cmdObj.pollId, cmdObj.tokenAddress, cmdObj.quiet);
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("deployVkRegistry")
  .description("deploy a new verification key registry contract")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await deployVkRegistryContract(cmdObj.quiet);
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("show")
  .description("show the deployed contract addresses")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action((cmdObj) => {
    try {
      showContracts(cmdObj.quiet);
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("deployPoll")
  .description("deploy a new poll")
  .option("-vk, --vkRegistryAddress <vkRegistryAddress>", "the vk registry contract address")
  .requiredOption("-t, --duration <pollDuration>", "the poll duration", parseInt)
  .requiredOption("-g, --max-messages <maxMessages>", "the max messages", parseInt)
  .requiredOption("-mv, --max-vote-options <maxVoteOptions>", "the max vote options", parseInt)
  .requiredOption("-i, --int-state-tree-depth <intStateTreeDepth>", "the int state tree depth", parseInt)
  .requiredOption("-b, --msg-batch-depth <messageTreeSubDepth>", "the message tree sub depth", parseInt)
  .requiredOption("-m, --msg-tree-depth <messageTreeDepth>", "the message tree depth", parseInt)
  .requiredOption("-v, --vote-option-tree-depth <voteOptionTreeDepth>", "the vote option tree depth", parseInt)
  .requiredOption("-pk, --pubkey <coordinatorPubkey>", "the coordinator public key")
  .requiredOption(
    "-se, --subsidy-enabled <subsidyEnabled>",
    "whether to deploy subsidy contract",
    (value) => value === "true",
    false,
  )
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await deployPoll(
        cmdObj.duration,
        cmdObj.maxMessages,
        cmdObj.maxVoteOptions,
        cmdObj.intStateTreeDepth,
        cmdObj.msgBatchDepth,
        cmdObj.msgTreeDepth,
        cmdObj.voteOptionTreeDepth,
        cmdObj.pubkey,
        cmdObj.subsidyEnabled,
        cmdObj.maciAddress,
        cmdObj.vkRegistryAddress,
        cmdObj.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("setVerifyingKeys")
  .description("set the verifying keys")
  .requiredOption("-s, --state-tree-depth <stateTreeDepth>", "the state tree depth", parseInt)
  .requiredOption("-i, --int-state-tree-depth <intStateTreeDepth>", "the intermediate state tree depth", parseInt)
  .requiredOption("-m, --msg-tree-depth <messageTreeDepth>", "the message tree depth", parseInt)
  .requiredOption("-v, --vote-option-tree-depth <voteOptionTreeDepth>", "the vote option tree depth", parseInt)
  .requiredOption("-b, --msg-batch-depth <messageBatchDepth>", "the message batch depth", parseInt)
  .requiredOption(
    "-p, --process-messages-zkey <processMessagesZkeyPath>",
    "the process messages zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .requiredOption(
    "-t, --tally-votes-zkey <tallyVotesZkeyPath>",
    "the tally votes zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .option("-k, --vk-registry <vkRegistry>", "the vk registry contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option(
    "-ss, --subsidy-zkey <subsidyZkeyPath>",
    "the subsidy zkey path (see different options for zkey files to use specific circuits https://maci.pse.dev/docs/trusted-setup, https://maci.pse.dev/docs/testing/#pre-compiled-artifacts-for-testing)",
  )
  .action(async (cmdObj) => {
    try {
      await setVerifyingKeys(
        cmdObj.stateTreeDepth,
        cmdObj.intStateTreeDepth,
        cmdObj.msgTreeDepth,
        cmdObj.voteOptionTreeDepth,
        cmdObj.msgBatchDepth,
        cmdObj.processMessagesZkey,
        cmdObj.tallyVotesZkey,
        cmdObj.vkRegistry,
        cmdObj.subsidyZkey,
        cmdObj.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("publish")
  .description("publish a new message to a MACI Poll contract")
  .requiredOption(
    "-p, --pubkey <pubkey>",
    "the MACI public key which should replace the user's public key in the state tree",
  )
  .option("-x, --contract <contract>", "the MACI contract address")
  .option("-sk, --privkey <privkey>", "your serialized MACI private key")
  .requiredOption("-i, --state-index <stateIndex>", "the user's state index", parseInt)
  .requiredOption("-v, --vote-option-index <voteOptionIndex>", "the vote option index", parseInt)
  .requiredOption("-n, --nonce <nonce>", "the message nonce", parseInt)
  .option("-s, --salt <salt>", "the message salt")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", parseInt)
  .requiredOption("-w, --new-vote-weight <newVoteWeight>", "the new vote weight", parseInt)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await publish(
        cmdObj.pubkey,
        cmdObj.stateIndex,
        cmdObj.voteOptionIndex,
        cmdObj.nonce,
        cmdObj.pollId,
        cmdObj.newVoteWeight,
        cmdObj.contract,
        cmdObj.salt,
        cmdObj.privkey,
        cmdObj.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("mergeMessages")
  .description("merge the message accumulator queue")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option("-x, --maci-contract-address <maciContractAddress>", "the MACI contract address")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", parseInt)
  .option("-n, --num-queue-ops <numQueueOps>", "the number of queue operations", parseInt)
  .action(async (cmdObj) => {
    try {
      await mergeMessages(cmdObj.pollId, cmdObj.maciContractAddress, cmdObj.numQueueOps?.toString(), cmdObj.quiet);
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("mergeSignups")
  .description("merge the signups accumulator queue")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option("-x, --maci-contract-address <maciContractAddress>", "the MACI contract address")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", parseInt)
  .option("-n, --num-queue-ops <numQueueOps>", "the number of queue operations", parseInt)
  .action(async (cmdObj) => {
    try {
      await mergeSignups(cmdObj.pollId, cmdObj.maciContractAddress, cmdObj.numQueueOps?.toString(), cmdObj.quiet);
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
  .action(async (cmdObj) => {
    try {
      await timeTravel(cmdObj.seconds, cmdObj.quiet);
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("signup")
  .description("Sign up to a MACI contract")
  .requiredOption("-p, --pubkey <maciPubKey>", "the MACI public key")
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .option("-s, --sg-data <sgData>", "the signup gateway data")
  .option("-i, --ivcp-data <ivcpData>", "the initial voice credit proxy data")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await signup(cmdObj.pubkey, cmdObj.maciAddress, cmdObj.sgData, cmdObj.ivcpData, cmdObj.quiet);
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("topup")
  .description("Top up an account with voice credits")
  .requiredOption("-a, --amount <amount>", "the amount of topup", parseInt)
  .option("-x, --maci-address <maciAddress>", "the MACI contract address")
  .requiredOption("-i, --state-index <stateIndex>", "state leaf index", parseInt)
  .requiredOption("-o, --poll-id <pollId>", "poll id", parseInt)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await topup(cmdObj.amount, cmdObj.stateIndex, cmdObj.pollId, cmdObj.maciAddress, cmdObj.quiet);
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
  .action(async (cmdObj) => {
    try {
      await fundWallet(cmdObj.amount, cmdObj.address, cmdObj.quiet);
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("verify")
  .description("verify the results of a poll and optionally the subsidy results")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", parseInt)
  .requiredOption(
    "-t, --tally-file <tallyFile>",
    "the tally file with results, per vote option spent credits, spent voice credits total",
  )
  .requiredOption(
    "-se, --subsidy-enabled <subsidyEnabled>",
    "whether to deploy subsidy contract",
    (value) => value === "true",
    false,
  )
  .option("-s, --subsidy-file <subsidyFile>", "the subsidy file")
  .option("-x, --contract <contract>", "the MACI contract address")
  .option("-tc, --tally-contract <tallyContract>", "the tally contract address")
  .option("-sc, --subsidy-contract <subsidyContract>", "the subsidy contract address")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await verify(
        cmdObj.pollId.toString(),
        cmdObj.subsidyEnabled,
        cmdObj.tallyFile,
        undefined,
        cmdObj.contract,
        cmdObj.tallyContract,
        cmdObj.subsidyContract,
        cmdObj.subsidyFile,
        cmdObj.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("genProofs")
  .description("generate the proofs for a poll")
  .option("-sk, --privkey <privkey>", "your serialized MACI private key")
  .option("-x, --contract <contract>", "the MACI contract address")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", parseInt)
  .requiredOption(
    "-t, --tally-file <tallyFile>",
    "the tally file with results, per vote option spent credits, spent voice credits total",
  )
  .option("-s, --subsidy-file <subsidyFile>", "the subsidy file")
  .option("-r, --rapidsnark <rapidsnark>", "the path to the rapidsnark binary")
  .option("-wp, --process-witnessgen <processWitnessgen>", "the path to the process witness generation binary")
  .option("-pd, --process-witnessdat <processWitnessdat>", "the path to the process witness dat file")
  .option("-wt, --tally-witnessgen <tallyWitnessgen>", "the path to the tally witness generation binary")
  .option("-td, --tally-witnessdat <tallyWitnessdat>", "the path to the tally witness dat file")
  .option("-ws, --subsidy-witnessgen <subsidyWitnessgen>", "the path to the subsidy witness generation binary")
  .option("-sd, --subsidy-witnessdat <subsidyWitnessdat>", "the path to the subsidy witness dat file")
  .requiredOption("-zp, --process-zkey <processZkey>", "the path to the process zkey")
  .requiredOption("-zt, --tally-zkey <tallyZkey>", "the path to the tally zkey")
  .option("-zs, --subsidy-zkey <subsidyZkey>", "the path to the subsidy zkey")
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-p, --rpc-provider <provider>", "the rpc provider URL")
  .requiredOption("-f, --output <outputDir>", "the output directory for proofs")
  .option("-tx, --transaction-hash <transactionHash>", "transaction hash of MACI contract creation")
  .option("-w, --wasm", "whether to use the wasm binaries")
  .option("-pw, --process-wasm <processWasm>", "the path to the process witness generation wasm binary")
  .option("-tw, --tally-wasm <tallyWasm>", "the path to the tally witness generation wasm binary")
  .option("-sw, --subsidy-wasm <subsidyWasm>", "the path to the subsidy witness generation wasm binary")
  .option("-st, --state-file <stateFile>", "the path to the state file containing the serialized maci state")
  .option("-sb, --start-block <startBlock>", "the block number to start looking for events from", parseInt)
  .option("-eb, --end-block <endBlock>", "the block number to end looking for events from", parseInt)
  .option("-bb, --blocks-per-batch <blockPerBatch>", "the number of blocks to process per batch", parseInt)
  .action(async (cmdObj) => {
    try {
      await genProofs(
        cmdObj.output,
        cmdObj.tallyFile,
        cmdObj.tallyZkey,
        cmdObj.processZkey,
        cmdObj.pollId,
        cmdObj.subsidyFile,
        cmdObj.subsidyZkey,
        cmdObj.rapidsnark,
        cmdObj.processWitnessgen,
        cmdObj.processWitnessdat,
        cmdObj.tallyWitnessgen,
        cmdObj.tallyWitnessdat,
        cmdObj.subsidyWitnessgen,
        cmdObj.subsidyWitnessdat,
        cmdObj.privkey,
        cmdObj.contract,
        cmdObj.transactionHash,
        cmdObj.processWasm,
        cmdObj.tallyWasm,
        cmdObj.subsidyWasm,
        cmdObj.wasm,
        cmdObj.stateFile,
        cmdObj.startBlock,
        cmdObj.endBlock,
        cmdObj.blocksPerBatch,
        cmdObj.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("genLocalState")
  .description("generate a local MACI state from the smart contracts events")
  .requiredOption("-o, --output <outputPath>", "the path where to write the state", parseInt)
  .requiredOption("-p, --poll-id <pollId>", "the id of the poll", parseInt)
  .option("-x, --contract <contract>", "the MACI contract address")
  .option("-sk, --privkey <privkey>", "your serialized MACI private key")
  .option("-eb, --end-block <endBlock>", "the end block number", parseInt)
  .option("-sb, --start-block <startBlock>", "the start block number", parseInt)
  .option("-bb, --blocks-per-batch <blockPerBatch>", "the blocks per batch", parseInt)
  .option("-tx, --transaction-hash <transactionHash>", "the transaction hash")
  .option("-s, --sleep <sleep>", "the sleep time between batches", parseInt)
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .action(async (cmdObj) => {
    try {
      await genLocalState(
        cmdObj.output.toString(),
        cmdObj.pollId,
        cmdObj.contract,
        cmdObj.privkey,
        cmdObj.rpcProvider,
        cmdObj.endBlock,
        cmdObj.startBlock,
        cmdObj.blocksPerBatch,
        cmdObj.transactionHash,
        cmdObj.sleep,
        cmdObj.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });
program
  .command("proveOnChain")
  .description("prove the results of a poll on chain")
  .requiredOption("-o, --poll-id <pollId>", "the poll id", parseInt)
  .requiredOption(
    "-se, --subsidy-enabled <subsidyEnabled>",
    "whether to deploy subsidy contract",
    (value) => value === "true",
    false,
  )
  .option("-q, --quiet <quiet>", "whether to print values to the console", (value) => value === "true", false)
  .option("-r, --rpc-provider <provider>", "the rpc provider URL")
  .option("-x, --contract <contract>", "the MACI contract address")
  .option("-p, --message-processor-address <messageProcessorAddress>", "the message processor contract address")
  .option("-t, --tally-contract <tallyContract>", "the tally contract address")
  .option("-s, --subsidy-contract <subsidyContract>", "the subsidy contract address")
  .requiredOption("-f, --proof-dir <proofDir>", "the proof output directory from the genProofs subcommand")
  .action(async (cmdObj) => {
    try {
      await proveOnChain(
        cmdObj.pollId.toString(),
        cmdObj.proofDir,
        cmdObj.subsidyEnabled,
        cmdObj.contract,
        cmdObj.messageProcessorAddress,
        cmdObj.tallyContract,
        cmdObj.subsidyContract,
        cmdObj.quiet,
      );
    } catch (error) {
      program.error((error as Error).message, { exitCode: 1 });
    }
  });

if (require.main === module) {
  program.parseAsync(process.argv);
}

// export everything so we can use in other packages
export {
  airdrop,
  checkVerifyingKeys,
  deploy,
  deployPoll,
  deployVkRegistryContract,
  fundWallet,
  genKeyPair,
  genMaciPubKey,
  genLocalState,
  genProofs,
  mergeMessages,
  mergeSignups,
  publish,
  proveOnChain,
  setVerifyingKeys,
  signup,
  timeTravel,
  topup,
  verify,
} from "./commands";

export type { DeployedContracts, PollContracts, TallyData } from "./utils";
