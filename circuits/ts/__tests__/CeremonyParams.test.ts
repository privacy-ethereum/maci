import { expect } from "chai";
import { type WitnessTester } from "circomkit";
import { MaciState, Poll, packProcessMessageSmallVals, STATE_TREE_ARITY } from "maci-core";
import { MESSAGE_BATCH_SIZE, VOTE_OPTION_TREE_ARITY } from "maci-core/build/ts/utils/constants";
import { hash5, IncrementalQuinTree } from "maci-crypto";
import { PrivKey, Keypair, PCommand, Message, Ballot } from "maci-domainobjs";

import { IProcessMessagesInputs, ITallyVotesInputs } from "../types";

import { generateRandomIndex, getSignal, circomkitInstance } from "./utils/utils";

describe("Ceremony param tests", () => {
  const params = {
    // processMessages and Tally
    stateTreeDepth: 14,
    // processMessages and Tally
    voteOptionTreeDepth: 3,
    // Tally
    stateLeafBatchDepth: 2,
  };

  const maxValues = {
    maxUsers: STATE_TREE_ARITY ** params.stateTreeDepth,
    maxVoteOptions: VOTE_OPTION_TREE_ARITY ** params.voteOptionTreeDepth,
  };

  const treeDepths = {
    intStateTreeDepth: 1,
    voteOptionTreeDepth: params.voteOptionTreeDepth,
  };

  const voiceCreditBalance = BigInt(100);
  const duration = 30;

  const coordinatorKeypair = new Keypair();

  describe("ProcessMessage circuit", function test() {
    this.timeout(900000);

    let circuit: WitnessTester<
      [
        "inputHash",
        "packedVals",
        "inputBatchHash",
        "outputBatchHash",
        "msgs",
        "coordPrivKey",
        "coordPubKey",
        "encPubKeys",
        "currentStateRoot",
        "currentStateLeaves",
        "currentStateLeavesPathElements",
        "currentSbCommitment",
        "currentSbSalt",
        "newSbCommitment",
        "newSbSalt",
        "currentBallotRoot",
        "currentBallots",
        "currentBallotsPathElements",
        "currentVoteWeights",
        "currentVoteWeightsPathElements",
      ]
    >;

    let hasherCircuit: WitnessTester<
      [
        "packedVals",
        "coordPubKey",
        "outputBatchHash",
        "currentSbCommitment",
        "newSbCommitment",
        "actualStateTreeDepth",
      ],
      ["maxVoteOptions", "numSignUps", "batchStartIndex", "batchEndIndex", "hash"]
    >;

    before(async () => {
      circuit = await circomkitInstance.WitnessTester("processMessages", {
        file: "./core/qv/processMessages",
        template: "ProcessMessages",
        params: [14, MESSAGE_BATCH_SIZE, 3],
      });

      hasherCircuit = await circomkitInstance.WitnessTester("processMessageInputHasher", {
        file: "./utils/processMessagesInputHasher",
        template: "ProcessMessagesInputHasher",
      });
    });

    describe("1 user, 2 messages", () => {
      const maciState = new MaciState(params.stateTreeDepth);
      const voteWeight = BigInt(9);
      const voteOptionIndex = BigInt(0);
      let stateIndex: bigint;
      let pollId: bigint;
      let poll: Poll;
      const messages: Message[] = [];
      const commands: PCommand[] = [];

      before(() => {
        // Sign up and publish
        const userKeypair = new Keypair(new PrivKey(BigInt(1)));
        stateIndex = BigInt(
          maciState.signUp(userKeypair.pubKey, voiceCreditBalance, BigInt(Math.floor(Date.now() / 1000))),
        );

        pollId = maciState.deployPoll(
          BigInt(Math.floor(Date.now() / 1000) + duration),
          maxValues.maxVoteOptions,
          treeDepths,
          MESSAGE_BATCH_SIZE,
          coordinatorKeypair,
        );

        poll = maciState.polls.get(pollId)!;

        // update the state
        poll.updatePoll(BigInt(maciState.stateLeaves.length));

        // First command (valid)
        const command = new PCommand(
          stateIndex, // BigInt(1),
          userKeypair.pubKey,
          voteOptionIndex, // voteOptionIndex,
          voteWeight, // vote weight
          BigInt(2), // nonce
          BigInt(pollId),
        );

        const signature = command.sign(userKeypair.privKey);

        const ecdhKeypair = new Keypair();
        const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privKey, coordinatorKeypair.pubKey);
        const message = command.encrypt(signature, sharedKey);
        messages.push(message);
        commands.push(command);

        poll.publishMessage(message, ecdhKeypair.pubKey);

        // Second command (valid)
        const command2 = new PCommand(
          stateIndex,
          userKeypair.pubKey,
          voteOptionIndex, // voteOptionIndex,
          BigInt(1), // vote weight
          BigInt(1), // nonce
          BigInt(pollId),
        );
        const signature2 = command2.sign(userKeypair.privKey);

        const ecdhKeypair2 = new Keypair();
        const sharedKey2 = Keypair.genEcdhSharedKey(ecdhKeypair2.privKey, coordinatorKeypair.pubKey);
        const message2 = command2.encrypt(signature2, sharedKey2);
        messages.push(message2);
        commands.push(command2);
        poll.publishMessage(message2, ecdhKeypair2.pubKey);
      });

      it("should produce the correct state root and ballot root", async () => {
        // The current roots
        const emptyBallot = new Ballot(poll.maxVoteOptions, poll.treeDepths.voteOptionTreeDepth);
        const emptyBallotHash = emptyBallot.hash();
        const ballotTree = new IncrementalQuinTree(params.stateTreeDepth, emptyBallot.hash(), STATE_TREE_ARITY, hash5);
        ballotTree.insert(emptyBallot.hash());

        poll.stateLeaves.forEach(() => {
          ballotTree.insert(emptyBallotHash);
        });

        const currentStateRoot = poll.stateTree?.root;
        const currentBallotRoot = ballotTree.root;

        const inputs = poll.processMessages(pollId) as unknown as IProcessMessagesInputs;

        // Calculate the witness
        const witness = await circuit.calculateWitness(inputs);
        await circuit.expectConstraintPass(witness);

        // The new roots, which should differ, since at least one of the
        // messages modified a Ballot or State Leaf
        const newStateRoot = poll.stateTree?.root;
        const newBallotRoot = poll.ballotTree?.root;

        expect(newStateRoot?.toString()).not.to.be.eq(currentStateRoot?.toString());
        expect(newBallotRoot?.toString()).not.to.be.eq(currentBallotRoot.toString());

        const packedVals = packProcessMessageSmallVals(
          BigInt(maxValues.maxVoteOptions),
          BigInt(poll.maciStateRef.numSignUps),
          0,
          2,
        );

        // Test the ProcessMessagesInputHasher circuit
        const hasherCircuitInputs = {
          packedVals,
          coordPubKey: inputs.coordPubKey,
          outputBatchHash: inputs.outputBatchHash,
          currentSbCommitment: inputs.currentSbCommitment,
          newSbCommitment: inputs.newSbCommitment,
          actualStateTreeDepth: inputs.actualStateTreeDepth,
        };

        const hasherWitness = await hasherCircuit.calculateWitness(hasherCircuitInputs);
        await hasherCircuit.expectConstraintPass(hasherWitness);
        const hash = await getSignal(hasherCircuit, hasherWitness, "hash");
        expect(hash.toString()).to.be.eq(inputs.inputHash.toString());
      });
    });

    describe("TallyVotes circuit", function test() {
      this.timeout(900000);

      let testCircuit: WitnessTester<
        [
          "stateRoot",
          "ballotRoot",
          "sbSalt",
          "packedVals",
          "sbCommitment",
          "currentTallyCommitment",
          "newTallyCommitment",
          "inputHash",
          "ballots",
          "ballotPathElements",
          "votes",
          "currentResults",
          "currentResultsRootSalt",
          "currentSpentVoiceCreditSubtotal",
          "currentSpentVoiceCreditSubtotalSalt",
          "currentPerVOSpentVoiceCredits",
          "currentPerVOSpentVoiceCreditsRootSalt",
          "newResultsRootSalt",
          "newPerVOSpentVoiceCreditsRootSalt",
          "newSpentVoiceCreditSubtotalSalt",
        ]
      >;

      before(async () => {
        testCircuit = await circomkitInstance.WitnessTester("tallyVotes", {
          file: "./core/qv/tallyVotes",
          template: "TallyVotes",
          params: [14, 1, 3],
        });
      });

      describe("1 user, 2 messages", () => {
        let stateIndex: bigint;
        let pollId: bigint;
        let poll: Poll;
        let maciState: MaciState;
        const voteWeight = BigInt(9);
        const voteOptionIndex = BigInt(0);

        beforeEach(() => {
          maciState = new MaciState(params.stateTreeDepth);
          const messages: Message[] = [];
          const commands: PCommand[] = [];
          // Sign up and publish
          const userKeypair = new Keypair();
          stateIndex = BigInt(
            maciState.signUp(userKeypair.pubKey, voiceCreditBalance, BigInt(Math.floor(Date.now() / 1000))),
          );

          pollId = maciState.deployPoll(
            BigInt(Math.floor(Date.now() / 1000) + duration),
            maxValues.maxVoteOptions,
            treeDepths,
            MESSAGE_BATCH_SIZE,
            coordinatorKeypair,
          );

          poll = maciState.polls.get(pollId)!;

          // update the state
          poll.updatePoll(BigInt(maciState.stateLeaves.length));

          // First command (valid)
          const command = new PCommand(
            stateIndex,
            userKeypair.pubKey,
            voteOptionIndex, // voteOptionIndex,
            voteWeight, // vote weight
            BigInt(1), // nonce
            BigInt(pollId),
          );

          const signature = command.sign(userKeypair.privKey);

          const ecdhKeypair = new Keypair();
          const sharedKey = Keypair.genEcdhSharedKey(ecdhKeypair.privKey, coordinatorKeypair.pubKey);
          const message = command.encrypt(signature, sharedKey);
          messages.push(message);
          commands.push(command);

          poll.publishMessage(message, ecdhKeypair.pubKey);

          // Process messages
          poll.processMessages(pollId);
        });

        it("should produce the correct result commitments", async () => {
          const generatedInputs = poll.tallyVotes() as unknown as ITallyVotesInputs;
          const witness = await testCircuit.calculateWitness(generatedInputs);
          await testCircuit.expectConstraintPass(witness);
        });

        it("should produce the correct result if the initial tally is not zero", async () => {
          const generatedInputs = poll.tallyVotes() as unknown as ITallyVotesInputs;

          // Start the tally from non-zero value
          let randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
          while (randIdx === 0) {
            randIdx = generateRandomIndex(Object.keys(generatedInputs).length);
          }

          generatedInputs.currentResults[randIdx] = 1n;

          const witness = await testCircuit.calculateWitness(generatedInputs);
          await testCircuit.expectConstraintPass(witness);
        });
      });
    });
  });
});
