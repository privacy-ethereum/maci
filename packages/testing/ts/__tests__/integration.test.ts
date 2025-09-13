/* eslint-disable no-await-in-loop */
import { MaciState, type ITreeDepths, VOTE_OPTION_TREE_ARITY } from "@maci-protocol/core";
import { generatePublicKey, generateRandomSalt, poseidon } from "@maci-protocol/crypto";
import { Keypair, VoteCommand, PrivateKey, PublicKey } from "@maci-protocol/domainobjs";
import {
  cidToBytes32,
  createCidFromObject,
  generateVote,
  getBlockTimestamp,
  getDefaultSigner,
  relayMessages,
  signup,
  mergeSignups,
  verify,
  generateTallyCommitments,
  getPollParams,
  setVerifyingKeys,
  EMode,
  extractAllVerifyingKeys,
  proveOnChain,
  joinPoll,
  publish,
  deployPoll,
  generateProofs,
  deployVerifyingKeysRegistryContract,
  timeTravel,
  deployMaci,
  type IMaciContracts,
  deployFreeForAllSignUpPolicy,
  deployConstantInitialVoiceCreditProxy,
  deployVerifier,
  deployConstantInitialVoiceCreditProxyFactory,
} from "@maci-protocol/sdk";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { type Signer } from "ethers";

import fs from "fs";
import { homedir } from "os";
import path from "path";

import {
  DEFAULT_INITIAL_VOICE_CREDITS,
  DEFAULT_VOTE_OPTIONS,
  TALLY_PROCESSING_STATE_TREE_DEPTH,
  MESSAGE_BATCH_SIZE,
  STATE_TREE_DEPTH,
  VOTE_OPTION_TREE_DEPTH,
  pollDuration,
  maxMessages,
  maxVoteOptions,
  POLL_STATE_TREE_DEPTH,
} from "../constants";
import { type ITestSuite } from "../types";
import { expectTally, generateTestUserCommands, writeBackupFile, backupFolder } from "../utils";

chai.use(chaiAsPromised);

const { expect } = chai;

/**
 * MACI Integration tests
 * @dev These tests use the cli code to perform full testing of the
 * protocol.
 */
