import * as ethers from "ethers";
import * as fs from "fs";
import * as path from "path";

import { genProof, verifyProof, extractVk } from "maci-circuits";
import { hashLeftRight, hash3, genTreeCommitment } from "maci-crypto";
import { PrivKey, Keypair, VerifyingKey } from "maci-domainobjs";

import {
    parseArtifact,
    getDefaultSigner,
    genMaciStateFromContract,
} from "maci-contracts";

import {
    promptPwd,
    validateEthAddress,
    contractExists,
    isPathExist,
} from "./utils";
import { readJSONFile } from "maci-common";
import { contractFilepath } from "./config";

const configureSubparser = (subparsers: any) => {
    const parser = subparsers.addParser("genProofs", { addHelp: true });

    const maciPrivkeyGroup = parser.addMutuallyExclusiveGroup({
        required: true,
    });
    const processMessageWasmGroup = parser.addMutuallyExclusiveGroup({
        required: true,
    });
    const tallyVotesWasmGroup = parser.addMutuallyExclusiveGroup({
        required: true,
    });
    const subsidyWasmGroup = parser.addMutuallyExclusiveGroup({
        required: false,
    });

    maciPrivkeyGroup.addArgument(["-dsk", "--prompt-for-maci-privkey"], {
        action: "storeTrue",
        help: "Whether to prompt for your serialized MACI private key",
    });

    maciPrivkeyGroup.addArgument(["-sk", "--privkey"], {
        action: "store",
        type: "string",
        help: "Your serialized MACI private key",
    });

    parser.addArgument(["-x", "--contract"], {
        type: "string",
        help: "The MACI contract address",
    });

    parser.addArgument(["-o", "--poll-id"], {
        action: "store",
        required: true,
        type: "string",
        help: "The Poll ID",
    });

    parser.addArgument(["-t", "--tally-file"], {
        required: true,
        type: "string",
        help: "A filepath in which to save the final vote tally and salt.",
    });

    parser.addArgument(["-sf", "--subsidy-file"], {
        type: "string",
        help: "A filepath in which to save the subsidy data and commitment.",
    });

    parser.addArgument(["-r", "--rapidsnark"], {
        type: "string",
        help: "The path to the rapidsnark binary",
    });

    processMessageWasmGroup.addArgument(["-pw", "--process-wasm"], {
        type: "string",
        help: "The path to the ProcessMessages wasm file",
    });

    processMessageWasmGroup.addArgument(["-wp", "--process-witnessgen"], {
        type: "string",
        help: "The path to the ProcessMessages witness generation binary",
    });

    tallyVotesWasmGroup.addArgument(["-tw", "--tally-wasm"], {
        type: "string",
        help: "The path to the TallyVotes wasm file",
    });

    tallyVotesWasmGroup.addArgument(["-wt", "--tally-witnessgen"], {
        type: "string",
        help: "The path to the TallyVotes witness generation binary",
    });

    subsidyWasmGroup.addArgument(["-sw", "--subsidy-wasm"], {
        type: "string",
        help: "The path to the SubsidyPerBatch wasm file",
    });

    subsidyWasmGroup.addArgument(["-ws", "--subsidy-witnessgen"], {
        type: "string",
        help: "The path to the subsidy calculation witness generation binary",
    });

    parser.addArgument(["-zp", "--process-zkey"], {
        required: true,
        type: "string",
        help: "The path to the ProcessMessages .zkey file",
    });

    parser.addArgument(["-zt", "--tally-zkey"], {
        required: true,
        type: "string",
        help: "The path to the TallyVotes .zkey file",
    });

    parser.addArgument(["-zs", "--subsidy-zkey"], {
        type: "string",
        help: "The path to the SubsidyPerBatch .zkey file",
    });

    parser.addArgument(["-f", "--output"], {
        required: true,
        type: "string",
        help: "The output directory for proofs",
    });

    parser.addArgument(["-tx", "--transaction-hash"], {
        type: "string",
        help: "transaction hash of MACI contract creation",
    });
};

