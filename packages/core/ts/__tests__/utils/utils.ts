import { type Signature } from "@maci-protocol/crypto";
import { VoteCommand, type Message, Keypair, type PublicKey } from "@maci-protocol/domainobjs";

import { MaciState } from "../../MaciState";
import { type Poll } from "../../Poll";
import { EMode, STATE_TREE_DEPTH } from "../../utils/constants";

import { duration, maxVoteOptions, messageBatchSize, treeDepths } from "./constants";

/**
 * Calculates the total of a tally result
 * @param tallyResult - the tally result
 * @returns the total of the tally result
 */
export const calculateTotal = (tallyResult: bigint[]): bigint => tallyResult.reduce((acc, v) => acc + v, 0n);

/**
 * A test harness for the MACI contract.
 */
export class TestHarness {
  maciState = new MaciState(STATE_TREE_DEPTH);

  coordinatorKeypair = new Keypair();

  poll: Poll;

  pollId: bigint;

  users: Keypair[] = [];

  stateIndices = new Map<Keypair, number>();

  /**
   * Constructs a new TestHarness object.
   */
  constructor() {
    this.pollId = this.maciState.deployPoll(
      BigInt(Math.floor(Date.now() / 1000) + duration),
      treeDepths,
      messageBatchSize,
      this.coordinatorKeypair,
      maxVoteOptions,
      EMode.QV,
    );
    this.poll = this.maciState.polls.get(this.pollId)!;
  }

  /**
   * Creates a number of users and signs them up to the MACI state tree.
   * @param numUsers - The number of users to create.
   * @returns The keypairs of the newly created users.
   */
  createUsers = (numUsers: number): Keypair[] => {
    for (let i = 0; i < numUsers; i += 1) {
      const user = new Keypair();
      this.users.push(user);
      const stateIndex = this.signup(user);
      this.stateIndices.set(user, stateIndex);
    }
    return this.users;
  };

  /**
   * Signs up a user to the MACI state tree.
   * @param user - The keypair of the user.
   * @returns The index of the newly signed-up user in the state tree.
   */
  signup = (user: Keypair): number => this.maciState.signUp(user.publicKey);

  /**
   * Join a poll.
   *
   * @param nullifier - The nullifier
   * @param publicKey - The public key
   * @param newVoiceCreditBalance - The new voice credit balance
   * @returns The index of added state leaf
   */
  joinPoll = (nullifier: bigint, publicKey: PublicKey, newVoiceCreditBalance: bigint): number =>
    this.poll.joinPoll(nullifier, publicKey, newVoiceCreditBalance);

  /**
   * Publishes a message to the MACI poll instance.
   * @param user - The keypair of the user.
   * @param stateIndex - The index of the user in the state tree.
   * @param voteOptionIndex - The index of the vote option.
   * @param voteWeight - The weight of the vote.
   * @param nonce - The nonce of the vote.
   */
  vote = (user: Keypair, stateIndex: number, voteOptionIndex: bigint, voteWeight: bigint, nonce: bigint): void => {
    const { command, signature } = this.createCommand(user, stateIndex, voteOptionIndex, voteWeight, nonce);

    const { message, encryptionPublicKey } = this.createMessage(command, signature, this.coordinatorKeypair);

    this.poll.publishMessage(message, encryptionPublicKey);
  };

  /**
   * Creates a message from a command and signature.
   * @param command - The command to be encrypted.
   * @param signature - The signature of the command signer.
   * @param coordinatorKeypair - The keypair of the MACI round coordinator.
   * @returns The message and the ephemeral public key used to encrypt the message.
   */
  createMessage = (
    command: VoteCommand,
    signature: Signature,
    coordinatorKeypair: Keypair,
  ): { message: Message; encryptionPublicKey: PublicKey } => {
    const ecdhKeypair = new Keypair();
    const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
    const message = command.encrypt(signature, sharedKey);
    return { message, encryptionPublicKey: ecdhKeypair.publicKey };
  };

  /**
   * Creates a command and signature.
   * @param user - The keypair of the user.
   * @param stateIndex - The index of the user in the state tree.
   * @param voteOptionIndex - The index of the vote option.
   * @param voteWeight - The weight of the vote.
   * @param nonce - The nonce of the vote.
   * @returns The command and signature of the command.
   */
  createCommand = (
    user: Keypair,
    stateIndex: number,
    voteOptionIndex: bigint,
    voteWeight: bigint,
    nonce: bigint,
  ): { command: VoteCommand; signature: Signature } => {
    const command = new VoteCommand(
      BigInt(stateIndex),
      user.publicKey,
      voteOptionIndex,
      voteWeight,
      nonce,
      BigInt(this.pollId),
    );

    const signature = command.sign(user.privateKey);

    return { command, signature };
  };

  /**
   * Finalizes the poll.
   * This processes all messages and tallies the votes.
   * This should be called after all votes have been cast.
   */
  finalizePoll = (): void => {
    this.poll.updatePoll(BigInt(this.maciState.publicKeys.length));
    this.poll.processMessages(this.pollId);
    this.poll.tallyVotes();
  };

  /**
   * Returns the state index of a signed-up user.
   * @param user - The keypair of the user.
   * @returns The state index of the user.
   */
  getStateIndex = (user: Keypair): number => this.stateIndices.get(user) || -1;
}
