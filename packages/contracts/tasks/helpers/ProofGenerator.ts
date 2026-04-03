import { type TCircuitInputs, type IJsonMaciState, MaciState, type Poll, EMode } from "@maci-protocol/core";
import { generateTreeCommitment, hash3, hashLeftRight } from "@maci-protocol/crypto";

import fs from "fs";
import path from "path";

import type {
  ICircuitFiles,
  IGenerateProofsOptions,
  IPrepareStateParams,
  IProofGeneratorParams,
  TallyData,
  type ProofGenerationSalts,
  type PollSaltsData,
} from "./types";
import type { Proof } from "../../ts/types";
import type { IVerifyingKeyObjectParams } from "@maci-protocol/domainobjs";
import type { BigNumberish } from "ethers";

import { logMagenta, info, logGreen, success } from "../../ts/logger";
import { extractVerifyingKey, generateProofSnarkjs, generateProofRapidSnark, verifyProof } from "../../ts/proofs";
import { asHex, cleanThreads } from "../../ts/utils";

import { saveSalts, loadSalts, saltsExist } from "./saltStorage";

/**
 * Proof generator class for message processing and tally.
 */
export class ProofGenerator {
  /**
   * Current poll
   */
  private poll: Poll;

  /**
   * MACI contract address
   */
  private maciContractAddress: string;

  /**
   * Tally contract address
   */
  private tallyContractAddress: string;

  /**
   * The directory to store the proofs
   */
  private outputDir: string;

  /**
   * The file to store the tally proof
   */
  private tallyOutputFile: string;

  /**
   * Message processing circuit files
   */
  private messageProcessor: ICircuitFiles;

  /**
   * Tally circuit files
   */
  private tally: ICircuitFiles;

  /**
   * Voting mode
   */
  private mode: EMode;

  /**
   * Path to the rapidsnark binary
   */
  private rapidsnark?: string;

  /**
   * to use incremental proof generation, resuming from existing salts
   */
  private incremental: boolean;

  /**
   * poll ID used to load and save salts for incremental generation
   */
  private pollId: string;

  /**
   * Get maci state from local file or from contract
   *
   * @param {IPrepareStateParams} params - params to prepare maci state
   * @returns {MaciState} maci state
   */
  static async prepareState({
    maciContract,
    pollContract,
    pollId,
    maciPrivateKey,
    coordinatorKeypair,
    signer,
    ipfsMessageBackupFiles,
    outputDir,
    options: { transactionHash, stateFile, startBlock, endBlock, blocksPerBatch },
  }: IPrepareStateParams): Promise<MaciState> {
    const isOutputDirExists = fs.existsSync(path.resolve(outputDir));

    if (!isOutputDirExists) {
      await fs.promises.mkdir(path.resolve(outputDir));
    }

    if (stateFile) {
      const content = await fs.promises
        .readFile(stateFile)
        .then((res) => JSON.parse(res.toString()) as unknown as IJsonMaciState);
      const serializedPrivateKey = maciPrivateKey.serialize();

      const maciState = MaciState.fromJSON(content);

      maciState.polls.forEach((poll) => {
        poll.setCoordinatorKeypair(serializedPrivateKey);
      });

      return maciState;
    }

    // build an off-chain representation of the MACI contract using data in the contract storage
    const [defaultStartBlockSignup, defaultStartBlockPoll, stateRoot, totalSignups] = await Promise.all([
      maciContract.queryFilter(maciContract.filters.SignUp(), startBlock).then((events) => events[0]?.blockNumber ?? 0),
      maciContract
        .queryFilter(maciContract.filters.DeployPoll(), startBlock)
        .then((events) => events[0]?.blockNumber ?? 0),
      maciContract.getStateTreeRoot(),
      pollContract.totalSignups(),
    ]);
    const defaultStartBlock = Math.min(defaultStartBlockPoll, defaultStartBlockSignup);
    let fromBlock = startBlock ? Number(startBlock) : defaultStartBlock;

    const defaultEndBlock = await Promise.all([
      pollContract
        .queryFilter(pollContract.filters.MergeState(stateRoot, totalSignups), fromBlock)
        .then((events) => events[events.length - 1]?.blockNumber),
    ]).then((blocks) => Math.max(...blocks));

    if (transactionHash) {
      const tx = await signer.provider!.getTransaction(transactionHash);
      fromBlock = tx?.blockNumber ?? defaultStartBlock;
    }

    logMagenta({ text: info(`Starting to fetch logs from block ${fromBlock}`) });

    const maciContractAddress = await maciContract.getAddress();

    return import("../../ts/generateMaciState").then(({ generateMaciStateFromContract }) =>
      generateMaciStateFromContract({
        provider: signer.provider!,
        address: maciContractAddress,
        coordinatorKeypair,
        pollId: BigInt(pollId),
        fromBlock,
        blocksPerRequest: blocksPerBatch,
        endBlock: endBlock || defaultEndBlock,
        ipfsMessageBackupFiles,
      }),
    );
  }

