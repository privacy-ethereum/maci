import { type ContractTransactionReceipt } from "ethers";
import { extractVk, genProof, verifyProof } from "maci-circuits";
import { formatProofForVerifierContract, genSignUpTree, IGenSignUpTree } from "maci-contracts";
import { MACI__factory as MACIFactory, Poll__factory as PollFactory } from "maci-contracts/typechain-types";
import { CircuitInputs, IJsonMaciState, MaciState, IPollJoiningCircuitInputs } from "maci-core";
import { poseidon, sha256Hash, stringifyBigInts } from "maci-crypto";
import { IVkObjectParams, Keypair, PrivKey, PubKey, StateLeaf } from "maci-domainobjs";

import assert from "assert";
import fs from "fs";

import type { IJoinPollArgs, IJoinedUserArgs, IParsePollJoinEventsArgs, IJoinPollData } from "../utils";

import { contractExists, logError, logYellow, info, logGreen, success, BLOCKS_STEP } from "../utils";
import { banner } from "../utils/banner";

/**
 * Get state index and credit balance
 * either from command line or
 * from maci state leaves or from sign up leaves
 * @param stateIndex State index from the command
 * @param newVoiceCreditBalance Credit balance from the command
 * @param stateLeaves State leaves from maci state or sign up tree
 * @param userMaciPubKey Public key of the maci user
 * @returns State index and credit balance
 */
const getStateIndexAndCreditBalance = (
  stateIndex: bigint | null,
  newVoiceCreditBalance: bigint | null,
  stateLeaves: StateLeaf[],
  userMaciPubKey: PubKey,
) => {
  let loadedStateIndex = stateIndex;
  let loadedCreditBalance = newVoiceCreditBalance;

  if (!stateIndex) {
    const index = stateLeaves.findIndex((leaf) => leaf.pubKey.equals(userMaciPubKey));
    if (index > 0) {
      loadedStateIndex = BigInt(index);
    } else {
      logError("State leaf not found");
      process.exit();
    }
  }
  if (!newVoiceCreditBalance) {
    const balance = stateLeaves[Number(loadedStateIndex!)].voiceCreditBalance;
    if (balance) {
      loadedCreditBalance = balance;
    } else {
      logError("Voice credit balance not found");
      process.exit();
    }
  }

  return [loadedStateIndex, loadedCreditBalance];
};

/**
 * Generate and verify poll proof
 * @param inputs - the inputs to the circuit
 * @param zkeyPath - the path to the zkey
 * @param useWasm - whether we want to use the wasm witness or not
 * @param rapidsnarkExePath - the path to the rapidnsark binary
 * @param witnessExePath - the path to the compiled witness binary
 * @param wasmPath - the path to the wasm witness
 * @param pollVk - Poll verifying key
 * @returns proof - an array of strings
 */
const generateAndVerifyProof = async (
  inputs: CircuitInputs,
  zkeyPath: string,
  useWasm: boolean | undefined,
  rapidsnarkExePath: string | undefined,
  witnessExePath: string | undefined,
  wasmPath: string | undefined,
  pollVk: IVkObjectParams,
) => {
  const r = await genProof({
    inputs,
    zkeyPath,
    useWasm,
    rapidsnarkExePath,
    witnessExePath,
    wasmPath,
  });

  // verify it
  const isValid = await verifyProof(r.publicSignals, r.proof, pollVk);
  if (!isValid) {
    throw new Error("Generated an invalid proof");
  }

  return formatProofForVerifierContract(r.proof);
};

/**
 * Create circuit input for pollJoining
 * @param signUpData Sign up tree and state leaves
 * @param stateTreeDepth Maci state tree depth
 * @param maciPrivKey User's private key for signing up
 * @param stateLeafIndex Index where the user is stored in the state leaves
 * @param credits Credits for voting
 * @param pollPrivKey Poll's private key for the poll joining
 * @param pollPubKey Poll's public key for the poll joining
 * @returns stringified circuit inputs
 */
