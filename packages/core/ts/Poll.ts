import {
  IncrementalQuinTree,
  generateRandomSalt,
  SNARK_FIELD_SIZE,
  NOTHING_UP_MY_SLEEVE,
  hashLeftRight,
  hash3,
  hash5,
  stringifyBigInts,
  generateTreeCommitment,
  hash2,
  poseidon,
  hashLeanIMT,
} from "@maci-protocol/crypto";
import {
  VoteCommand,
  Keypair,
  Ballot,
  PublicKey,
  PrivateKey,
  Message,
  StateLeaf,
  VoteCounts,
  blankStateLeaf,
  blankStateLeafHash,
  padKey,
  type IMessageContractParams,
} from "@maci-protocol/domainobjs";
import { LeanIMT, type LeanIMTHashFunction } from "@zk-kit/lean-imt";
import omit from "lodash/omit";

import assert from "assert";

import type { MaciState } from "./MaciState";
import type {
  TCircuitInputs,
  ITreeDepths,
  IBatchSizes,
  IPoll,
  IJsonPoll,
  IProcessMessagesOutput,
  IVoteTallyCircuitInputs,
  IProcessMessagesCircuitInputs,
  IPollJoiningCircuitInputs,
  IJoiningCircuitArgs,
  IGetVoiceCreditsLeft,
  IJoinedCircuitArgs,
  IPollJoinedCircuitInputs,
} from "./utils/types";
import type { PathElements } from "@maci-protocol/crypto";

import { EMode, STATE_TREE_ARITY, VOTE_OPTION_TREE_ARITY } from "./utils/constants";
import { ProcessMessageErrors, ProcessMessageError } from "./utils/errors";

/**
 * A representation of the Poll contract.
 */
export class Poll implements IPoll {
  // Note that we only store the PublicKey on-chain while this class stores the
  // Keypair for the sake of convenience
  coordinatorKeypair: Keypair;

  treeDepths: ITreeDepths;

  batchSizes: IBatchSizes;

  voteOptions: bigint;

  maxVoteOptions: number;

  // the actual depth of the state tree (can be <= stateTreeDepth)
  actualStateTreeDepth: number;

  pollEndTimestamp: bigint;

  ballots: Ballot[] = [];

  ballotTree?: IncrementalQuinTree;

  voteCounts: VoteCounts[] = [];

  voteCountsTree?: IncrementalQuinTree;

  messages: Message[] = [];

  commands: VoteCommand[] = [];

  encryptionPublicKeys: PublicKey[] = [];

  stateCopied = false;

  publicKeys: PublicKey[] = [padKey];

  stateTree?: LeanIMT;

  // For message processing
  totalBatchesProcessed = 0;

  currentMessageBatchIndex: number;

  maciStateRef: MaciState;

  pollId: bigint;

  sbSalts: Record<number | string, bigint> = {};

  resultRootSalts: Record<number | string, bigint> = {};

  perVoteOptionSpentVoiceCreditsRootSalts: Record<number | string, bigint> = {};

  spentVoiceCreditSubtotalSalts: Record<number | string, bigint> = {};

  // For vote tallying
  tallyResult: bigint[] = [];

  perVoteOptionSpentVoiceCredits: bigint[] = [];

  numBatchesTallied = 0;

  totalSpentVoiceCredits = 0n;

  // an empty ballot and its hash to be used as zero value in the ballot tree
  emptyBallot: Ballot;

  emptyBallotHash: bigint;

  // an empty vote counts and its hash to be used as zero value in the vote counts tree
  emptyVoteCounts: VoteCounts;

  emptyVoteCountsHash: bigint;

  // message chain hash
  chainHash = NOTHING_UP_MY_SLEEVE;

  // batch chain hashes
  batchHashes = [NOTHING_UP_MY_SLEEVE];

  // Poll state tree leaves
  pollStateLeaves: StateLeaf[] = [blankStateLeaf];

  // Poll state tree
  pollStateTree?: IncrementalQuinTree;

  // Poll voting nullifier
  pollNullifiers: Map<bigint, boolean>;

  private mode: EMode;

  // how many users signed up
  private totalSignups = 0n;

  /**
   * Constructs a new Poll object.
   * @param pollEndTimestamp - The Unix timestamp at which the poll ends.
   * @param coordinatorKeypair - The keypair of the coordinator.
   * @param treeDepths - The depths of the trees used in the poll.
   * @param batchSizes - The sizes of the batches used in the poll.
   * @param maciStateRef - The reference to the MACI state.
   * @param pollId - The poll id
   */
  constructor(
    pollEndTimestamp: bigint,
    coordinatorKeypair: Keypair,
    treeDepths: ITreeDepths,
    batchSizes: IBatchSizes,
    maciStateRef: MaciState,
    voteOptions: bigint,
    mode: EMode,
  ) {
    if (voteOptions > VOTE_OPTION_TREE_ARITY ** treeDepths.voteOptionTreeDepth) {
      throw new Error("Vote options cannot be greater than the number of leaves in the vote option tree");
    }

    this.pollEndTimestamp = pollEndTimestamp;
    this.coordinatorKeypair = coordinatorKeypair;
    this.treeDepths = treeDepths;
    this.batchSizes = batchSizes;
    this.voteOptions = voteOptions;
    this.maxVoteOptions = VOTE_OPTION_TREE_ARITY ** treeDepths.voteOptionTreeDepth;
    this.maciStateRef = maciStateRef;
    this.pollId = BigInt(maciStateRef.polls.size);
    this.actualStateTreeDepth = treeDepths.stateTreeDepth;
    this.currentMessageBatchIndex = 0;
    this.mode = mode;

    this.pollNullifiers = new Map<bigint, boolean>();

    this.tallyResult = new Array(this.maxVoteOptions).fill(0n) as bigint[];
    this.perVoteOptionSpentVoiceCredits = new Array(this.maxVoteOptions).fill(0n) as bigint[];

    // we put a blank state leaf to prevent a DoS attack
    this.emptyBallot = Ballot.generateBlank(this.maxVoteOptions, treeDepths.voteOptionTreeDepth);
    this.ballots.push(this.emptyBallot);
    this.emptyBallotHash = this.emptyBallot.hash();

    this.emptyVoteCounts = VoteCounts.generateBlank(this.maxVoteOptions, treeDepths.voteOptionTreeDepth);
    this.voteCounts.push(this.emptyVoteCounts);
    this.emptyVoteCountsHash = this.emptyVoteCounts.hash();
  }

  /**
   * Check if user has already joined the poll by checking if the nullifier is registered
   */
  hasJoined = (nullifier: bigint): boolean => this.pollNullifiers.get(nullifier) != null;

  /**
   * Join the anonymous user to the Poll (to the tree)
   * @param nullifier - Hashed private key used as nullifier
   * @param publicKey - The poll public key.
   * @param newVoiceCreditBalance - New voice credit balance of the user.
   * @returns The index of added state leaf
   */
  joinPoll = (nullifier: bigint, publicKey: PublicKey, newVoiceCreditBalance: bigint): number => {
    const stateLeaf = new StateLeaf(publicKey, newVoiceCreditBalance);

    if (this.hasJoined(nullifier)) {
      throw new Error("UserAlreadyJoined");
    }

    this.pollNullifiers.set(nullifier, true);
    this.pollStateLeaves.push(stateLeaf.copy());
    this.pollStateTree?.insert(stateLeaf.hash());

    return this.pollStateLeaves.length - 1;
  };

