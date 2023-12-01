import { createCommand } from "commander";
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
} from "./commands";
import { readFileSync } from "fs";
import { join } from "path";

const packagePath = join(__dirname, "..");
// set the description version and name of the cli tool
const { description, version, name } = JSON.parse(
    readFileSync(`${packagePath}/package.json`, "utf8")
);
const program = createCommand();
program.name(name).description(description).version(version);

// add the commands
program
    .command("create")
    .description("deploy the contracts")
    .option(
        "-v, --vkRegistryAddress <vkRegistryAddress>",
        "the vk registry contract address"
    )
    .option(
        "-i, --initialVoiceCredits <initialVoiceCredits>",
        "the initial voice credits"
    )
    .option(
        "-p, --initialVoiceCreditsProxyAddress <initialVoiceCreditsProxyAddress>",
        "the initial voice credits proxy contract address"
    )
    .option(
        "-g",
        "--signupGatekeeperAddress <signupGatekeeperAddress>",
        "the signup gatekeeper contract address"
    )
    .option("-q, --quiet", "whether to print values to the console")
    .requiredOption(
        "-s, --stateTreeDepth <stateTreeDepth>",
        "the state tree depth"
    )
    .action(async (cmdOptions) => {
        await deploy(
            cmdOptions.stateTreeDepth,
            cmdOptions.vkRegistryAddress,
            cmdOptions.initialVoiceCredits,
            cmdOptions.initialVoiceCreditsProxyAddress,
            cmdOptions.signupGatekeeperAddress,
            cmdOptions.quiet
        );
    });
program
    .command("checkVerifyingKeys")
    .description(
        "check that the verifying keys in the contract match the local ones"
    )
    .option("-q, --quiet", "whether to print values to the console", false)
    .option("-x, --maci-contract <maciContract>", "the MACI contract address")
    .requiredOption(
        "-s, --state-tree-depth <stateTreeDepth>",
        "the state tree depth"
    )
    .requiredOption(
        "-i, --int-state-tree-depth <intStateTreeDepth>",
        "the intermediate state tree depth"
    )
    .requiredOption(
        "-m, --msg-tree-depth <messageTreeDepth>",
        "the message tree depth"
    )
    .requiredOption(
        "-v, --vote-option-tree-depth <voteOptionTreeDepth>",
        "the vote option tree depth"
    )
    .requiredOption(
        "-b, --msg-batch-depth <messageBatchDepth>",
        "the message batch depth"
    )
    .requiredOption(
        "-p, --process-messages-zkey <processMessagesZkeyPath>",
        "the process messages zkey path"
    )
    .requiredOption(
        "-t, --tally-votes-zkey <tallyVotesZkeyPath>",
        "the tally votes zkey path"
    )
    .action(async (cmdOptions) => {
        await checkVerifyingKeys(
            cmdOptions.stateTreeDepth,
            cmdOptions.intStateTreeDepth,
            cmdOptions.msgTreeDepth,
            cmdOptions.voteOptionTreeDepth,
            cmdOptions.msgBatchDepth,
            cmdOptions.processMessagesZkey,
            cmdOptions.tallyVotesZkey,
            cmdOptions.maciContract,
            cmdOptions.quiet
        );
    });
program
    .command("genMaciPubKey")
    .description("generate a new MACI public key")
    .requiredOption("-sk, --privkey <privkey>", "the private key")
    .action((cmdObj) => {
        genMaciPubKey(cmdObj.privkey);
    });
program
    .command("genMaciKeyPair")
    .description("generate a new MACI key pair")
    .action(() => {
        genKeyPair;
    });
program
    .command("airdrop")
    .description("airdrop topup credits to the coordinator")
    .requiredOption("-a, --amount <amount>", "the amount of topup")
    .option("-x, --contract <contract>", "the MACI contract address")
    .option("-o, --poll-id <pollId>", "poll id")
    .option("-t, --token-address <tokenAddress>", "the token address")
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(
        async (cmdObj) =>
            await airdrop(
                cmdObj.amount,
                cmdObj.contract,
                cmdObj.pollId,
                cmdObj.tokenAddress,
                cmdObj.quiet
            )
    );