const joiningCircuitInputs = (
  signUpData: IGenSignUpTree,
  stateTreeDepth: bigint,
  maciPrivKey: PrivKey,
  stateLeafIndex: bigint,
  credits: bigint,
  pollPrivKey: PrivKey,
  pollPubKey: PubKey,
): IPollJoiningCircuitInputs => {
  // Get the state leaf on the index position
  const { signUpTree: stateTree, stateLeaves } = signUpData;
  const stateLeaf = stateLeaves[Number(stateLeafIndex)];
  const { pubKey, voiceCreditBalance, timestamp } = stateLeaf;
  const pubKeyX = pubKey.asArray()[0];
  const pubKeyY = pubKey.asArray()[1];
  const stateLeafArray = [pubKeyX, pubKeyY, voiceCreditBalance, timestamp];
  const pollPubKeyArray = pollPubKey.asArray();

  assert(credits <= voiceCreditBalance, "Credits must be lower than signed up credits");

  // calculate the path elements for the state tree given the original state tree
  const { siblings, index } = stateTree.generateProof(Number(stateLeafIndex));
  const siblingsLength = siblings.length;

  // The index must be converted to a list of indices, 1 for each tree level.
  // The circuit tree depth is this.stateTreeDepth, so the number of siblings must be this.stateTreeDepth,
  // even if the tree depth is actually 3. The missing siblings can be set to 0, as they
  // won't be used to calculate the root in the circuit.
  const indices: bigint[] = [];

  for (let i = 0; i < stateTreeDepth; i += 1) {
    // eslint-disable-next-line no-bitwise
    indices.push(BigInt((index >> i) & 1));

    if (i >= siblingsLength) {
      siblings[i] = BigInt(0);
    }
  }

  const siblingsArray = siblings.map((sibling) => [sibling]);

  // Create nullifier from private key
  const inputNullifier = BigInt(maciPrivKey.asCircuitInputs());
  const nullifier = poseidon([inputNullifier]);

  // Get pll state tree's root
  const stateRoot = stateTree.root;

  // Set actualStateTreeDepth as number of initial siblings length
  const actualStateTreeDepth = BigInt(siblingsLength);

  // Calculate public input hash from nullifier, credits and current root
  const inputHash = sha256Hash([nullifier, credits, stateRoot, pollPubKeyArray[0], pollPubKeyArray[1]]);

  const circuitInputs = {
    privKey: maciPrivKey.asCircuitInputs(),
    pollPrivKey: pollPrivKey.asCircuitInputs(),
    pollPubKey: pollPubKey.asCircuitInputs(),
    stateLeaf: stateLeafArray,
    siblings: siblingsArray,
    indices,
    nullifier,
    credits,
    stateRoot,
    actualStateTreeDepth,
    inputHash,
  };

  return stringifyBigInts(circuitInputs) as unknown as IPollJoiningCircuitInputs;
};

/**
 * Join Poll user to the Poll contract
 * @param {IJoinPollArgs} args - The arguments for the join poll command
 * @returns {IJoinPollData} The poll state index of the joined user and transaction hash
 */