  /**
   * Update a Poll with data from MaciState.
   * This is the step where we copy the state from the MaciState instance,
   * and set the number of signups we have so far.
   * @note It should be called to generate the state for poll joining with totalSignups set as
   * the number of signups in the MaciState. For message processing, you should set totalSignups as
   * the number of users who joined the poll.
   */
  updatePoll = (totalSignups: bigint): void => {
    // there might be occasions where we fetch logs after new signups have been made
    // logs are fetched (and MaciState/Poll created locally).
    // If someone signs up after that and we fetch that record
    // then we won't be able to verify the processing on chain as the data will
    // not match. For this, we must only copy up to the number of signups

    // Copy the state tree, ballot tree, state leaves, and ballot leaves

    // start by setting the number of signups
    this.setTotalSignups(totalSignups);
    // copy up to totalSignups state leaves
    this.publicKeys = this.maciStateRef.publicKeys.slice(0, Number(this.totalSignups)).map((x) => x.copy());
    // ensure we have the correct actual state tree depth value
    this.actualStateTreeDepth = Math.max(1, Math.ceil(Math.log2(Number(this.totalSignups))));

    this.stateTree = new LeanIMT(hashLeanIMT as LeanIMTHashFunction);

    // add all leaves
    this.publicKeys.forEach((publicKey) => {
      this.stateTree?.insert(publicKey.hash());
    });

    // create a poll state tree
    this.pollStateTree = new IncrementalQuinTree(
      this.actualStateTreeDepth,
      blankStateLeafHash,
      STATE_TREE_ARITY,
      hash2,
    );

    this.pollStateLeaves.forEach((stateLeaf) => {
      this.pollStateTree?.insert(stateLeaf.hash());
    });

    // Create as many ballots as state leaves
    this.ballotTree = new IncrementalQuinTree(
      Number(this.treeDepths.stateTreeDepth),
      this.emptyBallotHash,
      STATE_TREE_ARITY,
      hash2,
    );
    this.ballotTree.insert(this.emptyBallotHash);

    // we fill the ballotTree with empty ballots hashes to match the number of signups in the tree
    while (this.ballots.length < this.publicKeys.length) {
      this.ballotTree.insert(this.emptyBallotHash);
      this.ballots.push(this.emptyBallot);
    }

    this.voteCountsTree = new IncrementalQuinTree(
      Number(this.treeDepths.stateTreeDepth),
      this.emptyVoteCountsHash,
      STATE_TREE_ARITY,
      hash2,
    );
    this.voteCountsTree.insert(this.emptyVoteCountsHash);
    const emptyVoteCounts = VoteCounts.generateBlank(this.maxVoteOptions, this.treeDepths.voteOptionTreeDepth);

    while (this.voteCounts.length < this.publicKeys.length) {
      this.voteCountsTree.insert(this.emptyVoteCountsHash);
      this.voteCounts.push(emptyVoteCounts);
    }

    this.stateCopied = true;
  };

  /**
   * Process one message.
   * @param message - The message to process.
   * @param encryptionPublicKey - The public key associated with the encryption private key.
   * @returns A number of variables which will be used in the zk-SNARK circuit.
   */
  processMessage = (message: Message, encryptionPublicKey: PublicKey): IProcessMessagesOutput => {
    try {
      // Decrypt the message
      const sharedKey = Keypair.generateEcdhSharedKey(this.coordinatorKeypair.privateKey, encryptionPublicKey);

      const { command, signature } = VoteCommand.decrypt(message, sharedKey);

      const stateLeafIndex = command.stateIndex;

      // If the state tree index in the command is invalid, do nothing
      if (
        stateLeafIndex >= BigInt(this.ballots.length) ||
        stateLeafIndex < 1n ||
        stateLeafIndex >= BigInt(this.pollStateTree?.nextIndex || -1)
      ) {
        throw new ProcessMessageError(ProcessMessageErrors.InvalidStateLeafIndex);
      }

      // The user to update (or not)
      const stateLeaf = this.pollStateLeaves[Number(stateLeafIndex)];

      // The ballot to update (or not)
      const ballot = this.ballots[Number(stateLeafIndex)];

      // If the signature is invalid, do nothing
      if (!command.verifySignature(signature, stateLeaf.publicKey)) {
        throw new ProcessMessageError(ProcessMessageErrors.InvalidSignature);
      }

      // If the nonce is invalid, do nothing
      if (command.nonce !== ballot.nonce + 1n) {
        throw new ProcessMessageError(ProcessMessageErrors.InvalidNonce);
      }

      // If the vote option index is invalid, do nothing
      if (command.voteOptionIndex < 0n || command.voteOptionIndex >= BigInt(this.voteOptions)) {
        throw new ProcessMessageError(ProcessMessageErrors.InvalidVoteOptionIndex);
      }

      const voteOptionIndex = Number(command.voteOptionIndex);
      const originalVoteWeight = ballot.votes[voteOptionIndex];

      const voiceCreditsLeft = this.getVoiceCreditsLeft({
        stateLeaf,
        originalVoteWeight,
        newVoteWeight: command.newVoteWeight,
        mode: this.mode,
      });

      // If the remaining voice credits is insufficient, do nothing
      if (voiceCreditsLeft < 0n) {
        throw new ProcessMessageError(ProcessMessageErrors.InsufficientVoiceCredits);
      }

      // If there are some voice credits left for full credits mode, do nothing
      if (this.mode === EMode.FULL && voiceCreditsLeft > 0n) {
        throw new ProcessMessageError(ProcessMessageErrors.InvalidVoiceCredits);
      }

      // Deep-copy the state leaf and update its attributes
      const newStateLeaf = stateLeaf.copy();
      newStateLeaf.voiceCreditBalance = voiceCreditsLeft;
      // if the key changes, this is effectively a key-change message too
      newStateLeaf.publicKey = command.newPublicKey.copy();

      // Deep-copy the ballot and update its attributes
      const newBallot = ballot.copy();
      // increase the nonce
      newBallot.nonce += 1n;
      // we change the vote for this exact vote option
      newBallot.votes[voteOptionIndex] = command.newVoteWeight;

      if (this.mode === EMode.FULL) {
        newBallot.votes = newBallot.votes.map((votes, index) => (voteOptionIndex === index ? votes : 0n));
      }

      // calculate the path elements for the state tree given the original state tree (before any changes)
      // changes could effectively be made by this new vote - either a key change or vote change
      // would result in a different state leaf
      const { pathElements: originalStateLeafPathElements } = this.pollStateTree!.generateProof(Number(stateLeafIndex));
      // calculate the path elements for the ballot tree given the original ballot tree (before any changes)
      // changes could effectively be made by this new ballot
      const { pathElements: originalBallotPathElements } = this.ballotTree!.generateProof(Number(stateLeafIndex));

      // create a new quinary tree where we insert the votes of the origin (up until this message is processed) ballot
      const voteTree = new IncrementalQuinTree(this.treeDepths.voteOptionTreeDepth, 0n, VOTE_OPTION_TREE_ARITY, hash5);

      for (let i = 0; i < this.ballots[0].votes.length; i += 1) {
        voteTree.insert(ballot.votes[i]);
      }
      // calculate the path elements for the vote option tree given the original vote option tree (before any changes)
      const { pathElements: originalVoteWeightsPathElements } = voteTree.generateProof(voteOptionIndex);
      // we return the data which is then to be used in the processMessage circuit
      // to generate a proof of processing
      return {
        stateLeafIndex: Number(stateLeafIndex),
        newStateLeaf,
        originalStateLeaf: stateLeaf.copy(),
        originalStateLeafPathElements,
        originalVoteWeight,
        originalVoteWeightsPathElements,
        newBallot,
        originalBallot: ballot.copy(),
        originalBallotPathElements,
        command,
      };
    } catch (e) {
      if (e instanceof ProcessMessageError) {
        throw e;
      } else {
        throw new ProcessMessageError(ProcessMessageErrors.FailedDecryption);
      }
    }
  };