const genProofs = async (args: any) => {
    const outputDir = args.output;

    if (!fs.existsSync(outputDir)) {
        // Create the directory
        fs.mkdirSync(outputDir);
    }

    if (fs.existsSync(args.tally_file)) {
        console.error(
            `Error: ${args.tally_file} exists. Please specify a different filepath.`
        );
        return;
    }

    // if we are using the witness gen programs, then we assume we are running on an intel chip
    // and thus can use rapidsnark for speed
    // @note that wasm and witnessgen are mutually exclusive so if we have the paths
    // to the witnesses we are sure that no path to the wasm files was provided
    const rapidsnarkExe = args.rapidsnark;
    if (args.tally_witnessgen && args.process_witnessgen && !rapidsnarkExe) {
        console.error("Please specify the path to the rapidsnark binary");
        return;
    }

    // check that we have the files on disk
    if (args.tally_witnessgen && args.process_witnessgen) {
        const [ok, path] = isPathExist([
            rapidsnarkExe,
            args.process_witnessgen + ".dat",
            args.tally_witnessgen + ".dat",
        ]);
        if (!ok) {
            console.error(`Error: ${path} does not exist.`);
            return;
        }
    } else {
        const [ok, path] = isPathExist([args.process_wasm, args.tally_wasm]);
        if (!ok) {
            console.error(`Error: ${path} does not exist.`);
            return;
        }
    }

    const [ok, path] = isPathExist([args.process_zkey, args.tally_zkey]);
    if (!ok) {
        console.error(`Error: ${path} does not exist.`);
        return;
    }

    let subsidyVk: VerifyingKey | undefined = undefined;

    if (args.subsidy_file) {
        if (fs.existsSync(args.subsidy_file)) {
            console.error(
                `Error: ${args.subsidy_file} exists. Please specify a different filepath.`
            );
            return;
        }
        if (!args.subsidy_zkey) {
            console.error("Please specify subsidy zkey file location");
            return;
        }
        if (!args.subsidy_witnessgen && !args.subsidy_wasm) {
            console.error(
                "Please specify either the subsidy witnessgen or the subsidy wasm file location"
            );
            return;
        }

        if (args.subsidy_witnessgen) {
            const subsidyDatFile = args.subsidy_witnessgen + ".dat";
            const [ok, path] = isPathExist([
                args.subsidy_witnessgen,
                subsidyDatFile,
                args.subsidy_zkey,
            ]);
            if (!ok) {
                console.error(`Error: ${path} does not exist.`);
                return;
            }
        } else {
            const [ok, path] = isPathExist([
                args.subsidy_wasm,
                args.subsidy_zkey,
            ]);
            if (!ok) {
                console.error(`Error: ${path} does not exist.`);
                return;
            }
        }

        subsidyVk = await extractVk(args.subsidy_zkey);
    }

    // Extract the verifying keys
    const processVk = await extractVk(args.process_zkey);
    const tallyVk = await extractVk(args.tally_zkey);

    // The coordinator's MACI private key
    let serializedPrivkey;
    if (args.prompt_for_maci_privkey) {
        serializedPrivkey = await promptPwd("Your MACI private key");
    } else {
        serializedPrivkey = args.privkey;
    }

    if (!PrivKey.isValidSerializedPrivKey(serializedPrivkey)) {
        console.error("Error: invalid MACI private key");
        return;
    }

    const maciPrivkey = PrivKey.unserialize(serializedPrivkey);
    const coordinatorKeypair = new Keypair(maciPrivkey);

    const contractAddrs = readJSONFile(contractFilepath);
    if ((!contractAddrs || !contractAddrs["MACI"]) && !args.contract) {
        console.error("Error: MACI contract address is empty");
        return;
    }
    const maciAddress = args.contract ? args.contract : contractAddrs["MACI"];

    // MACI contract
    if (!validateEthAddress(maciAddress)) {
        console.error("Error: invalid MACI contract address");
        return;
    }

    const signer = await getDefaultSigner();

    if (!(await contractExists(signer.provider, maciAddress))) {
        console.error(
            "Error: there is no MACI contract deployed at the specified address"
        );
        return;
    }

    const pollId = Number(args.poll_id);

    if (pollId < 0) {
        console.error("Error: the Poll ID should be a positive integer.");
        return;
    }

    const [maciContractAbi] = parseArtifact("MACI");
    const [pollContractAbi] = parseArtifact("Poll");
    const [accQueueContractAbi] = parseArtifact("AccQueue");

    const maciContractEthers = new ethers.Contract(
        maciAddress,
        maciContractAbi,
        signer
    );

    const pollAddr = await maciContractEthers.polls(pollId);
    if (!(await contractExists(signer.provider, pollAddr))) {
        console.error(
            "Error: there is no Poll contract with this poll ID linked to the specified MACI contract."
        );
        return;
    }

    const pollContract = new ethers.Contract(pollAddr, pollContractAbi, signer);

    const extContracts = await pollContract.extContracts();
    const messageAqContractAddr = extContracts.messageAq;

    const messageAqContract = new ethers.Contract(
        messageAqContractAddr,
        accQueueContractAbi,
        signer
    );

    // Check that the state and message trees have been merged for at least the first poll
    if (!(await pollContract.stateAqMerged()) && pollId == 0) {
        console.error(
            "Error: the state tree has not been merged yet. " +
                "Please use the mergeSignups subcommmand to do so."
        );
        return;
    }

    const messageTreeDepth = Number(
        (await pollContract.treeDepths()).messageTreeDepth
    );

    const mainRoot = (
        await messageAqContract.getMainRoot(messageTreeDepth.toString())
    ).toString();

    if (mainRoot === "0") {
        console.error(
            "Error: the message tree has not been merged yet. " +
                "Please use the mergeMessages subcommmand to do so."
        );
        return;
    }

    // Build an off-chain representation of the MACI contract using data in the contract storage

    // some rpc endpoint like bsc chain has limitation to retreive history logs
    let fromBlock = 0;
    const txHash = args.transaction_hash;
    if (txHash) {
        const txn = await signer.provider.getTransaction(txHash);
        fromBlock = txn.blockNumber;
    }
    console.log(`fromBlock = ${fromBlock}`);
    const maciState = await genMaciStateFromContract(
        signer.provider,
        maciAddress,
        coordinatorKeypair,
        pollId,
        fromBlock
    );

    const poll = maciState.polls[pollId];

    // TODO: support resumable proof generation
    const processProofs: any[] = [];
    const tallyProofs: any[] = [];
    const subsidyProofs: any[] = [];

    let startTime = Date.now();
    console.log("Generating proofs of message processing...");
    const messageBatchSize = poll.batchSizes.messageBatchSize;
    const numMessages = poll.messages.length;
    let totalMessageBatches =
        numMessages <= messageBatchSize
            ? 1
            : Math.floor(numMessages / messageBatchSize);

    if (numMessages > messageBatchSize && numMessages % messageBatchSize > 0) {
        totalMessageBatches++;
    }

    while (poll.hasUnprocessedMessages()) {
        const circuitInputs = poll.processMessages(pollId);

        let r;
        try {
            r = await genProof(
                circuitInputs,
                args.process_zkey,
                rapidsnarkExe,
                args.process_witnessgen,
                args.process_wasm
            );
        } catch (e) {
            console.error("Error: could not generate proof.");
            console.error(e);
            return;
        }

        // Verify the proof
        const isValid = await verifyProof(r.publicSignals, r.proof, processVk);

        if (!isValid) {
            console.error("Error: generated an invalid proof");
            return;
        }

        const thisProof = {
            circuitInputs,
            proof: r.proof,
            publicInputs: r.publicSignals,
        };

        processProofs.push(thisProof);

        saveOutput(
            outputDir,
            thisProof,
            `process_${poll.numBatchesProcessed - 1}.json`
        );

        console.log(
            `\nProgress: ${poll.numBatchesProcessed} / ${totalMessageBatches}`
        );
    }

    let endTime = Date.now();
    console.log(
        `----------gen processMessage proof took ${
            (endTime - startTime) / 1000
        } seconds`
    );

    const asHex = (val): string => {
        return "0x" + BigInt(val).toString(16);
    };

    if (args.subsidy_file) {
        startTime = Date.now();
        console.log("\nGenerating proofs of subsidy calculation...");
        const subsidyBatchSize = poll.batchSizes.subsidyBatchSize;
        const numLeaves = poll.stateLeaves.length;
        const totalSubsidyBatches =
            Math.ceil(numLeaves / subsidyBatchSize) ** 2;
        console.log(
            `subsidyBatchSize=${subsidyBatchSize}, numLeaves=${numLeaves}, totalSubsidyBatch=${totalSubsidyBatches}`
        );

        let subsidyCircuitInputs;
        let numBatchesCalced = 0;
        while (poll.hasUnfinishedSubsidyCalculation()) {
            subsidyCircuitInputs = poll.subsidyPerBatch();
            const r = await genProof(
                subsidyCircuitInputs,
                args.subsidy_zkey,
                rapidsnarkExe,
                args.subsidy_witnessgen,
                args.subsidy_wasm
            );

            const isValid = await verifyProof(
                r.publicSignals,
                r.proof,
                subsidyVk
            );
            if (!isValid) {
                console.error("Error: generated an invalid subsidy calc proof");
                return;
            }
            const thisProof = {
                circuitInputs: subsidyCircuitInputs,
                proof: r.proof,
                publicInputs: r.publicSignals,
            };

            subsidyProofs.push(thisProof);
            numBatchesCalced++;
            saveOutput(
                outputDir,
                thisProof,
                `subsidy_${numBatchesCalced - 1}.json`
            );
            console.log(
                `\nProgress: ${numBatchesCalced} / ${totalSubsidyBatches}`
            );
        }

        const subsidyFileData = {
            provider: signer.provider.connection.url,
            maci: maciAddress,
            pollId,
            newSubsidyCommitment: asHex(
                subsidyCircuitInputs.newSubsidyCommitment
            ),
            results: {
                subsidy: poll.subsidy.map((x) => x.toString()),
                salt: asHex(subsidyCircuitInputs.newSubsidySalt),
            },
        };

        fs.writeFileSync(
            args.subsidy_file,
            JSON.stringify(subsidyFileData, null, 4)
        );
        endTime = Date.now();
        console.log(
            `----------gen subsidy proof took ${
                (endTime - startTime) / 1000
            } seconds`
        );
    }

    console.log("\nGenerating proofs of vote tallying...");
    startTime = Date.now();
    const tallyBatchSize = poll.batchSizes.tallyBatchSize;
    const numStateLeaves = poll.stateLeaves.length;
    let totalTallyBatches =
        numStateLeaves <= tallyBatchSize
            ? 1
            : Math.floor(numStateLeaves / tallyBatchSize);
    if (
        numStateLeaves > tallyBatchSize &&
        numStateLeaves % tallyBatchSize > 0
    ) {
        totalTallyBatches++;
    }

    let tallyCircuitInputs;
    while (poll.hasUntalliedBallots()) {
        tallyCircuitInputs = poll.tallyVotes();
        const r = await genProof(
            tallyCircuitInputs,
            args.tally_zkey,
            rapidsnarkExe,
            args.tally_witnessgen,
            args.tally_wasm
        );

        // Verify the proof
        const isValid = await verifyProof(r.publicSignals, r.proof, tallyVk);

        if (!isValid) {
            console.error("Error: generated an invalid proof");
            return;
        }

        const thisProof = {
            circuitInputs: tallyCircuitInputs,
            proof: r.proof,
            publicInputs: r.publicSignals,
        };

        tallyProofs.push(thisProof);

        saveOutput(
            outputDir,
            thisProof,
            `tally_${poll.numBatchesTallied - 1}.json`
        );

        console.log(
            `\nProgress: ${poll.numBatchesTallied} / ${totalTallyBatches}`
        );
    }

    const tallyFileData = {
        provider: signer.provider.connection.url,
        maci: maciAddress,
        pollId,
        newTallyCommitment: asHex(tallyCircuitInputs.newTallyCommitment),
        results: {
            tally: poll.results.map((x) => x.toString()),
            salt: asHex(tallyCircuitInputs.newResultsRootSalt),
        },
        totalSpentVoiceCredits: {
            spent: poll.totalSpentVoiceCredits.toString(),
            salt: asHex(tallyCircuitInputs.newSpentVoiceCreditSubtotalSalt),
        },
        perVOSpentVoiceCredits: {
            tally: poll.perVOSpentVoiceCredits.map((x) => x.toString()),
            salt: asHex(tallyCircuitInputs.newPerVOSpentVoiceCreditsRootSalt),
        },
    };

    // Verify the results
    // Compute newResultsCommitment
    const newResultsCommitment = genTreeCommitment(
        tallyFileData.results.tally.map((x) => BigInt(x)),
        BigInt(tallyFileData.results.salt),
        poll.treeDepths.voteOptionTreeDepth
    );
    // Compute newSpentVoiceCreditsCommitment
    const newSpentVoiceCreditsCommitment = hashLeftRight(
        BigInt(tallyFileData.totalSpentVoiceCredits.spent),
        BigInt(tallyFileData.totalSpentVoiceCredits.salt)
    );

    // Compute newPerVOSpentVoiceCreditsCommitment
    const newPerVOSpentVoiceCreditsCommitment = genTreeCommitment(
        tallyFileData.perVOSpentVoiceCredits.tally.map((x) => BigInt(x)),
        BigInt(tallyFileData.perVOSpentVoiceCredits.salt),
        poll.treeDepths.voteOptionTreeDepth
    );

    // Compute newTallyCommitment
    const newTallyCommitment = hash3([
        newResultsCommitment,
        newSpentVoiceCreditsCommitment,
        newPerVOSpentVoiceCreditsCommitment,
    ]);

    fs.writeFileSync(args.tally_file, JSON.stringify(tallyFileData, null, 4));

    console.log();
    if (
        "0x" + newTallyCommitment.toString(16) ===
        tallyFileData.newTallyCommitment
    ) {
        console.log("OK");
    } else {
        console.error("Error: the newTallyCommitment is invalid.");
    }
    endTime = Date.now();
    console.log(
        `----------gen tally proof took ${(endTime - startTime) / 1000} seconds`
    );

    return;
};

const saveOutput = (outputDir: string, proof: any, filename: string) => {
    fs.writeFileSync(
        path.join(outputDir, filename),
        JSON.stringify(proof, null, 2)
    );
};

export { genProofs, configureSubparser };