program
    .command("deployVkRegistry")
    .description("deploy a new verification key registry contract")
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(async (cmdObj) => {
        await deployVkRegistryContract(cmdObj.quiet);
    });
program
    .command("show")
    .description("show the deployed contract addresses")
    .option("-q, --quiet", "whether to print values to the console", false)
    .action((cmdObj) => {
        showContracts(cmdObj.quiet);
    });
program
    .command("deployPoll")
    .description("deploy a new poll")
    .requiredOption("-t, --duration <pollDuration>", "the poll duration")
    .requiredOption("-g, --max-messages <maxMessages>", "the max messages")
    .requiredOption(
        "-mv, --max-vote-options <maxVoteOptions>",
        "the max vote options"
    )
    .requiredOption(
        "-i, --int-state-tree-depth <intStateTreeDepth>",
        "the int state tree depth"
    )
    .requiredOption(
        "-b, --msg-batch-depth <messageTreeSubDepth>",
        "the message tree sub depth"
    )
    .requiredOption(
        "-m, --msg-tree-depth <messageTreeDepth>",
        "the message tree depth"
    )
    .requiredOption(
        "-v, --vote-option-tree-depth <voteOptionTreeDepth>",
        "the vote option tree depth"
    )
    .requiredOption(
        "-pk, --pubkey <coordinatorPubkey>",
        "the coordinator public key"
    )
    .option("-x, --maci-address <maciAddress>", "the MACI contract address")
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(async (cmdObj) => {
        await deployPoll(
            cmdObj.duration,
            cmdObj.maxMessages,
            cmdObj.maxVoteOptions,
            cmdObj.intStateTreeDepth,
            cmdObj.msgBatchDepth,
            cmdObj.msgTreeDepth,
            cmdObj.voteOptionTreeDepth,
            cmdObj.pubkey,
            cmdObj.maciAddress,
            cmdObj.quiet
        );
    });
program
    .command("setVerifyingKeys")
    .description("set the verifying keys")
    .requiredOption(
        "-s, --state-tree-depth <stateTreeDepth>",
        "the state tree depth"
    )
    .requiredOption(
        "-i, --int-state-tree-depth <intStateTreeDepth>",
        "the intermediate state tree depth"
    )
    .requiredOption(
        "-m, --msg-tree-depth <messageTreeDepth>",
        "the message tree depth"
    )
    .requiredOption(
        "-v, --vote-option-tree-depth <voteOptionTreeDepth>",
        "the vote option tree depth"
    )
    .requiredOption(
        "-b, --msg-batch-depth <messageBatchDepth>",
        "the message batch depth"
    )
    .requiredOption(
        "-p, --process-messages-zkey <processMessagesZkeyPath>",
        "the process messages zkey path"
    )
    .requiredOption(
        "-t, --tally-votes-zkey <tallyVotesZkeyPath>",
        "the tally votes zkey path"
    )
    .option(
        "-k, --vk-registry <vkRegistry>",
        "the vk registry contract address"
    )
    .option("-q, --quiet", "whether to print values to the console", false)
    .option("-ss, --subsidy-zkey <subsidyZkeyPath>", "the subsidy zkey path")
    .action(
        async (cmdObj) =>
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
                cmdObj.quiet
            )
    );
program
    .command("publish")
    .description("publish a new message to a MACI Poll contract")
    .requiredOption(
        "-p, --pubkey <pubkey>",
        "the MACI public key which should replace the user's public key in the state tree"
    )
    .option("-x, --contract <contract>", "the MACI contract address")
    .option("-sk, --privkey <privkey>", "your serialized MACI private key")
    .requiredOption("-i, --state-index <stateIndex>", "the user's state index")
    .requiredOption(
        "-v, --vote-option-index <voteOptionIndex>",
        "the vote option index"
    )
    .requiredOption("-n, --nonce <nonce>", "the message nonce")
    .option("-s, --salt <salt>", "the message salt")
    .requiredOption("-o, --poll-id <pollId>", "the poll id")
    .requiredOption(
        "-w, --new-vote-weight <newVoteWeight>",
        "the new vote weight"
    )
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(async (cmdObj) => {
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
            cmdObj.quiet
        );
    });