  /**
   * Get voice credits left for the voting command.
   *
   * @param args - arguments for getting voice credits
   * @returns voice credits left
   */
  getVoiceCreditsLeft({ stateLeaf, originalVoteWeight, newVoteWeight, mode }: IGetVoiceCreditsLeft): bigint {
    switch (mode) {
      case EMode.QV: {
        // the voice credits left are:
        // voiceCreditsBalance (how many the user has) +
        // voiceCreditsPreviouslySpent (the original vote weight for this option) ** 2 -
        // command.newVoteWeight ** 2 (the new vote weight squared)
        // basically we are replacing the previous vote weight for this
        // particular vote option with the new one
        // but we need to ensure that we are not going >= balance
        return stateLeaf.voiceCreditBalance + originalVoteWeight * originalVoteWeight - newVoteWeight * newVoteWeight;
      }

      case EMode.NON_QV:
      case EMode.FULL: {
        // for non quadratic voting, we simply remove the exponentiation
        // for full credits voting, it will be zero
        return stateLeaf.voiceCreditBalance + originalVoteWeight - newVoteWeight;
      }

      default: {
        throw new Error("Voting mode is not supported");
      }
    }
  }

  /**
   * Inserts a Message and the corresponding public key used to generate the
   * ECDH shared key which was used to encrypt said message.
   * @param message - The message to insert
   * @param encryptionPublicKey - The public key used to encrypt the message
   */
  publishMessage = (message: Message, encryptionPublicKey: PublicKey): void => {
    assert(
      encryptionPublicKey.raw[0] < SNARK_FIELD_SIZE && encryptionPublicKey.raw[1] < SNARK_FIELD_SIZE,
      "The public key is not in the correct range",
    );

    message.data.forEach((d) => {
      assert(d < SNARK_FIELD_SIZE, "The message data is not in the correct range");
    });

    // store the encryption public key
    this.encryptionPublicKeys.push(encryptionPublicKey);
    // store the message locally
    this.messages.push(message);
    // add the message hash to the message tree
    const messageHash = message.hash(encryptionPublicKey);
    // update chain hash
    this.updateChainHash(messageHash);

    // Decrypt the message and store the Command
    // step 1. we generate the shared key
    const sharedKey = Keypair.generateEcdhSharedKey(this.coordinatorKeypair.privateKey, encryptionPublicKey);
    try {
      // step 2. we decrypt it
      const { command } = VoteCommand.decrypt(message, sharedKey);
      // step 3. we store it in the commands array
      this.commands.push(command);
    } catch (e) {
      // if there is an error we store an empty command
      const keypair = new Keypair();
      const command = new VoteCommand(0n, keypair.publicKey, 0n, 0n, 0n, 0n, 0n);
      this.commands.push(command);
    }
  };

  /**
   * Updates message chain hash
   * @param messageHash hash of message with encryptionPublicKey
   */
  updateChainHash = (messageHash: bigint): void => {
    this.chainHash = hash2([this.chainHash, messageHash]);

    if (this.messages.length % this.batchSizes.messageBatchSize === 0) {
      this.batchHashes.push(this.chainHash);
      this.currentMessageBatchIndex += 1;
    }
  };

  /**
   * Create circuit input for pollJoining
   * @param args Poll joining circuit inputs
   * @returns stringified circuit inputs
   */
  joiningCircuitInputs = ({
    maciPrivateKey,
    stateLeafIndex,
    pollPublicKey,
  }: IJoiningCircuitArgs): IPollJoiningCircuitInputs => {
    // calculate the path elements for the state tree given the original state tree
    const { siblings, index } = this.stateTree!.generateProof(Number(stateLeafIndex));
    const siblingsLength = siblings.length;

    for (let i = 0; i < this.treeDepths.stateTreeDepth; i += 1) {
      if (i >= siblingsLength) {
        siblings[i] = BigInt(0);
      }
    }
    const siblingsArray = siblings.map((sibling) => [sibling]);

    // Create nullifier from private key
    const inputNullifier = BigInt(maciPrivateKey.asCircuitInputs());
    const nullifier = poseidon([inputNullifier, this.pollId]);

    // Get state tree's root
    const stateRoot = this.stateTree!.root;

    // Set actualStateTreeDepth as number of initial siblings length
    const actualStateTreeDepth = BigInt(siblingsLength);

    const circuitInputs = {
      privateKey: maciPrivateKey.asCircuitInputs(),
      pollPublicKey: pollPublicKey.asCircuitInputs(),
      siblings: siblingsArray,
      index: BigInt(index),
      nullifier,
      stateRoot,
      actualStateTreeDepth,
      pollId: this.pollId,
    };

    return stringifyBigInts(circuitInputs) as unknown as IPollJoiningCircuitInputs;
  };

  /**
   * Create circuit input for pollJoined
   * @param args Poll joined circuit inputs
   * @returns stringified circuit inputs
   */
  joinedCircuitInputs = ({
    maciPrivateKey,
    stateLeafIndex,
    voiceCreditsBalance,
  }: IJoinedCircuitArgs): IPollJoinedCircuitInputs => {
    // calculate the path elements for the state tree given the original state tree
    const { root: stateRoot, pathElements, pathIndices } = this.pollStateTree!.generateProof(Number(stateLeafIndex));

    const elementsLength = pathIndices.length;

    for (let i = 0; i < this.treeDepths.stateTreeDepth; i += 1) {
      if (i >= elementsLength) {
        pathElements[i] = [0n];
      }
    }

    const circuitInputs = {
      privateKey: maciPrivateKey.asCircuitInputs(),
      pathElements: pathElements.map((item) => item.toString()),
      voiceCreditsBalance: voiceCreditsBalance.toString(),
      index: BigInt(stateLeafIndex),
      actualStateTreeDepth: BigInt(this.actualStateTreeDepth),
      stateRoot,
    };

    return stringifyBigInts(circuitInputs) as unknown as IPollJoinedCircuitInputs;
  };

  /**
   * Pad last unclosed batch
   */
  padLastBatch = (): void => {
    if (this.messages.length % this.batchSizes.messageBatchSize !== 0) {
      this.batchHashes.push(this.chainHash);
    }
  };

  /**
   * This method checks if there are any unprocessed messages in the Poll instance.
   * @returns Returns true if the number of processed batches is
   * less than the total number of batches, false otherwise.
   */
  hasUnprocessedMessages = (): boolean => {
    const batchSize = this.batchSizes.messageBatchSize;

    let totalBatches = this.messages.length <= batchSize ? 1 : Math.floor(this.messages.length / batchSize);

    if (this.messages.length > batchSize && this.messages.length % batchSize > 0) {
      totalBatches += 1;
    }

    return this.totalBatchesProcessed < totalBatches;
  };