  /**
   * Initialize class properties
   *
   * @param {IProofGeneratorParams} params - initialization params
   */
  constructor({
    poll,
    messageProcessor,
    tally,
    rapidsnark,
    maciContractAddress,
    tallyContractAddress,
    outputDir,
    tallyOutputFile,
    mode,
    incremental,
    pollId,
  }: IProofGeneratorParams) {
    this.poll = poll;
    this.maciContractAddress = maciContractAddress;
    this.tallyContractAddress = tallyContractAddress;
    this.outputDir = outputDir;
    this.tallyOutputFile = tallyOutputFile;
    this.messageProcessor = messageProcessor;
    this.tally = tally;
    this.rapidsnark = rapidsnark;
    this.mode = mode;
    this.incremental = incremental ?? false;
    this.pollId = pollId;
  }

  /**
   * Generate message processing proofs
   *
   * @returns message processing proofs
   */
  async generateMpProofs(options?: IGenerateProofsOptions): Promise<Proof[]> {
    logMagenta({ text: info(`Generating proofs of message processing...`) });
    performance.mark("messageProcessor-proofs-start");

    const { messageBatchSize } = this.poll.batchSizes;
    const numMessages = this.poll.messages.length;
    let totalMessageBatches = numMessages <= messageBatchSize ? 1 : Math.floor(numMessages / messageBatchSize);

    if (numMessages > messageBatchSize && numMessages % messageBatchSize > 0) {
      totalMessageBatches += 1;
    }

    try {
      const inputs: TCircuitInputs[] = [];
      const proofs: Proof[] = [];

      // while we have unprocessed messages, process them
      while (this.poll.hasUnprocessedMessages()) {
        // process messages in batches
        const circuitInputs = this.poll.processMessages(BigInt(this.poll.pollId)) as unknown as TCircuitInputs;

        // generate the proof for this batch
        inputs.push(circuitInputs);

        logMagenta({ text: info(`Progress: ${this.poll.totalBatchesProcessed} / ${totalMessageBatches}`) });
      }

      logMagenta({ text: info("Wait until proof generation is finished") });

      const messageProcessorZkey = await extractVerifyingKey(this.messageProcessor.zkey, false);

      for (let index = 0; index < inputs.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        const data = await this.generateProofs(
          inputs[index],
          this.messageProcessor,
          `process_${index}.json`,
          messageProcessorZkey,
        ).then((result) => {
          options?.onBatchComplete?.({ current: index, total: totalMessageBatches, proofs: result });
          return result;
        });

        proofs.push(...data);
      }

      logGreen({ text: success("Proof generation is finished") });

      // cleanup threads
      await cleanThreads();

      performance.mark("messageProcessor-proofs-end");
      performance.measure(
        "Generate message processor proofs",
        "messageProcessor-proofs-start",
        "messageProcessor-proofs-end",
      );

      options?.onComplete?.(proofs);

      return proofs;
    } catch (error) {
      options?.onFail?.(error as Error);

      throw error;
    }
  }