program
    .command("mergeMessages")
    .description("merge the message accumulator queue")
    .option("-q, --quiet", "whether to print values to the console", false)
    .option(
        "-x, --maci-contract-address <maciContractAddress>",
        "the MACI contract address"
    )
    .requiredOption("-o, --poll-id <pollId>", "the poll id")
    .option(
        "-n, --num-queue-ops <numQueueOps>",
        "the number of queue operations"
    )
    .action(
        async (cmdObj) =>
            await mergeMessages(
                cmdObj.pollId,
                cmdObj.maciContractAddress,
                cmdObj.numQueueOps,
                cmdObj.quiet
            )
    );
program
    .command("mergeSignups")
    .description("merge the signups accumulator queue")
    .option("-q, --quiet", "whether to print values to the console", false)
    .option(
        "-x, --maci-contract-address <maciContractAddress>",
        "the MACI contract address"
    )
    .requiredOption("-o, --poll-id <pollId>", "the poll id")
    .option(
        "-n, --num-queue-ops <numQueueOps>",
        "the number of queue operations"
    )
    .action(
        async (cmdObj) =>
            await mergeSignups(
                cmdObj.pollId,
                cmdObj.maciContractAddress,
                cmdObj.numQueueOps,
                cmdObj.quiet
            )
    );
program
    .command("timeTravel")
    .description("fast-forward the time (only works for local hardhat testing")
    .requiredOption(
        "-s, --seconds <seconds>",
        "the number of seconds to fast-forward"
    )
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(async (cmdObj) => await timeTravel(cmdObj.quiet, cmdObj.provider));
program
    .command("signup")
    .description("Sign up to a MACI contract")
    .requiredOption("-p, --pubkey <maciPubKey>", "the MACI public key")
    .option("-x, --maci-address <maciAddress>", "the MACI contract address")
    .option("-s, --sg-data <sgData>", "the signup gateway data")
    .option("-i, --ivcp-data <ivcpData>", "the initial voice credit proxy data")
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(async (cmdObj) => {
        await signup(
            cmdObj.pubkey,
            cmdObj.maciAddress,
            cmdObj.sgData,
            cmdObj.ivcpData,
            cmdObj.quiet
        );
    });
program
    .command("topup")
    .description("Top up an account with voice credits")
    .requiredOption("-a, --amount <amount>", "the amount of topup")
    .option("-x, --maci-address <maciAddress>", "the MACI contract address")
    .requiredOption("-i, --state-index <stateIndex>", "state leaf index")
    .requiredOption("-o, --poll-id <pollId>", "poll id")
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(
        async (cmdObj) =>
            await topup(
                cmdObj.amount,
                cmdObj.stateIndex,
                cmdObj.pollId,
                cmdObj.maciAddress,
                cmdObj.quiet
            )
    );
program
    .command("fundWallet")
    .description("Fund a wallet with Ether")
    .requiredOption("-a, --amount <amount>", "the amount of Ether")
    .requiredOption("-w, --address <address>", "the address to fund")
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(
        async (cmdObj) =>
            await fundWallet(cmdObj.amount, cmdObj.address, cmdObj.quiet)
    );
program
    .command("verify")
    .description(
        "verify the results of a poll and optionally the subsidy results"
    )
    .requiredOption("-o, --poll-id <pollId>", "the poll id")
    .requiredOption("-t, --tally-file <tallyFile>", "the tally file")
    .option("-s, --subsidy-file <subsidyFile>", "the subsidy file")
    .option("-x, --contract <contract>", "the MACI contract address")
    .option(
        "-tc, --tally-contract <tallyContract>",
        "the tally contract address"
    )
    .option(
        "-sc, --subsidy-contract <subsidyContract>",
        "the subsidy contract address"
    )
    .option("-q, --quiet", "whether to print values to the console", false)
    .action(
        async (cmdObj) =>
            await verify(
                cmdObj.pollId,
                cmdObj.tallyFile,
                cmdObj.contract,
                cmdObj.tallyContract,
                cmdObj.subsidyContract,
                cmdObj.subsidyFile,
                cmdObj.quiet
            )
    );