  /**
   * Process _batchSize messages starting from the saved index. This
   * function will process messages even if the number of messages is not an
   * exact multiple of _batchSize. e.g. if there are 10 messages, index is
   * 8, and _batchSize is 4, this function will only process the last two
   * messages in this.messages, and finally update the zeroth state leaf.
   * Note that this function will only process as many state leaves as there
   * are ballots to prevent accidental inclusion of a new user after this
   * poll has concluded.
   * @param pollId The ID of the poll associated with the messages to
   *        process
   * @param quiet - Whether to log errors or not
   * @returns stringified circuit inputs
   */
  processMessages = (pollId: bigint, quiet = true): IProcessMessagesCircuitInputs => {
    assert(this.hasUnprocessedMessages(), "No more messages to process");

    const batchSize = this.batchSizes.messageBatchSize;

    if (this.totalBatchesProcessed === 0) {
      // Prevent other polls from being processed until this poll has
      // been fully processed
      this.maciStateRef.pollBeingProcessed = true;
      this.maciStateRef.currentPollBeingProcessed = pollId;

      this.padLastBatch();

      this.currentMessageBatchIndex = this.batchHashes.length - 1;

      this.sbSalts[this.currentMessageBatchIndex] = 0n;
    }

    // Only allow one poll to be processed at a time
    if (this.maciStateRef.pollBeingProcessed) {
      assert(this.maciStateRef.currentPollBeingProcessed === pollId, "Another poll is currently being processed");
    }

    // The starting index must be valid
    assert(this.currentMessageBatchIndex >= 0, "The starting index must be >= 0");

    // ensure we copy the state from MACI when we start processing the
    // first batch
    if (!this.stateCopied) {
      throw new Error("You must update the poll with the correct data first");
    }

    // Generate circuit inputs
    const circuitInputs = stringifyBigInts(
      this.generateProcessMessagesCircuitInputsPartial(this.currentMessageBatchIndex),
    ) as TCircuitInputs;

    // we want to store the state leaves at this point in time
    // and the path elements of the state tree
    const currentStateLeaves: StateLeaf[] = [];
    const currentStateLeavesPathElements: PathElements[] = [];

    // we want to store the ballots at this point in time
    // and the path elements of the ballot tree
    const currentBallots: Ballot[] = [];
    const currentBallotsPathElements: PathElements[] = [];

    // we want to store the vote weights at this point in time
    // and the path elements of the vote weight tree
    const currentVoteWeights: bigint[] = [];
    const currentVoteWeightsPathElements: PathElements[] = [];

    // loop through the batch of messages
    for (let i = 0; i < batchSize; i += 1) {
      // we process the messages in reverse order
      const idx = this.currentMessageBatchIndex * batchSize - i - 1;
      assert(idx >= 0, "The message index must be >= 0");
      let message: Message;
      let encryptionPublicKey: PublicKey;

      if (idx < this.messages.length) {
        message = this.messages[idx];
        encryptionPublicKey = this.encryptionPublicKeys[idx];

        try {
          // check if the command is valid
          const {
            stateLeafIndex,
            originalStateLeaf,
            originalBallot,
            originalVoteWeight,
            originalVoteWeightsPathElements,
            originalStateLeafPathElements,
            originalBallotPathElements,
            newStateLeaf,
            newBallot,
          } = this.processMessage(message, encryptionPublicKey);
          const index = stateLeafIndex!;

          // we add at position 0 the original data
          currentStateLeaves.unshift(originalStateLeaf!);
          currentBallots.unshift(originalBallot!);
          currentVoteWeights.unshift(originalVoteWeight!);
          currentVoteWeightsPathElements.unshift(originalVoteWeightsPathElements!);
          currentStateLeavesPathElements.unshift(originalStateLeafPathElements!);
          currentBallotsPathElements.unshift(originalBallotPathElements!);

          // update the state leaves with the new state leaf (result of processing the message)
          this.pollStateLeaves[index] = newStateLeaf!.copy();

          // we also update the state tree with the hash of the new state leaf
          this.pollStateTree?.update(index, newStateLeaf!.hash());

          // store the new ballot
          this.ballots[index] = newBallot!;
          // update the ballot tree
          this.ballotTree?.update(index, newBallot!.hash());
        } catch (e) {
          // if the error is not a ProcessMessageError we throw it and exit here
          // otherwise we continue processing but add the default blank data instead of
          // this invalid message
          if (e instanceof ProcessMessageError) {
            // if logging is enabled, and it's not the first message, print the error
            if (!quiet && idx !== 0) {
              // eslint-disable-next-line no-console
              console.log(`Error at message index ${idx} - ${e.message}`);
            }

            // @note we want to send the correct state leaf to the circuit
            // even if a message is invalid
            // this way if a message is invalid we can still generate a proof of processing
            // we also want to prevent a DoS attack by a voter
            // which sends a message that when force decrypted on the circuit
            // results in a valid state index thus forcing the circuit to look
            // for a valid state leaf, and failing to generate a proof

            // generate shared key
            const sharedKey = Keypair.generateEcdhSharedKey(this.coordinatorKeypair.privateKey, encryptionPublicKey);

            // force decrypt it
            const { command } = VoteCommand.decrypt(message, sharedKey, true);

            // cache state leaf index
            const stateLeafIndex = command.stateIndex;

            // if the state leaf index is valid then use it
            if (stateLeafIndex < this.pollStateLeaves.length) {
              currentStateLeaves.unshift(this.pollStateLeaves[Number(stateLeafIndex)].copy());
              currentStateLeavesPathElements.unshift(
                this.pollStateTree!.generateProof(Number(stateLeafIndex)).pathElements,
              );

              // copy the ballot
              const ballot = this.ballots[Number(stateLeafIndex)].copy();
              currentBallots.unshift(ballot);
              currentBallotsPathElements.unshift(this.ballotTree!.generateProof(Number(stateLeafIndex)).pathElements);

              // @note we check that command.voteOptionIndex is valid so < voteOptions
              // this might be unnecessary but we do it to prevent a possible DoS attack
              // from voters who could potentially encrypt a message in such as way that
              // when decrypted it results in a valid state leaf index but an invalid vote option index
              if (command.voteOptionIndex < this.voteOptions) {
                currentVoteWeights.unshift(ballot.votes[Number(command.voteOptionIndex)]);

                // create a new quinary tree and add all votes we have so far
                const voteTree = new IncrementalQuinTree(
                  this.treeDepths.voteOptionTreeDepth,
                  0n,
                  VOTE_OPTION_TREE_ARITY,
                  hash5,
                );

                // fill the vote option tree with the votes we have so far
                for (let j = 0; j < this.ballots[0].votes.length; j += 1) {
                  voteTree.insert(ballot.votes[j]);
                }

                // get the path elements for the first vote leaf
                currentVoteWeightsPathElements.unshift(
                  voteTree.generateProof(Number(command.voteOptionIndex)).pathElements,
                );
              } else {
                currentVoteWeights.unshift(ballot.votes[0]);

                // create a new quinary tree and add all votes we have so far
                const voteTree = new IncrementalQuinTree(
                  this.treeDepths.voteOptionTreeDepth,
                  0n,
                  VOTE_OPTION_TREE_ARITY,
                  hash5,
                );

                // fill the vote option tree with the votes we have so far
                for (let j = 0; j < this.ballots[0].votes.length; j += 1) {
                  voteTree.insert(ballot.votes[j]);
                }

                // get the path elements for the first vote leaf
                currentVoteWeightsPathElements.unshift(voteTree.generateProof(0).pathElements);
              }
            } else {
              // just use state leaf index 0
              currentStateLeaves.unshift(this.pollStateLeaves[0].copy());
              currentStateLeavesPathElements.unshift(this.pollStateTree!.generateProof(0).pathElements);
              currentBallots.unshift(this.ballots[0].copy());
              currentBallotsPathElements.unshift(this.ballotTree!.generateProof(0).pathElements);

              // Since the command is invalid, we use a zero vote weight
              currentVoteWeights.unshift(this.ballots[0].votes[0]);

              // create a new quinary tree and add an empty vote
              const voteTree = new IncrementalQuinTree(
                this.treeDepths.voteOptionTreeDepth,
                0n,
                VOTE_OPTION_TREE_ARITY,
                hash5,
              );
              voteTree.insert(this.ballots[0].votes[0]);
              // get the path elements for this empty vote weight leaf
              currentVoteWeightsPathElements.unshift(voteTree.generateProof(0).pathElements);
            }
          } else {
            throw e;
          }
        }
      } else {
        // Since we don't have a command at that position, use a blank state leaf
        currentStateLeaves.unshift(this.pollStateLeaves[0].copy());
        currentStateLeavesPathElements.unshift(this.pollStateTree!.generateProof(0).pathElements);
        // since the command is invliad we use the blank ballot
        currentBallots.unshift(this.ballots[0].copy());
        currentBallotsPathElements.unshift(this.ballotTree!.generateProof(0).pathElements);

        // Since the command is invalid, we use a zero vote weight
        currentVoteWeights.unshift(this.ballots[0].votes[0]);

        // create a new quinary tree and add an empty vote
        const voteTree = new IncrementalQuinTree(
          this.treeDepths.voteOptionTreeDepth,
          0n,
          VOTE_OPTION_TREE_ARITY,
          hash5,
        );
        voteTree.insert(this.ballots[0].votes[0]);

        // get the path elements for this empty vote weight leaf
        currentVoteWeightsPathElements.unshift(voteTree.generateProof(0).pathElements);
      }
    }

    // store the data in the circuit inputs object
    circuitInputs.currentStateLeaves = currentStateLeaves.map((x) => x.asCircuitInputs());
    // we need to fill the array with 0s to match the length of the state leaves
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < currentStateLeavesPathElements.length; i += 1) {
      while (currentStateLeavesPathElements[i].length < this.treeDepths.stateTreeDepth) {
        currentStateLeavesPathElements[i].push([0n]);
      }
    }