describe("Integration tests", function test() {
  this.timeout(10000000);

  // check on which system we are running
  const useWasm = false;

  // global variables we need shared between tests
  let maciState: MaciState;
  let contracts: IMaciContracts;
  let pollId: bigint;
  let signer: Signer;
  const coordinatorKeypair = new Keypair();

  let verifyingKeysRegistryAddress: string;

  const root = path.resolve(__dirname, "../../../..");

  // the code that we run before all tests
  before(async () => {
    signer = await getDefaultSigner();
    // 1. deploy verifying key Registry
    verifyingKeysRegistryAddress = await deployVerifyingKeysRegistryContract({ signer });
    // 2. set verifying keys
    const { pollJoiningVerifyingKey, pollJoinedVerifyingKey, processVerifyingKey, tallyVerifyingKey } =
      await extractAllVerifyingKeys({
        pollJoiningZkeyPath: path.resolve(root, "./zkeys/PollJoining_10_test/PollJoining_10_test.0.zkey"),
        pollJoinedZkeyPath: path.resolve(root, "./zkeys/PollJoined_10_test/PollJoined_10_test.0.zkey"),
        messageProcessorZkeyPath: path.resolve(
          root,
          "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test.0.zkey",
        ),
        voteTallyZkeyPath: path.resolve(root, "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test.0.zkey"),
      });

    await setVerifyingKeys({
      stateTreeDepth: STATE_TREE_DEPTH,
      pollStateTreeDepth: POLL_STATE_TREE_DEPTH,
      tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
      voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
      messageBatchSize: MESSAGE_BATCH_SIZE,
      modes: [EMode.QV],
      pollJoiningVerifyingKey: pollJoiningVerifyingKey!,
      pollJoinedVerifyingKey: pollJoinedVerifyingKey!,
      processMessagesVerifyingKeys: [processVerifyingKey!],
      tallyVotesVerifyingKeys: [tallyVerifyingKey!],
      verifyingKeysRegistryAddress,
      signer,
    });
  });

  // the code that we run before each test
  beforeEach(async () => {
    const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
      {},
      signer,
      true,
    );
    const signupPolicyAddress = await signupPolicy.getAddress();

    const [pollPolicy] = await deployFreeForAllSignUpPolicy(
      {
        policy: signupPolicyFactory,
        checker: signupCheckerFactory,
      },
      signer,
      true,
    );
    const pollPolicyAddress = await pollPolicy.getAddress();

    // create a new maci state
    maciState = new MaciState(STATE_TREE_DEPTH);

    // 3. deploy maci
    contracts = await deployMaci({
      stateTreeDepth: STATE_TREE_DEPTH,
      signupPolicyAddress,
      signer,
    });

    const constantInitialVoiceCreditProxyFactory = await deployConstantInitialVoiceCreditProxyFactory(signer, true);
    const initialVoiceCreditProxy = await deployConstantInitialVoiceCreditProxy(
      { amount: DEFAULT_INITIAL_VOICE_CREDITS },
      constantInitialVoiceCreditProxyFactory,
      signer,
    );
    const initialVoiceCreditProxyContractAddress = await initialVoiceCreditProxy.getAddress();
    const verifier = await deployVerifier(signer, true);
    const verifierContractAddress = await verifier.getAddress();

    const startDate = await getBlockTimestamp(signer);

    // 4. create a poll
    await deployPoll({
      pollEndTimestamp: startDate + pollDuration,
      pollStartTimestamp: startDate,
      tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
      messageBatchSize: MESSAGE_BATCH_SIZE,
      stateTreeDepth: POLL_STATE_TREE_DEPTH,
      voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
      coordinatorPublicKey: coordinatorKeypair.publicKey,
      maciAddress: contracts.maciContractAddress,
      signer,
      mode: EMode.QV,
      initialVoiceCreditProxyContractAddress,
      verifierContractAddress,
      verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
      policyContractAddress: pollPolicyAddress,
      initialVoiceCredits: DEFAULT_INITIAL_VOICE_CREDITS,
      voteOptions: DEFAULT_VOTE_OPTIONS,
      relayers: [await signer.getAddress()],
    });

    const treeDepths: ITreeDepths = {
      tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
      voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
      stateTreeDepth: POLL_STATE_TREE_DEPTH,
    };

    const messageBatchSize = MESSAGE_BATCH_SIZE;

    pollId = maciState.deployPoll(
      BigInt(startDate + pollDuration),
      treeDepths,
      messageBatchSize,
      coordinatorKeypair,
      BigInt(maxVoteOptions),
      EMode.QV,
    );
  });

  // after each test we need to cleanup some files
  afterEach(async () => {
    if (fs.existsSync("./tally.json")) {
      await fs.promises.unlink("./tally.json");
    }

    const proofDirectory = "./proofs/";

    if (!fs.existsSync(proofDirectory)) {
      return;
    }

    const files = await fs.promises.readdir(proofDirectory);

    await Promise.all(files.map((file) => fs.promises.unlink(path.resolve(proofDirectory, file))));

    if (fs.existsSync(backupFolder)) {
      await fs.promises.rm(backupFolder, { recursive: true, force: true });
    }
  });

  // read the test suite data
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, `./data/suites.json`)).toString()) as {
    suites: ITestSuite[];
  };

  data.suites.forEach((testCase) => {
    const DEFAULT_SG_DATA = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const DEFAULT_IVCP_DATA = "0x0000000000000000000000000000000000000000000000000000000000000000";

    it(testCase.description, async () => {
      const users = generateTestUserCommands(
        testCase.numUsers,
        testCase.numVotesPerUser,
        testCase.bribers,
        testCase.votes,
      );

      // loop through all users and generate keypair + signup
      for (let i = 0; i < users.length; i += 1) {
        const user = users[i];
        // signup
        const stateIndex = BigInt(
          await signup({
            maciPublicKey: user.keypair.publicKey.serialize(),
            maciAddress: contracts.maciContractAddress,
            sgData: DEFAULT_SG_DATA,
            signer,
          }).then((result) => result.stateIndex),
        );

        await joinPoll({
          maciAddress: contracts.maciContractAddress,
          privateKey: user.keypair.privateKey.serialize(),
          pollId,
          pollJoiningZkey: path.resolve(root, "./zkeys/PollJoining_10_test/PollJoining_10_test.0.zkey"),
          useWasm,
          pollWasm: path.resolve(root, "./zkeys/PollJoining_10_test/PollJoining_10_test_js/PollJoining_10_test.wasm"),
          pollWitnessGenerator: path.resolve(
            root,
            "./zkeys/PollJoining_10_test/PollJoining_10_test_cpp/PollJoining_10_test",
          ),
          rapidsnark: `${homedir()}/rapidsnark/build/prover`,
          sgDataArg: DEFAULT_SG_DATA,
          ivcpDataArg: DEFAULT_IVCP_DATA,
          signer,
        });

        // signup on local maci state
        maciState.signUp(user.keypair.publicKey);

        // join the poll on local
        const inputNullifier = BigInt(user.keypair.privateKey.asCircuitInputs());
        const nullifier = poseidon([inputNullifier]);
        const poll = maciState.polls.get(pollId);
        poll?.joinPoll(nullifier, user.keypair.publicKey, BigInt(DEFAULT_INITIAL_VOICE_CREDITS));

        // publish messages
        for (let j = 0; j < user.votes.length; j += 1) {
          const isKeyChange = testCase.changeUsersKeys && j in testCase.changeUsersKeys[i];
          const voteOptionIndex = isKeyChange
            ? testCase.changeUsersKeys?.[i][j].voteOptionIndex
            : user.votes[j].voteOptionIndex;
          const newVoteWeight = isKeyChange ? testCase.changeUsersKeys?.[i][j].voteWeight : user.votes[j].voteWeight;
          const { nonce } = user.votes[j];
          const salt = generateRandomSalt();

          // store the previous keypair
          const oldKeypair = user.keypair;
          // change
          if (isKeyChange) {
            user.changeKeypair();
          }

          // Generate vote for relayer
          const vote = generateVote({
            pollId,
            voteOptionIndex: voteOptionIndex!,
            salt,
            nonce,
            privateKey: isKeyChange ? oldKeypair.privateKey : user.keypair.privateKey,
            stateIndex,
            voteWeight: newVoteWeight!,
            coordinatorPublicKey: coordinatorKeypair.publicKey,
            maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** VOTE_OPTION_TREE_DEPTH),
            newPublicKey: user.keypair.publicKey,
          });

          const messages = [
            {
              maciAddress: contracts.maciContractAddress,
              poll: Number(pollId),
              data: vote.message.data.map(String),
              publicKey: vote.ephemeralKeypair.publicKey.asArray().map(String),
              hash: vote.message.hash(vote.ephemeralKeypair.publicKey).toString(),
            },
          ];

          const cid = await createCidFromObject(messages);
          const ipfsHash = await cidToBytes32(cid);

          await writeBackupFile(ipfsHash, messages);

          // actually publish it
          const encryptionKey =
            nonce % 2n === 0n
              ? await publish({
                  publicKey: user.keypair.publicKey.serialize(),
                  stateIndex,
                  voteOptionIndex: voteOptionIndex!,
                  nonce,
                  pollId,
                  newVoteWeight: newVoteWeight!,
                  maciAddress: contracts.maciContractAddress,
                  salt,
                  // if it's a key change command, then we pass the old private key otherwise just pass the current
                  privateKey: isKeyChange ? oldKeypair.privateKey.serialize() : user.keypair.privateKey.serialize(),
                  signer,
                }).then(({ privateKey }) => privateKey)
              : await relayMessages({
                  maciAddress: contracts.maciContractAddress,
                  ipfsHash,
                  messages,
                  pollId: Number(pollId),
                  signer,
                }).then(() => vote.ephemeralKeypair.privateKey.serialize());

          const encryptionPrivateKey = PrivateKey.deserialize(encryptionKey);
          const encryptionPublicKey = new PublicKey(generatePublicKey(encryptionPrivateKey.raw));

          // create the command to add to the local state
          const command = new VoteCommand(
            stateIndex,
            user.keypair.publicKey,
            voteOptionIndex!,
            newVoteWeight!,
            nonce,
            pollId,
            salt,
          );
          const signature = command.sign(isKeyChange ? oldKeypair.privateKey : user.keypair.privateKey);
          const message = command.encrypt(
            signature,
            Keypair.generateEcdhSharedKey(encryptionPrivateKey, coordinatorKeypair.publicKey),
          );
          maciState.polls.get(pollId)?.publishMessage(message, encryptionPublicKey);
        }
      }

      await timeTravel({ seconds: pollDuration, signer });

      // merge signups
      await expect(mergeSignups({ pollId, maciAddress: contracts.maciContractAddress, signer })).to.not.be.rejected;

      const ipfsMessageBackupFiles = await fs.promises
        .readdir(backupFolder)
        .then((paths) => paths.map((filename) => path.resolve(backupFolder, filename)));

      // generate proofs
      const { tallyData } = await generateProofs({
        outputDir: "./proofs",
        tallyFile: "./tally.json",
        voteTallyZkey: path.resolve(root, "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test.0.zkey"),
        messageProcessorZkey: path.resolve(
          root,
          "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test.0.zkey",
        ),
        pollId,
        rapidsnark: `${homedir()}/rapidsnark/build/prover`,
        messageProcessorWitnessGenerator: path.resolve(
          root,
          "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test_cpp/MessageProcessorQv_10-20-2_test",
        ),
        messageProcessorWitnessDatFile: path.resolve(
          root,
          "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test_cpp/MessageProcessorQv_10-20-2_test.dat",
        ),
        voteTallyWitnessGenerator: path.resolve(
          root,
          "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test_cpp/VoteTallyQv_10-1-2_test",
        ),
        voteTallyWitnessDatFile: path.resolve(
          root,
          "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test_cpp/VoteTallyQv_10-1-2_test.dat",
        ),
        coordinatorPrivateKey: coordinatorKeypair.privateKey.serialize(),
        maciAddress: contracts.maciContractAddress,
        messageProcessorWasm: path.resolve(
          root,
          "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test_js/MessageProcessorQv_10-20-2_test.wasm",
        ),
        voteTallyWasm: path.resolve(
          root,
          "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test_js/VoteTallyQv_10-1-2_test.wasm",
        ),
        useWasm,
        mode: EMode.QV,
        ipfsMessageBackupFiles,
        signer,
      });
      expect(tallyData).to.not.eq(undefined);

      // verify that the data stored on the tally file is correct
      expectTally(
        maxMessages,
        testCase.expectedTally,
        testCase.expectedSpentVoiceCredits,
        testCase.expectedTotalSpentVoiceCredits,
        tallyData,
      );

      // prove on chain if everything matches
      await expect(
        proveOnChain({
          pollId,
          tallyFile: "./tally.json",
          proofDir: "./proofs",
          maciAddress: contracts.maciContractAddress,
          signer,
        }),
      ).to.not.be.rejected;

      const pollParams = await getPollParams({ pollId: 0n, maciContractAddress: tallyData.maci, signer });
      const tallyCommitments = generateTallyCommitments({
        tallyData,
        voteOptionTreeDepth: pollParams.voteOptionTreeDepth,
      });

      // verify the proofs
      await expect(
        verify({
          pollId,
          tallyData,
          maciAddress: contracts.maciContractAddress,
          tallyCommitments,
          totalVoteOptions: pollParams.totalVoteOptions,
          voteOptionTreeDepth: pollParams.voteOptionTreeDepth,
          signer,
        }),
      ).to.not.be.rejected;
    });
  });
});
