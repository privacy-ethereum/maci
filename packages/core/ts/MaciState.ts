import { type IncrementalQuinTree } from "@maci-protocol/crypto";
import { PublicKey, type Keypair, padKey } from "@maci-protocol/domainobjs";

import type { IJsonMaciState, IJsonPoll, IMaciState, ITreeDepths } from "./utils/types";

import { Poll } from "./Poll";
import { type EMode, STATE_TREE_ARITY } from "./utils/constants";

/**
 * A representation of the MACI contract.
 */
export class MaciState implements IMaciState {
  // a MaciState can hold multiple polls
  polls: Map<bigint, Poll> = new Map<bigint, Poll>();

  // the public keys of the users
  publicKeys: PublicKey[] = [];

  // how deep the state tree is
  stateTreeDepth: number;

  // state tree
  stateTree?: IncrementalQuinTree;

  totalSignups = 0;

  // to keep track if a poll is currently being processed
  pollBeingProcessed?: boolean;

  currentPollBeingProcessed?: bigint;

  /**
   * Constructs a new MaciState object.
   * @param stateTreeDepth - The depth of the state tree.
   */
  constructor(stateTreeDepth: number) {
    this.stateTreeDepth = stateTreeDepth;

    // we put a blank state leaf to prevent a DoS attack
    this.publicKeys.push(padKey);
    // we need to increase the number of signups by one given
    // that we already added the blank leaf
    this.totalSignups += 1;
  }

  /**
   * Sign up a user with the given public key.
   * @param publicKey - The public key of the user.
   * @returns The index of the newly signed-up user in the state tree.
   */
  signUp(publicKey: PublicKey): number {
    this.totalSignups += 1;

    this.stateTree?.insert(publicKey.hash());
    return this.publicKeys.push(publicKey.copy()) - 1;
  }

  /**
   * Deploy a new poll with the given parameters.
   * @param pollEndTimestamp - The Unix timestamp at which the poll ends.
   * @param treeDepths - The depths of the tree.
   * @param messageBatchSize - The batch size for processing messages.
   * @param coordinatorKeypair - The keypair of the MACI round coordinator.
   * @param voteOptions - The number of vote options for this poll.
   * @param mode - The voting mode
   * @returns The index of the newly deployed poll.
   */
  deployPoll(
    pollEndTimestamp: bigint,
    treeDepths: ITreeDepths,
    messageBatchSize: number,
    coordinatorKeypair: Keypair,
    voteOptions: bigint,
    mode: EMode,
  ): bigint {
    const poll: Poll = new Poll(
      pollEndTimestamp,
      coordinatorKeypair,
      treeDepths,
      {
        messageBatchSize,
        tallyBatchSize: STATE_TREE_ARITY ** treeDepths.tallyProcessingStateTreeDepth,
      },
      this,
      voteOptions,
      mode,
    );

    this.polls.set(BigInt(this.polls.size), poll);
    return BigInt(this.polls.size - 1);
  }

  /**
   * Deploy a null poll.
   */
  deployNullPoll(): void {
    this.polls.set(BigInt(this.polls.size), null as unknown as Poll);
  }

  /**
   * Create a deep copy of the MaciState object.
   * @returns A new instance of the MaciState object with the same properties.
   */
  copy = (): MaciState => {
    const copied = new MaciState(this.stateTreeDepth);

    copied.publicKeys = this.publicKeys.map((x: PublicKey) => x.copy());

    copied.polls = new Map(Array.from(this.polls, ([key, value]) => [key, value.copy()]));

    return copied;
  };

  /**
   * Check if the MaciState object is equal to another MaciState object.
   * @param m - The MaciState object to compare.
   * @returns True if the two MaciState objects are equal, false otherwise.
   */
  equals = (m: MaciState): boolean => {
    const result =
      this.stateTreeDepth === m.stateTreeDepth &&
      this.polls.size === m.polls.size &&
      this.publicKeys.length === m.publicKeys.length;

    if (!result) {
      return false;
    }

    for (let i = 0; i < this.polls.size; i += 1) {
      if (!this.polls.get(BigInt(i))?.equals(m.polls.get(BigInt(i))!)) {
        return false;
      }
    }
    for (let i = 0; i < this.publicKeys.length; i += 1) {
      if (!this.publicKeys[i].equals(m.publicKeys[i])) {
        return false;
      }
    }

    return true;
  };

  /**
   * Serialize the MaciState object to a JSON object.
   * @returns A JSON object representing the MaciState object.
   */
  toJSON(): IJsonMaciState {
    return {
      stateTreeDepth: this.stateTreeDepth,
      polls: Array.from(this.polls.values()).map((poll) => poll.toJSON()),
      publicKeys: this.publicKeys.map((publicKey) => publicKey.toJSON()),
      pollBeingProcessed: Boolean(this.pollBeingProcessed),
      currentPollBeingProcessed: this.currentPollBeingProcessed ? this.currentPollBeingProcessed.toString() : "",
      totalSignups: this.totalSignups,
    };
  }

  /**
   * Create a new MaciState object from a JSON object.
   * @param json - The JSON object representing the MaciState object.
   * @returns A new instance of the MaciState object with the properties from the JSON object.
   */
  static fromJSON(json: IJsonMaciState): MaciState {
    const maciState = new MaciState(json.stateTreeDepth);

    // assign the json values to the new instance
    maciState.publicKeys = json.publicKeys.map((publicKey) => PublicKey.fromJSON(publicKey));
    maciState.pollBeingProcessed = json.pollBeingProcessed;
    maciState.currentPollBeingProcessed = BigInt(json.currentPollBeingProcessed);
    maciState.totalSignups = json.totalSignups;

    // re-generate the polls and set the maci state reference
    maciState.polls = new Map(
      json.polls.map((jsonPoll: IJsonPoll, index) => [BigInt(index), Poll.fromJSON(jsonPoll, maciState)]),
    );

    return maciState;
  }
}