    circuitInputs.currentStateLeavesPathElements = currentStateLeavesPathElements;
    circuitInputs.currentBallots = currentBallots.map((x) => x.asCircuitInputs());
    circuitInputs.currentBallotsPathElements = currentBallotsPathElements;
    circuitInputs.currentVoteWeights = currentVoteWeights;
    circuitInputs.currentVoteWeightsPathElements = currentVoteWeightsPathElements;

    // record that we processed one batch
    this.totalBatchesProcessed += 1;

    if (this.currentMessageBatchIndex > 0) {
      this.currentMessageBatchIndex -= 1;
    }

    // ensure newSbSalt differs from currentSbSalt
    let newSbSalt = generateRandomSalt();
    while (this.sbSalts[this.currentMessageBatchIndex] === newSbSalt) {
      newSbSalt = generateRandomSalt();
    }
    this.sbSalts[this.currentMessageBatchIndex] = newSbSalt;

    // store the salt in the circuit inputs
    circuitInputs.newSbSalt = newSbSalt;
    const newStateRoot = this.pollStateTree!.root;
    const newBallotRoot = this.ballotTree!.root;
    // create a commitment to the state and ballot tree roots
    // this will be the hash of the roots with a salt
    circuitInputs.newSbCommitment = hash3([newStateRoot, newBallotRoot, newSbSalt]);

    const coordinatorPublicKeyHash = this.coordinatorKeypair.publicKey.hash();

    // If this is the last batch, release the lock
    if (this.totalBatchesProcessed * batchSize >= this.messages.length) {
      this.maciStateRef.pollBeingProcessed = false;
    }

    // ensure we pass the dynamic tree depth
    circuitInputs.actualStateTreeDepth = this.actualStateTreeDepth.toString();