  /**
   * Generate tally proofs
   *
   * @param networkName - current network name
   * @param chainId - current chain id
   * @returns tally proofs
   */
  async generateTallyProofs(
    networkName: string,
    chainId?: string,
    options?: IGenerateProofsOptions,
  ): Promise<{ proofs: Proof[]; tallyData: TallyData }> {
    logMagenta({ text: info(`Generating proofs of vote tallying...`) });
    performance.mark("tally-proofs-start");

    const { tallyBatchSize } = this.poll.batchSizes;
    const numStateLeaves = this.poll.pollStateLeaves.length;
    let totalTallyBatches = numStateLeaves <= tallyBatchSize ? 1 : Math.floor(numStateLeaves / tallyBatchSize);

    if (numStateLeaves > tallyBatchSize && numStateLeaves % tallyBatchSize > 0) {
      totalTallyBatches += 1;
    }

    try {
      let existingSalts: PollSaltsData | null = null;

      // Check for existing salts in incremental mode
      if (this.incremental) {
        existingSalts = loadSalts(this.pollId);

        if (existingSalts) {
          logGreen({
            text: info(`Resuming incremental proof generation (${existingSalts.tallyProofSalts.length} batches found)`),
          });
        } else {
          logMagenta({ text: info("No existing salts found, starting fresh") });
        }
      } else if (saltsExist(this.pollId)) {
        logMagenta({
          text: info(
            `Existing salts detected for poll ${this.pollId}, Use --incremental to resume or delete .maci-salts to start fresh.`,
          ),
        });
        throw new Error(
          `Existing salts detected for poll ${this.pollId}. Use --incremental to resume or delete .maci-salts directory to start fresh.`,
        );
      }

      const pollSaltsData: PollSaltsData = {
        pollId: this.pollId,
        tallyProofSalts: existingSalts?.tallyProofSalts || [],
      };

      let tallyCircuitInputs: TCircuitInputs;
      const inputs: TCircuitInputs[] = [];
      const proofs: Proof[] = [];

      let batchIndex = 0;
      while (this.poll.hasUntalliedBallots()) {
        let batchSalts: ProofGenerationSalts | undefined;

        // Use existing salts if available for this batch
        if (existingSalts && existingSalts.tallyProofSalts[batchIndex]) {
          batchSalts = existingSalts.tallyProofSalts[batchIndex];
        }

        // Generate or retrieve tally for this batch
        tallyCircuitInputs = this.poll.tallyVotes(
          batchSalts
            ? {
                newResultsRootSalt: BigInt(batchSalts.newResultsRootSalt),
                newSpentVoiceCreditSubtotalSalt: BigInt(batchSalts.newSpentVoiceCreditSubtotalSalt),
                newPerVoteOptionSpentVoiceCreditsRootSalt: BigInt(batchSalts.newPerVoteOptionSpentVoiceCreditsRootSalt),
              }
            : undefined,
        ) as unknown as TCircuitInputs;

        // Save the salts immediately after generation (if new)
        if (!batchSalts) {
          // Cast to access the salts property we added
          const circuitInputsWithSalts = tallyCircuitInputs as TCircuitInputs & {
            salts?: {
              newResultsRootSalt: bigint;
              newPerVoteOptionSpentVoiceCreditsRootSalt: bigint;
              newSpentVoiceCreditSubtotalSalt: bigint;
            };
          };

          if (circuitInputsWithSalts.salts) {
            batchSalts = {
              newResultsRootSalt: circuitInputsWithSalts.salts.newResultsRootSalt.toString(),
              newSpentVoiceCreditSubtotalSalt: circuitInputsWithSalts.salts.newSpentVoiceCreditSubtotalSalt.toString(),
              newPerVoteOptionSpentVoiceCreditsRootSalt:
                circuitInputsWithSalts.salts.newPerVoteOptionSpentVoiceCreditsRootSalt.toString(),
              tallyBatchNumber: batchIndex,
              timestamp: Date.now(),
            };

            pollSaltsData.tallyProofSalts[batchIndex] = batchSalts;

            // Save after each batch to ensure persistence
            saveSalts(this.pollId, pollSaltsData);
          }
        }

        inputs.push(tallyCircuitInputs);

        logMagenta({ text: info(`Progress: ${this.poll.numBatchesTallied} / ${totalTallyBatches}`) });
        batchIndex += 1;
      }

      logMagenta({ text: info("Wait until proof generation is finished") });

      const tallyVerifyingKey = await extractVerifyingKey(this.tally.zkey, false);

      for (let index = 0; index < inputs.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        const data = await this.generateProofs(
          inputs[index],
          this.tally,
          `tally_${index}.json`,
          tallyVerifyingKey,
        ).then((result) => {
          options?.onBatchComplete?.({ current: index, total: totalTallyBatches, proofs: result });
          return result;
        });

        proofs.push(...data);
      }

      logGreen({ text: success("Proof generation is finished") });

      // cleanup threads
      await cleanThreads();

      // verify the results
      // Compute newResultsCommitment
      const newResultsCommitment = generateTreeCommitment(
        this.poll.tallyResult,
        BigInt(asHex(tallyCircuitInputs!.newResultsRootSalt as BigNumberish)),
        this.poll.treeDepths.voteOptionTreeDepth,
      );

      // compute newSpentVoiceCreditsCommitment
      const newSpentVoiceCreditsCommitment = hashLeftRight(
        this.poll.totalSpentVoiceCredits,
        BigInt(asHex(tallyCircuitInputs!.newSpentVoiceCreditSubtotalSalt as BigNumberish)),
      );

      let newTallyCommitment: bigint;

      // create the tally file data to store for verification later
      const tallyFileData: TallyData = {
        maci: this.maciContractAddress,
        pollId: this.poll.pollId.toString(),
        network: networkName,
        chainId,
        mode: this.mode,
        tallyAddress: this.tallyContractAddress,
        newTallyCommitment: asHex(tallyCircuitInputs!.newTallyCommitment as BigNumberish),
        results: {
          tally: this.poll.tallyResult.map((x) => x.toString()),
          salt: asHex(tallyCircuitInputs!.newResultsRootSalt as BigNumberish),
          commitment: asHex(newResultsCommitment),
        },
        totalSpentVoiceCredits: {
          spent: this.poll.totalSpentVoiceCredits.toString(),
          salt: asHex(tallyCircuitInputs!.newSpentVoiceCreditSubtotalSalt as BigNumberish),
          commitment: asHex(newSpentVoiceCreditsCommitment),
        },
      };

      if (this.mode === EMode.QV) {
        // Compute newPerVoteOptionSpentVoiceCreditsCommitment
        const newPerVoteOptionSpentVoiceCreditsCommitment = generateTreeCommitment(
          this.poll.perVoteOptionSpentVoiceCredits,
          BigInt(asHex(tallyCircuitInputs!.newPerVoteOptionSpentVoiceCreditsRootSalt as BigNumberish)),
          this.poll.treeDepths.voteOptionTreeDepth,
        );

        // update perVoteOptionSpentVoiceCredits in the tally file data
        tallyFileData.perVoteOptionSpentVoiceCredits = {
          tally: this.poll.perVoteOptionSpentVoiceCredits.map((x) => x.toString()),
          salt: asHex(tallyCircuitInputs!.newPerVoteOptionSpentVoiceCreditsRootSalt as BigNumberish),
          commitment: asHex(newPerVoteOptionSpentVoiceCreditsCommitment),
        };

        // Compute newTallyCommitment
        newTallyCommitment = hash3([
          newResultsCommitment,
          newSpentVoiceCreditsCommitment,
          newPerVoteOptionSpentVoiceCreditsCommitment,
        ]);
      } else {
        newTallyCommitment = hashLeftRight(newResultsCommitment, newSpentVoiceCreditsCommitment);
      }

      await fs.promises.writeFile(this.tallyOutputFile, JSON.stringify(tallyFileData, null, 4));

      logGreen({ text: success(`Tally file:\n${JSON.stringify(tallyFileData, null, 4)}\n`) });

      // compare the commitments
      if (asHex(newTallyCommitment) === tallyFileData.newTallyCommitment) {
        logGreen({ text: success("The tally commitment is correct") });
      } else {
        throw new Error("Error: the newTallyCommitment is invalid.");
      }

      performance.mark("tally-proofs-end");
      performance.measure("Generate tally proofs", "tally-proofs-start", "tally-proofs-end");

      options?.onComplete?.(proofs, tallyFileData);

      return { proofs, tallyData: tallyFileData };
    } catch (error) {
      options?.onFail?.(error as Error);

      throw error;
    }
  }