export const joinPoll = async ({
  maciAddress,
  privateKey,
  pollPrivKey,
  stateIndex,
  newVoiceCreditBalance,
  stateFile,
  pollId,
  signer,
  startBlock,
  endBlock,
  blocksPerBatch,
  transactionHash,
  pollJoiningZkey,
  useWasm,
  rapidsnark,
  pollWitgen,
  pollWasm,
  quiet = true,
}: IJoinPollArgs): Promise<IJoinPollData> => {
  banner(quiet);

  if (!(await contractExists(signer.provider!, maciAddress))) {
    logError("MACI contract does not exist");
  }

  if (!PrivKey.isValidSerializedPrivKey(privateKey)) {
    logError("Invalid MACI private key");
  }

  const userMaciPrivKey = PrivKey.deserialize(privateKey);
  const userMaciPubKey = new Keypair(userMaciPrivKey).pubKey;
  const nullifier = poseidon([BigInt(userMaciPrivKey.asCircuitInputs())]);

  // Create poll public key from poll private key
  const pollPrivKeyDeserialized = PrivKey.deserialize(pollPrivKey);
  const pollKeyPair = new Keypair(pollPrivKeyDeserialized);
  const pollPubKey = pollKeyPair.pubKey;

  if (pollId < 0) {
    logError("Invalid poll id");
  }

  const maciContract = MACIFactory.connect(maciAddress, signer);
  const pollAddress = await maciContract.getPoll(pollId);

  if (!(await contractExists(signer.provider!, pollAddress))) {
    logError("Poll contract does not exist");
  }

  const pollContract = PollFactory.connect(pollAddress, signer);

  let loadedStateIndex: bigint | null;
  let loadedCreditBalance: bigint | null;
  let maciState: MaciState | undefined;
  let signUpData: IGenSignUpTree | undefined;
  let currentStateRootIndex: number;
  let circuitInputs: CircuitInputs;
  if (stateFile) {
    try {
      const file = await fs.promises.readFile(stateFile);
      const content = JSON.parse(file.toString()) as unknown as IJsonMaciState;
      maciState = MaciState.fromJSON(content);
    } catch (error) {
      logError((error as Error).message);
    }
    const poll = maciState!.polls.get(pollId)!;

    if (poll.hasJoined(nullifier)) {
      throw new Error("User the given nullifier has already joined");
    }

    [loadedStateIndex, loadedCreditBalance] = getStateIndexAndCreditBalance(
      stateIndex,
      newVoiceCreditBalance,
      maciState!.stateLeaves,
      userMaciPubKey,
    );

    // check < 1 cause index zero is a blank state leaf
    if (loadedStateIndex! < 1) {
      logError("Invalid state index");
    }

    currentStateRootIndex = poll.maciStateRef.numSignUps - 1;

    poll.updatePoll(BigInt(maciState!.stateLeaves.length));

    circuitInputs = poll.joiningCircuitInputs({
      maciPrivKey: userMaciPrivKey,
      stateLeafIndex: loadedStateIndex!,
      credits: loadedCreditBalance!,
      pollPrivKey: pollPrivKeyDeserialized,
      pollPubKey,
    }) as unknown as CircuitInputs;
  } else {
    // build an off-chain representation of the MACI contract using data in the contract storage
    const [defaultStartBlockSignup, defaultStartBlockPoll, stateTreeDepth, numSignups] = await Promise.all([
      maciContract.queryFilter(maciContract.filters.SignUp(), startBlock).then((events) => events[0]?.blockNumber ?? 0),
      maciContract
        .queryFilter(maciContract.filters.DeployPoll(), startBlock)
        .then((events) => events[0]?.blockNumber ?? 0),
      maciContract.stateTreeDepth(),
      maciContract.numSignUps(),
    ]);
    const defaultStartBlock = Math.min(defaultStartBlockPoll, defaultStartBlockSignup);
    let fromBlock = startBlock ? Number(startBlock) : defaultStartBlock;

    if (transactionHash) {
      const tx = await signer.provider!.getTransaction(transactionHash);
      fromBlock = tx?.blockNumber ?? defaultStartBlock;
    }

    logYellow(quiet, info(`starting to fetch logs from block ${fromBlock}`));

    signUpData = await genSignUpTree({
      provider: signer.provider!,
      address: await maciContract.getAddress(),
      blocksPerRequest: blocksPerBatch || 50,
      fromBlock,
      endBlock,
      sleepAmount: 0,
    });

    currentStateRootIndex = Number(numSignups) - 1;

    [loadedStateIndex, loadedCreditBalance] = getStateIndexAndCreditBalance(
      stateIndex,
      newVoiceCreditBalance,
      signUpData.stateLeaves,
      userMaciPubKey,
    );

    // check < 1 cause index zero is a blank state leaf
    if (loadedStateIndex! < 1) {
      logError("Invalid state index");
    }

    circuitInputs = joiningCircuitInputs(
      signUpData,
      stateTreeDepth,
      userMaciPrivKey,
      loadedStateIndex!,
      loadedCreditBalance!,
      pollPrivKeyDeserialized,
      pollPubKey,
    ) as unknown as CircuitInputs;
  }

  const pollVk = await extractVk(pollJoiningZkey);

  let pollStateIndex = "";
  let receipt: ContractTransactionReceipt | null = null;

  try {
    // generate the proof for this batch
    const proof = await generateAndVerifyProof(
      circuitInputs,
      pollJoiningZkey,
      useWasm,
      rapidsnark,
      pollWitgen,
      pollWasm,
      pollVk,
    );

    // submit the message onchain as well as the encryption public key
    const tx = await pollContract.joinPoll(
      nullifier,
      pollPubKey.asContractParam(),
      loadedCreditBalance!,
      currentStateRootIndex,
      proof,
    );
    receipt = await tx.wait();
    logYellow(quiet, info(`Transaction hash: ${receipt!.hash}`));

    if (receipt?.status !== 1) {
      logError("Transaction failed");
    }

    const iface = pollContract.interface;

    // get state index from the event
    if (receipt?.logs) {
      const [log] = receipt.logs;
      const { args } = iface.parseLog(log as unknown as { topics: string[]; data: string }) || { args: [] };
      [, , , , , pollStateIndex] = args;
      logGreen(quiet, success(`State index: ${pollStateIndex.toString()}`));
    } else {
      logError("Unable to retrieve the transaction receipt");
    }
  } catch (error) {
    logError((error as Error).message);
  }

  return {
    pollStateIndex: pollStateIndex ? pollStateIndex.toString() : "",
    hash: receipt!.hash,
  };
};