    return stringifyBigInts({
      ...circuitInputs,
      coordinatorPublicKeyHash,
    }) as unknown as IProcessMessagesCircuitInputs;
  };

  /**
   * Generates partial circuit inputs for processing a batch of messages
   * @param index - The index of the partial batch.
   * @returns stringified partial circuit inputs
   */
  private generateProcessMessagesCircuitInputsPartial = (index: number): TCircuitInputs => {
    const { messageBatchSize } = this.batchSizes;

    assert(index <= this.messages.length, "The index must be <= the number of messages");

    // fill the messages array with a copy of the messages we have
    // plus empty messages to fill the batch

    // @note create a message with state index 0 to add as padding
    // this way the message will look for state leaf 0
    // and no effect will take place

    // create a random key
    const key = new Keypair();
    // generate ecdh key
    const ecdh = Keypair.generateEcdhSharedKey(key.privateKey, this.coordinatorKeypair.publicKey);
    // create an empty command with state index 0n
    const emptyCommand = new VoteCommand(0n, key.publicKey, 0n, 0n, 0n, 0n, 0n);

    // encrypt it
    const emptyMessage = emptyCommand.encrypt(emptyCommand.sign(key.privateKey), ecdh);

    // copy the messages to a new array
    let messages = this.messages.map((x) => x.asCircuitInputs());

    // pad with our state index 0 message
    while (messages.length % messageBatchSize > 0) {
      messages.push(emptyMessage.asCircuitInputs());
    }

    // copy the public keys, pad the array with the last keys if needed
    let encryptionPublicKeys = this.encryptionPublicKeys.map((x) => x.copy());

    while (encryptionPublicKeys.length % messageBatchSize > 0) {
      // pad with the public key used to encrypt the message with state index 0 (padding)
      encryptionPublicKeys.push(key.publicKey.copy());
    }

    // validate that the batch index is correct, if not fix it
    // this means that the end will be the last message
    let batchEndIndex = index * messageBatchSize;

    if (batchEndIndex > this.messages.length) {
      batchEndIndex = this.messages.length;
    }

    const batchStartIndex = index > 0 ? (index - 1) * messageBatchSize : 0;

    // we only take the messages we need for this batch
    // it slice messages array from index of first message in current batch to
    // index of last message in current batch
    messages = messages.slice(batchStartIndex, index * messageBatchSize);

    // then take the ones part of this batch
    encryptionPublicKeys = encryptionPublicKeys.slice(batchStartIndex, index * messageBatchSize);

    // cache tree roots
    const currentStateRoot = this.pollStateTree!.root;
    const currentBallotRoot = this.ballotTree!.root;
    // calculate the current state and ballot root
    // commitment which is the hash of the state tree
    // root, the ballot tree root and a salt
    const currentSbCommitment = hash3([currentStateRoot, currentBallotRoot, this.sbSalts[index]]);

    const inputBatchHash = this.batchHashes[index - 1];
    const outputBatchHash = this.batchHashes[index];

    return stringifyBigInts({
      totalSignups: BigInt(this.totalSignups),
      batchEndIndex: BigInt(batchEndIndex),
      index: BigInt(batchStartIndex),
      inputBatchHash,
      outputBatchHash,
      messages,
      actualStateTreeDepth: BigInt(this.actualStateTreeDepth),
      coordinatorPrivateKey: this.coordinatorKeypair.privateKey.asCircuitInputs(),
      encryptionPublicKeys: encryptionPublicKeys.map((x) => x.asCircuitInputs()),
      currentStateRoot,
      currentBallotRoot,
      currentSbCommitment,
      currentSbSalt: this.sbSalts[this.currentMessageBatchIndex],
      voteOptions: this.voteOptions,
    }) as TCircuitInputs;
  };

  /**
   * Process all messages. This function does not update the ballots or state
   * leaves; rather, it copies and then updates them. This makes it possible
   * to test the result of multiple processMessage() invocations.
   * @returns The state leaves and ballots of the poll
   */
  processAllMessages = (): { stateLeaves: StateLeaf[]; ballots: Ballot[] } => {
    const stateLeaves = this.pollStateLeaves.map((x) => x.copy());
    const ballots = this.ballots.map((x) => x.copy());

    // process all messages in one go (batch by batch but without manual intervention)
    while (this.hasUnprocessedMessages()) {
      this.processMessages(this.pollId);
    }

    return { stateLeaves, ballots };
  };

  /**
   * Checks whether there are any untallied ballots.
   * @returns Whether there are any untallied ballots
   */
  hasUntalliedBallots = (): boolean => this.numBatchesTallied * this.batchSizes.tallyBatchSize < this.ballots.length;

  /**
   * This method tallies a ballots and updates the tally results.
   *
   * @returns the circuit inputs for the VoteTally circuit.
   */
  tallyVotes = (): IVoteTallyCircuitInputs => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.sbSalts[this.currentMessageBatchIndex] === undefined) {
      throw new Error("You must process the messages first");
    }

    const batchSize = this.batchSizes.tallyBatchSize;

    assert(this.hasUntalliedBallots(), "No more ballots to tally");

    // calculate where we start tallying next
    const batchStartIndex = this.numBatchesTallied * batchSize;

    // get the salts needed for the commitments
    const currentResultsRootSalt = batchStartIndex === 0 ? 0n : this.resultRootSalts[batchStartIndex - batchSize];

    const currentPerVoteOptionSpentVoiceCreditsRootSalt =
      batchStartIndex === 0 ? 0n : this.perVoteOptionSpentVoiceCreditsRootSalts[batchStartIndex - batchSize];

    const currentSpentVoiceCreditSubtotalSalt =
      batchStartIndex === 0 ? 0n : this.spentVoiceCreditSubtotalSalts[batchStartIndex - batchSize];

    // generate a commitment to the current results
    const currentResultsCommitment = generateTreeCommitment(
      this.tallyResult,
      currentResultsRootSalt,
      this.treeDepths.voteOptionTreeDepth,
    );

    // generate a commitment to the current per vote option spent voice credits
    const currentPerVoteOptionSpentVoiceCreditsCommitment = this.generatePerVoteOptionSpentVoiceCreditsCommitment(
      currentPerVoteOptionSpentVoiceCreditsRootSalt,
      batchStartIndex,
      this.mode,
    );

    // generate a commitment to the current spent voice credits
    const currentSpentVoiceCreditsCommitment = this.generateSpentVoiceCreditSubtotalCommitment(
      currentSpentVoiceCreditSubtotalSalt,
      batchStartIndex,
      this.mode,
    );

    // the current commitment for the first batch will be 0
    // otherwise calculate as
    // hash([
    //  currentResultsCommitment,
    //  currentSpentVoiceCreditsCommitment,
    // ])
    // or for QV
    // hash([
    //  currentResultsCommitment,
    //  currentSpentVoiceCreditsCommitment,
    //  currentPerVoteOptionSpentVoiceCreditsCommitment
    // ])

    // TODO: use commitment for vote counts
    const currentTallyCommitmentQv =
      this.mode !== EMode.QV || batchStartIndex === 0
        ? 0n
        : hash3([
            currentResultsCommitment,
            currentSpentVoiceCreditsCommitment,
            currentPerVoteOptionSpentVoiceCreditsCommitment,
          ]);

    const currentTallyCommitmentNonQv =
      this.mode === EMode.QV || batchStartIndex === 0
        ? 0n
        : hashLeftRight(currentResultsCommitment, currentSpentVoiceCreditsCommitment);

    const currentTallyCommitment = currentTallyCommitmentNonQv || currentTallyCommitmentQv;
    const startIndex = this.numBatchesTallied * batchSize;
    const endIndex = this.numBatchesTallied * batchSize + batchSize;

    const ballots: Ballot[] = [];
    const voteCounts: VoteCounts[] = [];
    const voteCountsData: bigint[][] = [];
    const currentResults = this.tallyResult.map((x) => BigInt(x.toString()));
    const currentPerVoteOptionSpentVoiceCredits = this.perVoteOptionSpentVoiceCredits.map((x) => BigInt(x.toString()));
    const currentSpentVoiceCreditSubtotal = BigInt(this.totalSpentVoiceCredits.toString());

    // loop in normal order to tally the ballots one by one
    for (let i = startIndex; i < endIndex; i += 1) {
      // we stop if we have no more ballots to tally
      if (i >= this.ballots.length) {
        break;
      }

      // save to the local ballot array
      ballots.push(this.ballots[i]);

      const ballot = this.ballots[i];
      const newVoteCounts = this.voteCounts[i].copy();

      newVoteCounts.counts = ballot.votes.map(
        (votes, voteOptionIndex) => this.voteCounts[i].counts[voteOptionIndex] + BigInt(votes !== 0n),
      );
      // save to the local vote counts array
      this.voteCountsTree?.update(i, newVoteCounts.hash());
      this.voteCounts[i] = newVoteCounts;
      voteCounts.push(newVoteCounts);
      voteCountsData.push(newVoteCounts.counts);

      // for each possible vote option we loop and calculate
      for (let j = 0; j < this.maxVoteOptions; j += 1) {
        const votes = this.ballots[i].votes[j];

        this.tallyResult[j] += votes;

        if (this.mode === EMode.QV) {
          // the per vote option spent voice credits will be the sum of the squares of the votes
          this.perVoteOptionSpentVoiceCredits[j] += votes * votes;

          // the total spent voice credits will be the sum of the squares of the votes
          this.totalSpentVoiceCredits += votes * votes;
        } else {
          // the total spent voice credits will be the sum of the votes
          this.totalSpentVoiceCredits += votes;
        }
      }
    }

    const emptyBallot = new Ballot(this.maxVoteOptions, this.treeDepths.voteOptionTreeDepth);
    const emptyVoteCounts = new VoteCounts(this.maxVoteOptions, this.treeDepths.voteOptionTreeDepth);

    // pad the ballots array
    while (ballots.length < batchSize) {
      ballots.push(emptyBallot);
    }

    // pad the vote counts array
    while (voteCounts.length < batchSize) {
      voteCounts.push(emptyVoteCounts);
    }

    // generate the new salts
    const newResultsRootSalt = generateRandomSalt();
    const newPerVoteOptionSpentVoiceCreditsRootSalt = generateRandomSalt();
    const newSpentVoiceCreditSubtotalSalt = generateRandomSalt();

    // and save them to be used in the next batch
    this.resultRootSalts[batchStartIndex] = newResultsRootSalt;
    this.perVoteOptionSpentVoiceCreditsRootSalts[batchStartIndex] = newPerVoteOptionSpentVoiceCreditsRootSalt;
    this.spentVoiceCreditSubtotalSalts[batchStartIndex] = newSpentVoiceCreditSubtotalSalt;

    // generate the new results commitment with the new salts and data
    const newResultsCommitment = generateTreeCommitment(
      this.tallyResult,
      newResultsRootSalt,
      this.treeDepths.voteOptionTreeDepth,
    );

    // generate the new spent voice credits commitment with the new salts and data
    const newSpentVoiceCreditsCommitment = this.generateSpentVoiceCreditSubtotalCommitment(
      newSpentVoiceCreditSubtotalSalt,
      batchStartIndex + batchSize,
      this.mode,
    );

    // generate the new per vote option spent voice credits commitment with the new salts and data
    const newPerVoteOptionSpentVoiceCreditsCommitment = this.generatePerVoteOptionSpentVoiceCreditsCommitment(
      newPerVoteOptionSpentVoiceCreditsRootSalt,
      batchStartIndex + batchSize,
      this.mode,
    );

    // generate the new tally commitment
    const newTallyCommitment =
      this.mode === EMode.QV
        ? hash3([newResultsCommitment, newSpentVoiceCreditsCommitment, newPerVoteOptionSpentVoiceCreditsCommitment])
        : hashLeftRight(newResultsCommitment, newSpentVoiceCreditsCommitment);

    // cache vars
    const stateRoot = this.pollStateTree!.root;
    const ballotRoot = this.ballotTree!.root;
    const voteCountsRoot = this.voteCountsTree!.root;
    const sbSalt = this.sbSalts[this.currentMessageBatchIndex];
    const sbCommitment = hash3([stateRoot, ballotRoot, sbSalt]);

    const ballotSubrootProof = this.ballotTree?.generateSubrootProof(batchStartIndex, batchStartIndex + batchSize);
    const voteCountsSubrootProof = this.voteCountsTree?.generateSubrootProof(
      batchStartIndex,
      batchStartIndex + batchSize,
    );

    const votes = ballots.map((x) => x.votes);

    // Don't include these inputs in the circuit inputs until individual vote counts are implemented
    const excludedCircuitInputs = ["voteCountsData", "voteCountsPathElements", "voteCounts", "voteCountsRoot"];

    const circuitInputs = stringifyBigInts(
      omit(
        {
          stateRoot,
          ballotRoot,
          sbSalt,
          index: BigInt(batchStartIndex),
          totalSignups: BigInt(this.totalSignups),
          sbCommitment,
          currentTallyCommitment,
          newTallyCommitment,
          ballots: ballots.map((x) => x.asCircuitInputs()),
          ballotPathElements: ballotSubrootProof!.pathElements,
          votes,
          voteCountsRoot,
          voteCounts: voteCounts.map((x) => x.asCircuitInputs()),
          voteCountsPathElements: voteCountsSubrootProof!.pathElements,
          voteCountsData,
          currentResults,
          currentResultsRootSalt,
          currentSpentVoiceCreditSubtotal,
          currentSpentVoiceCreditSubtotalSalt,
          currentPerVoteOptionSpentVoiceCredits,
          currentPerVoteOptionSpentVoiceCreditsRootSalt,
          newPerVoteOptionSpentVoiceCreditsRootSalt,
          newResultsRootSalt,
          newSpentVoiceCreditSubtotalSalt,
        },
        this.mode !== EMode.QV
          ? [
              ...excludedCircuitInputs,
              "currentPerVoteOptionSpentVoiceCredits",
              "currentPerVoteOptionSpentVoiceCreditsRootSalt",
              "newPerVoteOptionSpentVoiceCreditsRootSalt",
            ]
          : [...excludedCircuitInputs],
      ),
    ) as unknown as IVoteTallyCircuitInputs;

    this.numBatchesTallied += 1;

    return circuitInputs;
  };

  /**
   * This method generates a commitment to the total spent voice credits.
   *
   * This is the hash of the total spent voice credits and a salt, computed as Poseidon([totalCredits, _salt]).
   * @param salt - The salt used in the hash function.
   * @param ballotsToCount - The number of ballots to count for the calculation.
   * @param mode - Voting mode, default is QV.
   * @returns Returns the hash of the total spent voice credits and a salt, computed as Poseidon([totalCredits, _salt]).
   */
  private generateSpentVoiceCreditSubtotalCommitment = (
    salt: bigint,
    ballotsToCount: number,
    mode = EMode.QV,
  ): bigint => {
    let subtotal = 0n;

    for (let i = 0; i < ballotsToCount; i += 1) {
      if (this.ballots.length <= i) {
        break;
      }

      for (let j = 0; j < this.tallyResult.length; j += 1) {
        const vote = BigInt(`${this.ballots[i].votes[j]}`);
        subtotal += mode === EMode.QV ? vote * vote : vote;
      }
    }

    return hashLeftRight(subtotal, salt);
  };

  /**
   * This method generates a commitment to the spent voice credits per vote option.
   *
   * This is the hash of the Merkle root of the spent voice credits per vote option and a salt, computed as Poseidon([root, _salt]).
   * @param salt - The salt used in the hash function.
   * @param ballotsToCount - The number of ballots to count for the calculation.
   * @param mode - Voting mode, default is QV.
   * @returns Returns the hash of the Merkle root of the spent voice credits per vote option and a salt, computed as Poseidon([root, _salt]).
   */
  private generatePerVoteOptionSpentVoiceCreditsCommitment = (
    salt: bigint,
    ballotsToCount: number,
    mode = EMode.QV,
  ): bigint => {
    const leaves: bigint[] = Array<bigint>(this.tallyResult.length).fill(0n);

    for (let i = 0; i < ballotsToCount; i += 1) {
      // check that is a valid index
      if (i >= this.ballots.length) {
        break;
      }

      for (let j = 0; j < this.tallyResult.length; j += 1) {
        const vote = this.ballots[i].votes[j];
        leaves[j] += mode === EMode.QV ? vote * vote : vote;
      }
    }

    return generateTreeCommitment(leaves, salt, this.treeDepths.voteOptionTreeDepth);
  };

  /**
   * Create a deep copy of the Poll object.
   * @returns A new instance of the Poll object with the same properties.
   */
  copy = (): Poll => {
    const copied = new Poll(
      BigInt(this.pollEndTimestamp.toString()),
      this.coordinatorKeypair.copy(),
      {
        tallyProcessingStateTreeDepth: Number(this.treeDepths.tallyProcessingStateTreeDepth),
        voteOptionTreeDepth: Number(this.treeDepths.voteOptionTreeDepth),
        stateTreeDepth: Number(this.treeDepths.stateTreeDepth),
      },
      {
        tallyBatchSize: Number(this.batchSizes.tallyBatchSize.toString()),
        messageBatchSize: Number(this.batchSizes.messageBatchSize.toString()),
      },
      this.maciStateRef,
      this.voteOptions,
      this.mode,
    );

    copied.publicKeys = this.publicKeys.map((x) => x.copy());
    copied.pollStateLeaves = this.pollStateLeaves.map((x) => x.copy());
    copied.messages = this.messages.map((x) => x.copy());
    copied.commands = this.commands.map((x) => x.copy());
    copied.ballots = this.ballots.map((x) => x.copy());
    copied.encryptionPublicKeys = this.encryptionPublicKeys.map((x) => x.copy());
    copied.voteCounts = this.voteCounts.map((x) => x.copy());

    if (this.ballotTree) {
      copied.ballotTree = this.ballotTree.copy();
    }

    if (this.voteCountsTree) {
      copied.voteCountsTree = this.voteCountsTree.copy();
    }

    copied.currentMessageBatchIndex = this.currentMessageBatchIndex;
    copied.maciStateRef = this.maciStateRef;
    copied.tallyResult = this.tallyResult.map((x: bigint) => BigInt(x.toString()));
    copied.perVoteOptionSpentVoiceCredits = this.perVoteOptionSpentVoiceCredits.map((x: bigint) =>
      BigInt(x.toString()),
    );

    copied.totalBatchesProcessed = Number(this.totalBatchesProcessed.toString());
    copied.numBatchesTallied = Number(this.numBatchesTallied.toString());
    copied.pollId = this.pollId;
    copied.totalSpentVoiceCredits = BigInt(this.totalSpentVoiceCredits.toString());

    copied.sbSalts = {};
    copied.resultRootSalts = {};
    copied.perVoteOptionSpentVoiceCreditsRootSalts = {};
    copied.spentVoiceCreditSubtotalSalts = {};

    Object.keys(this.sbSalts).forEach((k) => {
      copied.sbSalts[k] = BigInt(this.sbSalts[k].toString());
    });

    Object.keys(this.resultRootSalts).forEach((k) => {
      copied.resultRootSalts[k] = BigInt(this.resultRootSalts[k].toString());
    });

    Object.keys(this.perVoteOptionSpentVoiceCreditsRootSalts).forEach((k) => {
      copied.perVoteOptionSpentVoiceCreditsRootSalts[k] = BigInt(
        this.perVoteOptionSpentVoiceCreditsRootSalts[k].toString(),
      );
    });

    Object.keys(this.spentVoiceCreditSubtotalSalts).forEach((k) => {
      copied.spentVoiceCreditSubtotalSalts[k] = BigInt(this.spentVoiceCreditSubtotalSalts[k].toString());
    });

    // update the number of signups
    copied.setTotalSignups(this.totalSignups);

    return copied;
  };

  /**
   * Check if the Poll object is equal to another Poll object.
   * @param poll - The Poll object to compare.
   * @returns True if the two Poll objects are equal, false otherwise.
   */
  equals = (poll: Poll): boolean => {
    const result =
      this.coordinatorKeypair.equals(poll.coordinatorKeypair) &&
      this.treeDepths.tallyProcessingStateTreeDepth === poll.treeDepths.tallyProcessingStateTreeDepth &&
      this.treeDepths.voteOptionTreeDepth === poll.treeDepths.voteOptionTreeDepth &&
      this.batchSizes.tallyBatchSize === poll.batchSizes.tallyBatchSize &&
      this.batchSizes.messageBatchSize === poll.batchSizes.messageBatchSize &&
      this.maxVoteOptions === poll.maxVoteOptions &&
      this.messages.length === poll.messages.length &&
      this.encryptionPublicKeys.length === poll.encryptionPublicKeys.length &&
      this.totalSignups === poll.totalSignups;

    if (!result) {
      return false;
    }

    for (let i = 0; i < this.messages.length; i += 1) {
      if (!this.messages[i].equals(poll.messages[i])) {
        return false;
      }
    }

    for (let i = 0; i < this.encryptionPublicKeys.length; i += 1) {
      if (!this.encryptionPublicKeys[i].equals(poll.encryptionPublicKeys[i])) {
        return false;
      }
    }

    return true;
  };

  /**
   * Serialize the Poll object to a JSON object
   * @returns a JSON object
   */
  toJSON(): IJsonPoll {
    return {
      stateTreeDepth: Number(this.treeDepths.stateTreeDepth),
      pollEndTimestamp: this.pollEndTimestamp.toString(),
      treeDepths: this.treeDepths,
      batchSizes: this.batchSizes,
      maxVoteOptions: this.maxVoteOptions,
      voteOptions: this.voteOptions.toString(),
      messages: this.messages.map((message) => message.toJSON()),
      commands: this.commands.map((command) => command.toJSON()),
      ballots: this.ballots.map((ballot) => ballot.toJSON()),
      voteCounts: this.voteCounts.map((voteCounts) => voteCounts.toJSON()),
      encryptionPublicKeys: this.encryptionPublicKeys.map((encryptionPublicKey) => encryptionPublicKey.serialize()),
      currentMessageBatchIndex: this.currentMessageBatchIndex,
      publicKeys: this.publicKeys.map((leaf) => leaf.toJSON()),
      pollStateLeaves: this.pollStateLeaves.map((leaf) => leaf.toJSON()),
      results: this.tallyResult.map((result) => result.toString()),
      totalBatchesProcessed: this.totalBatchesProcessed,
      totalSignups: this.totalSignups.toString(),
      chainHash: this.chainHash.toString(),
      pollNullifiers: [...this.pollNullifiers.keys()].map((nullifier) => nullifier.toString()),
      batchHashes: this.batchHashes.map((batchHash) => batchHash.toString()),
      mode: this.mode,
    };
  }

  /**
   * Deserialize a json object into a Poll instance
   * @param json the json object to deserialize
   * @param maciState the reference to the MaciState Class
   * @returns a new Poll instance
   */
  static fromJSON(json: IJsonPoll, maciState: MaciState): Poll {
    const poll = new Poll(
      BigInt(json.pollEndTimestamp),
      new Keypair(),
      json.treeDepths,
      json.batchSizes,
      maciState,
      BigInt(json.voteOptions),
      json.mode,
    );

    // set all properties
    poll.pollStateLeaves = json.pollStateLeaves.map((leaf) => StateLeaf.fromJSON(leaf));
    poll.ballots = json.ballots.map((ballot) => Ballot.fromJSON(ballot));
    poll.voteCounts = json.voteCounts.map((voteCounts) => VoteCounts.fromJSON(voteCounts));
    poll.encryptionPublicKeys = json.encryptionPublicKeys.map((key) => PublicKey.deserialize(key));
    poll.messages = json.messages.map((message) => Message.fromJSON(message as IMessageContractParams));
    poll.commands = json.commands.map((command) => VoteCommand.fromJSON(command));
    poll.tallyResult = json.results.map((result) => BigInt(result));
    poll.currentMessageBatchIndex = json.currentMessageBatchIndex;
    poll.totalBatchesProcessed = json.totalBatchesProcessed;
    poll.chainHash = BigInt(json.chainHash);
    poll.batchHashes = json.batchHashes.map((batchHash) => BigInt(batchHash));
    poll.pollNullifiers = new Map(json.pollNullifiers.map((nullifier) => [BigInt(nullifier), true]));

    // copy maci state
    poll.updatePoll(BigInt(json.totalSignups));

    return poll;
  }

  /**
   * Set the coordinator's keypair
   * @param serializedPrivateKey - the serialized private key
   */
  setCoordinatorKeypair = (serializedPrivateKey: string): void => {
    this.coordinatorKeypair = new Keypair(PrivateKey.deserialize(serializedPrivateKey));
  };

  /**
   * Set the number of signups to match the ones from the contract
   * @param totalSignups - the number of signups
   */
  setTotalSignups = (totalSignups: bigint): void => {
    this.totalSignups = totalSignups;
  };

  /**
   * Get the number of signups
   * @returns The number of signups
   */
  getTotalSignups = (): bigint => this.totalSignups;
}