  /**
   * Generic function for proofs generation
   *
   * @param {TCircuitInputs} circuitInputs - circuit inputs
   * @param {ICircuitFiles} circuitFiles - circuit files (zkey, witnessGenerator, wasm)
   * @param outputFile - output file
   * @returns proofs
   */
  private async generateProofs(
    circuitInputs: TCircuitInputs,
    circuitFiles: ICircuitFiles,
    outputFile: string,
    verifyingKey: IVerifyingKeyObjectParams,
  ): Promise<Proof[]> {
    const proofs: Proof[] = [];

    const { proof, publicSignals } = circuitFiles.wasm
      ? await generateProofSnarkjs({
          inputs: circuitInputs,
          zkeyPath: circuitFiles.zkey,
          silent: true,
          wasmPath: circuitFiles.wasm,
        })
      : await generateProofRapidSnark({
          inputs: circuitInputs,
          zkeyPath: circuitFiles.zkey,
          rapidsnarkExePath: this.rapidsnark,
          witnessExePath: circuitFiles.witnessGenerator,
        });

    // verify it
    // eslint-disable-next-line no-await-in-loop
    const isValid = await verifyProof(publicSignals, proof, verifyingKey, false);

    if (!isValid) {
      throw new Error("Error: generated an invalid proof");
    }

    proofs.push({
      circuitInputs,
      proof,
      publicInputs: publicSignals,
    });

    await fs.promises.writeFile(
      path.resolve(this.outputDir, outputFile),
      JSON.stringify(proofs[proofs.length - 1], null, 4),
    );

    return proofs;
  }
}
