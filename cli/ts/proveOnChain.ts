import * as ethers from "ethers";
import * as fs from "fs";
import * as path from "path";

import { hashLeftRight } from "maci-crypto";
import {
    formatProofForVerifierContract,
    getDefaultSigner,
    parseArtifact,
} from "maci-contracts";

import {
    compareOnChainValue,
    validateEthAddress,
    contractExists,
    delay,
} from "./utils";

import { readJSONFile } from "maci-common";
import { contractFilepath } from "./config";

const configureSubparser = (subparsers: any) => {
    const parser = subparsers.addParser("proveOnChain", { addHelp: true });

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

    parser.addArgument(["-q", "--mp"], {
        type: "string",
        help: "The MessageProcessor contract address",
    });

    parser.addArgument(["-t", "--tally"], {
        type: "string",
        help: "The Tally contract address",
    });

    parser.addArgument(["-s", "--subsidy"], {
        type: "string",
        help: "The Subsidy contract address",
    });
    parser.addArgument(["-f", "--proof-dir"], {
        required: true,
        type: "string",
        help: "The proof output directory from the genProofs subcommand",
    });
};

const proveOnChain = async (args: any) => {
    const signer = await getDefaultSigner();
    const pollId = Number(args.poll_id);

    // check existence of contract addresses
    const contractAddrs = readJSONFile(contractFilepath);
    if ((!contractAddrs || !contractAddrs["MACI"]) && !args.contract) {
        console.error("Error: MACI contract address is empty");
        return;
    }
    if (
        (!contractAddrs || !contractAddrs["MessageProcessor-" + pollId]) &&
        !args.mp
    ) {
        console.error("Error: MessageProcessor contract address is empty");
        return;
    }
    if ((!contractAddrs || !contractAddrs["Tally-" + pollId]) && !args.tally) {
        console.error("Error: Tally contract address is empty");
        return;
    }
    if (
        (!contractAddrs || !contractAddrs["Subsidy-" + pollId]) &&
        !args.subsidy
    ) {
        console.error("Error: Subsidy contract address is empty");
        return;
    }

    const maciAddress = args.contract ? args.contract : contractAddrs["MACI"];
    const mpAddress = args.mp
        ? args.mp
        : contractAddrs["MessageProcessor-" + pollId];
    const tallyAddress = args.tally
        ? args.tally
        : contractAddrs["Tally-" + pollId];
    const subsidyAddress = args.subsidy
        ? args.subsidy
        : contractAddrs["Subsidy-" + pollId];

    // MACI contract
    if (!validateEthAddress(maciAddress)) {
        console.error("Error: invalid MACI contract address");
        return;
    }

    // MessageProcessor contract
    if (!validateEthAddress(mpAddress)) {
        console.error("Error: invalid MessageProcessor contract address");
        return;
    }

    if (!(await contractExists(signer.provider, mpAddress))) {
        console.error(
            "Error: there is no contract deployed at the specified address"
        );
        return;
    }

    if (!validateEthAddress(tallyAddress)) {
        console.error("Error: invalid Tally contract address");
        return;
    }
    if (!validateEthAddress(subsidyAddress)) {
        console.error("Error: invalid Subsidy contract address");
        return;
    }

    const [maciContractAbi] = parseArtifact("MACI");
    const [pollContractAbi] = parseArtifact("Poll");
    const [mpContractAbi] = parseArtifact("MessageProcessor");
    const [tallyContractAbi] = parseArtifact("Tally");
    const [subsidyContractAbi] = parseArtifact("Subsidy");
    const [messageAqContractAbi] = parseArtifact("AccQueue");
    const [vkRegistryContractAbi] = parseArtifact("VkRegistry");
    const [verifierContractAbi] = parseArtifact("Verifier");

    const maciContract = new ethers.Contract(
        maciAddress,
        maciContractAbi,
        signer
    );

    const pollAddr = await maciContract.polls(pollId);
    if (!(await contractExists(signer.provider, pollAddr))) {
        console.error(
            "Error: there is no Poll contract with this poll ID linked to the specified MACI contract."
        );
        return;
    }

    const pollContract = new ethers.Contract(pollAddr, pollContractAbi, signer);

    const mpContract = new ethers.Contract(mpAddress, mpContractAbi, signer);

    const tallyContract = new ethers.Contract(
        tallyAddress,
        tallyContractAbi,
        signer
    );

    const subsidyContract = new ethers.Contract(
        subsidyAddress,
        subsidyContractAbi,
        signer
    );

    const messageAqContract = new ethers.Contract(
        (await pollContract.extContracts()).messageAq,
        messageAqContractAbi,
        signer
    );

    const vkRegistryContract = new ethers.Contract(
        (await pollContract.extContracts()).vkRegistry,
        vkRegistryContractAbi,
        signer
    );

    const verifierContractAddress = await mpContract.verifier();
    const verifierContract = new ethers.Contract(
        verifierContractAddress,
        verifierContractAbi,
        signer
    );

    let data = {
        processProofs: {},
        tallyProofs: {},
        subsidyProofs: {},
    };

    let numProcessProofs = 0;

    if (typeof args.proof_file === "object" && args.proof_file !== null) {
        // Argument is a javascript object
        data = args.proof_file;
    } else {
        // Read the proof directory
        const filenames = fs.readdirSync(args.proof_dir);
        for (let i = 0; i < filenames.length; i++) {
            const filename = filenames[i];
            const filepath = path.join(args.proof_dir, filename);
            let match = filename.match(/process_(\d+)/);
            if (match != null) {
                data.processProofs[Number(match[1])] = JSON.parse(
                    fs.readFileSync(filepath).toString()
                );
                numProcessProofs++;
                continue;
            }

            match = filename.match(/tally_(\d+)/);
            if (match != null) {
                data.tallyProofs[Number(match[1])] = JSON.parse(
                    fs.readFileSync(filepath).toString()
                );
                continue;
            }
            match = filename.match(/subsidy_(\d+)/);
            if (match != null) {
                data.subsidyProofs[Number(match[1])] = JSON.parse(
                    fs.readFileSync(filepath).toString()
                );
                continue;
            }
        }
    }

    const numSignUpsAndMessages = await pollContract.numSignUpsAndMessages();
    const numSignUps = Number(numSignUpsAndMessages[0]);
    const numMessages = Number(numSignUpsAndMessages[1]);
    const batchSizes = await pollContract.batchSizes();
    const messageBatchSize = Number(batchSizes.messageBatchSize);
    const tallyBatchSize = Number(batchSizes.tallyBatchSize);
    const subsidyBatchSize = Number(batchSizes.subsidyBatchSize);
    let totalMessageBatches =
        numMessages <= messageBatchSize
            ? 1
            : Math.floor(numMessages / messageBatchSize);

    if (numMessages > messageBatchSize && numMessages % messageBatchSize > 0) {
        totalMessageBatches++;
    }

    if (numProcessProofs !== totalMessageBatches) {
        console.error(
            `Error: ${args.proof_file} does not have the correct ` +
                `number of message processing proofs ` +
                `(expected ${totalMessageBatches}, got ${numProcessProofs}.`
        );
    }

    const treeDepths = await pollContract.treeDepths();

    let numBatchesProcessed = Number(await mpContract.numBatchesProcessed());
    const messageRootOnChain = await messageAqContract.getMainRoot(
        Number(treeDepths.messageTreeDepth)
    );

    const stateTreeDepth = Number(await maciContract.stateTreeDepth());
    const onChainProcessVk = await vkRegistryContract.getProcessVk(
        stateTreeDepth,
        treeDepths.messageTreeDepth,
        treeDepths.voteOptionTreeDepth,
        messageBatchSize
    );

    const dd = await pollContract.getDeployTimeAndDuration();
    const pollEndTimestampOnChain = BigInt(dd[0]) + BigInt(dd[1]);

    if (numBatchesProcessed < totalMessageBatches) {
        console.log("Submitting proofs of message processing...");
    }

    for (let i = numBatchesProcessed; i < totalMessageBatches; i++) {
        //const currentMessageBatchIndex = Number(await pptContract.currentMessageBatchIndex())
        let currentMessageBatchIndex;
        if (numBatchesProcessed === 0) {
            const r = numMessages % messageBatchSize;
            if (r === 0) {
                currentMessageBatchIndex =
                    Math.floor(numMessages / messageBatchSize) *
                    messageBatchSize;
            } else {
                currentMessageBatchIndex = numMessages;
            }

            if (currentMessageBatchIndex > 0) {
                if (r === 0) {
                    currentMessageBatchIndex -= messageBatchSize;
                } else {
                    currentMessageBatchIndex -= r;
                }
            }
        } else {
            currentMessageBatchIndex =
                (totalMessageBatches - numBatchesProcessed) * messageBatchSize;
        }

        if (numBatchesProcessed > 0 && currentMessageBatchIndex > 0) {
            currentMessageBatchIndex -= messageBatchSize;
        }

        const { proof, circuitInputs, publicInputs } = data.processProofs[i];

        // Perform checks
        if (
            !compareOnChainValue(
                "pollEndTimestamp",
                pollEndTimestampOnChain.toString(),
                circuitInputs.pollEndTimestamp
            )
        ) {
            return;
        }
        if (
            !compareOnChainValue(
                "message root",
                messageRootOnChain.toString(),
                BigInt(circuitInputs.msgRoot).toString()
            )
        ) {
            return;
        }

        let currentSbCommitmentOnChain;

        if (numBatchesProcessed === 0) {
            currentSbCommitmentOnChain = BigInt(
                await pollContract.currentSbCommitment()
            );
        } else {
            currentSbCommitmentOnChain = BigInt(
                await mpContract.sbCommitment()
            );
        }

        if (
            !compareOnChainValue(
                "currentSbCommitment",
                currentSbCommitmentOnChain.toString(),
                circuitInputs.currentSbCommitment
            )
        ) {
            return;
        }

        const coordPubKeyHashOnChain = BigInt(
            await pollContract.coordinatorPubKeyHash()
        );
        const coordPubKeyHashOffChain = hashLeftRight(
            BigInt(circuitInputs.coordPubKey[0]),
            BigInt(circuitInputs.coordPubKey[1])
        ).toString();

        if (
            !compareOnChainValue(
                "coordPubKey",
                coordPubKeyHashOnChain.toString(),
                coordPubKeyHashOffChain
            )
        ) {
            return;
        }

        const packedValsOnChain = BigInt(
            await mpContract.genProcessMessagesPackedVals(
                pollContract.address,
                currentMessageBatchIndex,
                numSignUps
            )
        ).toString();

        if (
            !compareOnChainValue(
                "packedVals",
                packedValsOnChain,
                circuitInputs.packedVals
            )
        ) {
            return;
        }

        const formattedProof = formatProofForVerifierContract(proof);

        const publicInputHashOnChain = BigInt(
            await mpContract.genProcessMessagesPublicInputHash(
                pollContract.address,
                currentMessageBatchIndex,
                messageRootOnChain.toString(),
                numSignUps,
                circuitInputs.currentSbCommitment,
                circuitInputs.newSbCommitment
            )
        );

        if (
            !compareOnChainValue(
                "Public input",
                publicInputHashOnChain.toString(),
                publicInputs[0].toString()
            )
        ) {
            return;
        }

        const isValidOnChain = await verifierContract.verify(
            formattedProof,
            onChainProcessVk,
            publicInputHashOnChain.toString()
        );

        if (!isValidOnChain) {
            console.error(
                "Error: the verifier contract found the proof invalid."
            );
            return;
        }

        const txErr = "Error: processMessages() failed";
        let tx;
        try {
            tx = await mpContract.processMessages(
                pollContract.address,
                "0x" + BigInt(circuitInputs.newSbCommitment).toString(16),
                formattedProof
            );
        } catch (e) {
            console.error(txErr);
            console.error(e);
        }

        const receipt = await tx.wait();

        if (receipt.status !== 1) {
            console.error(txErr);
            return;
        }

        console.log(`Transaction hash: ${tx.hash}`);

        // Wait for the node to catch up
        numBatchesProcessed = Number(await mpContract.numBatchesProcessed());
        let backOff = 1000;
        let numAttempts = 0;
        while (numBatchesProcessed !== i + 1) {
            await delay(backOff);
            backOff *= 1.2;
            numAttempts++;
            if (numAttempts >= 100) {
                break;
            }
        }
        console.log(
            `Progress: ${numBatchesProcessed} / ${totalMessageBatches}`
        );
    }

    if (numBatchesProcessed === totalMessageBatches) {
        console.log("All message processing proofs have been submitted.");
    }

    // ------------------------------------------------------------------------
    // subsidy calculation proofs
    if (Object.keys(data.subsidyProofs).length !== 0) {
        let rbi = Number(await subsidyContract.rbi());
        let cbi = Number(await subsidyContract.cbi());
        const numLeaves = numSignUps + 1;
        const num1DBatches = Math.ceil(numLeaves / subsidyBatchSize);
        let subsidyBatchNum = rbi * num1DBatches + cbi;
        const totalBatchNum = (num1DBatches * (num1DBatches + 1)) / 2;
        console.log(
            `number of subsidy batch processed: ${subsidyBatchNum}, numleaf=${numLeaves}`
        );

        for (let i = subsidyBatchNum; i < totalBatchNum; i++) {
            if (i == 0) {
                await subsidyContract.updateSbCommitment(mpContract.address);
            }
            const { proof, circuitInputs, publicInputs } =
                data.subsidyProofs[i];

            const subsidyCommitmentOnChain =
                await subsidyContract.subsidyCommitment();
            if (
                !compareOnChainValue(
                    "subsidycommitment",
                    subsidyCommitmentOnChain.toString(),
                    circuitInputs.currentSubsidyCommitment
                )
            ) {
                return;
            }
            const packedValsOnChain = BigInt(
                await subsidyContract.genSubsidyPackedVals(numSignUps)
            );
            if (
                !compareOnChainValue(
                    "subsidy packedVals",
                    packedValsOnChain.toString(),
                    circuitInputs.packedVals
                )
            ) {
                return;
            }
            const currentSbCommitmentOnChain =
                await subsidyContract.sbCommitment();
            if (
                !compareOnChainValue(
                    "currentSbCommitment",
                    currentSbCommitmentOnChain.toString(),
                    circuitInputs.sbCommitment
                )
            ) {
                return;
            }
            const publicInputHashOnChain =
                await subsidyContract.genSubsidyPublicInputHash(
                    numSignUps,
                    circuitInputs.newSubsidyCommitment
                );

            if (
                !compareOnChainValue(
                    "public input",
                    publicInputHashOnChain.toString(),
                    publicInputs[0]
                )
            ) {
                return;
            }

            const txErr = "Error: updateSubsidy() failed...";
            const formattedProof = formatProofForVerifierContract(proof);
            let tx;
            try {
                tx = await subsidyContract.updateSubsidy(
                    pollContract.address,
                    mpContract.address,
                    circuitInputs.newSubsidyCommitment,
                    formattedProof
                );
            } catch (e) {
                console.error(txErr);
                console.error(e);
            }

            const receipt = await tx.wait();

            if (receipt.status !== 1) {
                console.error(txErr);
                return;
            }

            console.log(`Progress: ${subsidyBatchNum + 1} / ${totalBatchNum}`);
            console.log(`Transaction hash: ${tx.hash}`);

            // Wait for the node to catch up
            const nrbi = Number(await subsidyContract.rbi());
            const ncbi = Number(await subsidyContract.cbi());
            let backOff = 1000;
            let numAttempts = 0;
            while (nrbi === rbi && ncbi === cbi) {
                await delay(backOff);
                backOff *= 1.2;
                numAttempts++;
                if (numAttempts >= 100) {
                    break;
                }
            }

            rbi = nrbi;
            cbi = ncbi;
            subsidyBatchNum = rbi * num1DBatches + cbi;
        }

        if (subsidyBatchNum === totalBatchNum) {
            console.log("All subsidy calculation proofs have been submitted.");
            console.log();
            console.log("OK");
        }
    }

    // ------------------------------------------------------------------------
    // Vote tallying proofs
    const totalTallyBatches =
        numSignUps < tallyBatchSize
            ? 1
            : Math.floor(numSignUps / tallyBatchSize) + 1;

    let tallyBatchNum = Number(await tallyContract.tallyBatchNum());

    console.log();
    if (tallyBatchNum < totalTallyBatches) {
        console.log("Submitting proofs of vote tallying...");
    }

    for (let i = tallyBatchNum; i < totalTallyBatches; i++) {
        if (i == 0) {
            await tallyContract.updateSbCommitment(mpContract.address);
        }

        const batchStartIndex = i * tallyBatchSize;

        const txErr = "Error: tallyVotes() failed";
        const { proof, circuitInputs, publicInputs } = data.tallyProofs[i];

        const currentTallyCommitmentOnChain =
            await tallyContract.tallyCommitment();

        if (
            !compareOnChainValue(
                "currentTallyCommitment",
                currentTallyCommitmentOnChain.toString(),
                circuitInputs.currentTallyCommitment
            )
        ) {
            return;
        }

        const packedValsOnChain = BigInt(
            await tallyContract.genTallyVotesPackedVals(
                numSignUps,
                batchStartIndex,
                tallyBatchSize
            )
        );

        if (
            !compareOnChainValue(
                "packedVals",
                packedValsOnChain.toString(),
                circuitInputs.packedVals
            )
        ) {
            return;
        }

        const currentSbCommitmentOnChain = await mpContract.sbCommitment();

        if (
            !compareOnChainValue(
                "currentSbCommitment",
                currentSbCommitmentOnChain.toString(),
                circuitInputs.sbCommitment
            )
        ) {
            return;
        }

        const publicInputHashOnChain =
            await tallyContract.genTallyVotesPublicInputHash(
                numSignUps,
                batchStartIndex,
                tallyBatchSize,
                circuitInputs.newTallyCommitment
            );

        if (
            !compareOnChainValue(
                "public input",
                publicInputHashOnChain.toString(),
                publicInputs[0]
            )
        ) {
            return;
        }

        const formattedProof = formatProofForVerifierContract(proof);
        let tx;
        try {
            tx = await tallyContract.tallyVotes(
                pollContract.address,
                mpContract.address,
                "0x" + BigInt(circuitInputs.newTallyCommitment).toString(16),
                formattedProof
            );
        } catch (e) {
            console.error(txErr);
            console.error(e);
        }

        const receipt = await tx.wait();

        if (receipt.status !== 1) {
            console.error(txErr);
            return;
        }

        console.log(`Progress: ${tallyBatchNum + 1} / ${totalTallyBatches}`);
        console.log(`Transaction hash: ${tx.hash}`);

        // Wait for the node to catch up
        tallyBatchNum = Number(await tallyContract.tallyBatchNum());
        let backOff = 1000;
        let numAttempts = 0;
        while (tallyBatchNum !== i + 1) {
            await delay(backOff);
            backOff *= 1.2;
            numAttempts++;
            if (numAttempts >= 100) {
                break;
            }
        }
    }

    if (tallyBatchNum === totalTallyBatches) {
        console.log("All vote tallying proofs have been submitted.");
        console.log();
        console.log("OK");
    }

    return;
};

export { proveOnChain, configureSubparser };