program
    .command("genProofs")
    .description("generate the proofs for a poll")
    .option("-sk, --privkey <privkey>", "your serialized MACI private key")
    .option("-x, --contract <contract>", "the MACI contract address")
    .requiredOption("-o, --poll-id <pollId>", "the poll id")
    .option("-t, --tally-file <tallyFile>", "the tally file")
    .option("-s, --subsidy-file <subsidyFile>", "the subsidy file")
    .option(
        "-r, --rapidsnark <rapidsnark>",
        "the path to the rapidsnark binary"
    )
    .option(
        "-wp, --process-witnessgen <processWitnessgen>",
        "the path to the process witness generation binary"
    )
    .option(
        "-wt, --tally-witnessgen <tallyWitnessgen>",
        "the path to the tally witness generation binary"
    )
    .option(
        "-ws, --subsidy-witnessgen <subsidyWitnessgen>",
        "the path to the subsidy witness generation binary"
    )
    .requiredOption(
        "-zp, --process-zkey <processZkey>",
        "the path to the process zkey"
    )
    .requiredOption(
        "-zt, --tally-zkey <tallyZkey>",
        "the path to the tally zkey"
    )
    .option("-zs, --subsidy-zkey <subsidyZkey>", "the path to the subsidy zkey")
    .option("-q, --quiet", "whether to print values to the console", false)
    .requiredOption(
        "-f, --output <outputDir>",
        "the output directory for proofs"
    )
    .option(
        "-tx, --transaction-hash <transactionHash>",
        "transaction hash of MACI contract creation"
    )
    .option("-w, --wasm", "whether to use the wasm binaries")
    .option(
        "-pw, --process-wasm <processWasm>",
        "the path to the process witness generation wasm binary"
    )
    .option(
        "-tw, --tally-wasm <tallyWasm>",
        "the path to the tally witness generation wasm binary"
    )
    .option(
        "-sw, --subsidy-wasm <subsidyWasm>",
        "the path to the subsidy witness generation wasm binary"
    )
    .action(async (cmdObj) => {
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
            cmdObj.tallyWitnessgen,
            cmdObj.subsidyWitnessgen,
            cmdObj.privkey,
            cmdObj.contract,
            cmdObj.transactionHash,
            cmdObj.processWasm,
            cmdObj.tallyWasm,
            cmdObj.subsidyWasm,
            cmdObj.wasm,
            cmdObj.quiet
        );
    });
program
    .command("proveOnChain")
    .description("prove the results of a poll on chain")
    .requiredOption("-o, --poll-id <pollId>", "the poll id")
    .option("-q, --quiet", "whether to print values to the console", false)
    .option("-x, --contract <contract>", "the MACI contract address")
    .option(
        "-p, --message-processor-address <messageProcessorAddress>",
        "the message processor contract address"
    )
    .option(
        "-t, --tally-contract <tallyContract>",
        "the tally contract address"
    )
    .option(
        "-s, --subsidy-contract <subsidyContract>",
        "the subsidy contract address"
    )
    .requiredOption(
        "-f, --proof-dir <proofDir>",
        "the proof output directory from the genProofs subcommand"
    )
    .action(
        async (cmdObj) =>
            await proveOnChain(
                cmdObj.pollId,
                cmdObj.proofDir,
                cmdObj.contract,
                cmdObj.messageProcessorAddress,
                cmdObj.tallyContract,
                cmdObj.subsidyContract,
                cmdObj.quiet
            )
    );

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

export { DeployedContracts, PollContracts } from "./utils";
