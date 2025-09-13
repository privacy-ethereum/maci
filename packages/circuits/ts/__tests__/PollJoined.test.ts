import { EMode, MaciState, type Poll } from "@maci-protocol/core";
import { poseidon } from "@maci-protocol/crypto";
import { Keypair, type Message, VoteCommand } from "@maci-protocol/domainobjs";
import { type WitnessTester } from "circomkit";

import type { IPollJoinedInputs } from "../types";

import {
  STATE_TREE_DEPTH,
  duration,
  maxVoteOptions,
  messageBatchSize,
  treeDepths,
  voiceCreditBalance,
} from "./utils/constants";
import { circomkitInstance } from "./utils/utils";

describe("Poll Joined circuit", function test() {
  this.timeout(900000);
  const NUM_USERS = 50;

  const coordinatorKeypair = new Keypair();

  type PollJoinedCircuitInputs = [
    "privateKey",
    "voiceCreditsBalance",
    "stateLeaf",
    "pathElements",
    "index",
    "stateRoot",
    "actualStateTreeDepth",
  ];

  let circuit: WitnessTester<PollJoinedCircuitInputs>;

  before(async () => {
    circuit = await circomkitInstance.WitnessTester("pollJoined", {
      file: "./voter/PollJoined",
      template: "PollJoined",
      params: [STATE_TREE_DEPTH],
    });
  });

  describe(`${NUM_USERS} users, 1 join`, () => {
    const maciState = new MaciState(STATE_TREE_DEPTH);
    let pollId: bigint;
    let poll: Poll;
    let users: Keypair[];
    const messages: Message[] = [];
    const commands: VoteCommand[] = [];

    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    before(() => {
      // Sign up
      users = new Array(NUM_USERS).fill(0).map(() => new Keypair());

      users.forEach((userKeypair) => {
        maciState.signUp(userKeypair.publicKey);
      });

      pollId = maciState.deployPoll(
        timestamp + BigInt(duration),
        treeDepths,
        messageBatchSize,
        coordinatorKeypair,
        maxVoteOptions,
        EMode.QV,
      );

      poll = maciState.polls.get(pollId)!;

      // Join the poll
      const { privateKey, publicKey: pollPublicKey } = users[0];

      const nullifier = poseidon([BigInt(privateKey.raw.toString())]);

      const stateIndex = BigInt(poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance));

      // First command (valid)
      const command = new VoteCommand(
        stateIndex,
        pollPublicKey,
        BigInt(0), // voteOptionIndex,
        BigInt(9), // vote weight
        BigInt(1), // nonce
        BigInt(pollId),
      );

      const signature = command.sign(privateKey);

      const ecdhKeypair = new Keypair();
      const sharedKey = Keypair.generateEcdhSharedKey(ecdhKeypair.privateKey, coordinatorKeypair.publicKey);
      const message = command.encrypt(signature, sharedKey);
      messages.push(message);
      commands.push(command);

      poll.publishMessage(message, ecdhKeypair.publicKey);

      poll.updatePoll(BigInt(maciState.publicKeys.length));

      // Process messages
      poll.processMessages(pollId);
    });

    it("should produce a proof", async () => {
      const { privateKey, publicKey: pollPublicKey } = users[0];
      const nullifier = poseidon([BigInt(privateKey.asCircuitInputs()), poll.pollId]);

      const stateLeafIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

      const inputs = poll.joinedCircuitInputs({
        maciPrivateKey: privateKey,
        stateLeafIndex: BigInt(stateLeafIndex),
        voiceCreditsBalance: voiceCreditBalance,
      }) as unknown as IPollJoinedInputs;

      const witness = await circuit.calculateWitness(inputs);
      await circuit.expectConstraintPass(witness);
    });

    it("should fail for fake witness", async () => {
      const { privateKey, publicKey: pollPublicKey } = users[1];
      const nullifier = poseidon([BigInt(privateKey.asCircuitInputs()), poll.pollId]);

      const stateLeafIndex = poll.joinPoll(nullifier, pollPublicKey, voiceCreditBalance);

      const inputs = poll.joinedCircuitInputs({
        maciPrivateKey: privateKey,
        stateLeafIndex: BigInt(stateLeafIndex),
        voiceCreditsBalance: voiceCreditBalance,
      }) as unknown as IPollJoinedInputs;
      const witness = await circuit.calculateWitness(inputs);

      const fakeWitness = Array(witness.length).fill(1n) as bigint[];
      await circuit.expectConstraintFail(fakeWitness);
    });
  });
});