/**
 * Parse the poll joining events from the Poll contract
 */
const parsePollJoinEvents = async ({
  pollContract,
  startBlock,
  currentBlock,
  pollPublicKey,
}: IParsePollJoinEventsArgs) => {
  // 1000 blocks at a time
  for (let block = startBlock; block <= currentBlock; block += BLOCKS_STEP) {
    const toBlock = Math.min(block + BLOCKS_STEP - 1, currentBlock);
    const pubKey = pollPublicKey.asArray();
    // eslint-disable-next-line no-await-in-loop
    const newEvents = await pollContract.queryFilter(
      pollContract.filters.PollJoined(pubKey[0], pubKey[1], undefined, undefined, undefined, undefined),
      block,
      toBlock,
    );

    if (newEvents.length > 0) {
      const [event] = newEvents;

      return {
        pollStateIndex: event.args[5].toString(),
        voiceCredits: event.args[2].toString(),
      };
    }
  }

  return {
    pollStateIndex: undefined,
    voiceCredits: undefined,
  };
};

/**
 * Checks if user is joined with the public key
 * @param {IJoinedUserArgs} - The arguments for the join check command
 * @returns user joined or not and poll state index, voice credit balance
 */
export const isJoinedUser = async ({
  maciAddress,
  pollId,
  pollPubKey,
  signer,
  startBlock,
  quiet = true,
}: IJoinedUserArgs): Promise<{ isJoined: boolean; pollStateIndex?: string; voiceCredits?: string }> => {
  banner(quiet);

  const maciContract = MACIFactory.connect(maciAddress, signer);
  const pollAddress = await maciContract.getPoll(pollId);
  const pollContract = PollFactory.connect(pollAddress, signer);

  const pollPublicKey = PubKey.deserialize(pollPubKey);
  const startBlockNumber = startBlock || 0;
  const currentBlock = await signer.provider!.getBlockNumber();

  const { pollStateIndex, voiceCredits } = await parsePollJoinEvents({
    pollContract,
    startBlock: startBlockNumber,
    currentBlock,
    pollPublicKey,
  });

  logGreen(
    quiet,
    success(`Poll state index: ${pollStateIndex?.toString()}, registered: ${pollStateIndex !== undefined}`),
  );

  return {
    isJoined: pollStateIndex !== undefined,
    pollStateIndex,
    voiceCredits,
  };
};
