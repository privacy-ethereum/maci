import { Keypair, type VerifyingKey } from "@maci-protocol/domainobjs";
import {
  EMode,
  extractAllVerifyingKeys,
  generateTallyCommitments,
  getPollParams,
  type ICheckVerifyingKeysArgs,
  type IDeployPollArgs,
  type ISetVerifyingKeysArgs,
  type ITallyData,
  type IMergeSignupsArgs,
  type IVerifyArgs,
  type IProveOnChainArgs,
  type ITimeTravelArgs,
  type IDeployMaciArgs,
} from "@maci-protocol/sdk";

import { homedir } from "os";
import path from "path";

import type { Signer } from "ethers";

import { readJSONFile } from "./utils";

export const STATE_TREE_DEPTH = 10;
export const POLL_STATE_TREE_DEPTH = 10;
export const TALLY_PROCESSING_STATE_TREE_DEPTH = 1;
export const VOTE_OPTION_TREE_DEPTH = 2;
export const MESSAGE_BATCH_SIZE = 20;
export const DEFAULT_INITIAL_VOICE_CREDITS = 100;
export const DEFAULT_VOTE_OPTIONS = 25;
export const DEFAULT_SG_DATA = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const DEFAULT_IVCP_DATA = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const coordinatorKeypair = new Keypair();
export const coordinatorPublicKey = coordinatorKeypair.publicKey.serialize();
export const coordinatorPrivateKey = coordinatorKeypair.privateKey.serialize();
export const pollDuration = 2000;
export const maxMessages = 25;
export const maxVoteOptions = 25;

export const testRapidsnarkPath = `${homedir()}/rapidsnark/build/prover`;
export const testTallyFilePath = "./tally.json";
export const testProofsDirPath = "./proofs";

const root = path.resolve(__dirname, "../../..");

// Poll joining paths
export const testPollJoiningZkeyPath = path.resolve(root, "./zkeys/PollJoining_10_test/PollJoining_10_test.0.zkey");
export const testPollJoiningWitnessPath = path.resolve(
  root,
  "./zkeys/PollJoining_10_test/PollJoining_10_test_cpp/PollJoining_10_test",
);
export const testPollJoiningWasmPath = path.resolve(
  root,
  "./zkeys/PollJoining_10_test/PollJoining_10_test_js/PollJoining_10_test.wasm",
);

// Poll joined paths
export const testPollJoinedZkeyPath = path.resolve(root, "./zkeys/PollJoined_10_test/PollJoined_10_test.0.zkey");
export const testPollJoinedWitnessPath = path.resolve(
  root,
  "./zkeys/PollJoined_10_test/PollJoined_10_test_cpp/PollJoined_10_test",
);
export const testPollJoinedWasmPath = path.resolve(
  root,
  "./zkeys/PollJoined_10_test/PollJoined_10_test_js/PollJoined_10_test.wasm",
);

// Process messages QV paths
export const testProcessMessageZkeyPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test.0.zkey",
);
export const testProcessMessagesWitnessPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test_cpp/MessageProcessorQv_10-20-2_test",
);
export const testProcessMessagesWitnessDatPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test_cpp/MessageProcessorQv_10-20-2_test.dat",
);
export const testProcessMessagesWasmPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_10-20-2_test/MessageProcessorQv_10-20-2_test_js/MessageProcessorQv_10-20-2_test.wasm",
);

// Process messages ceremony QV paths
export const ceremonyProcessMessagesZkeyPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_6-9-2-3/processMessages_6-9-2-3.zkey",
);
export const ceremonyProcessMessagesWitnessPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_14-9-2-3/MessageProcessorQv_14-9-2-3_cpp/MessageProcessorQv_14-9-2-3",
);
export const ceremonyProcessMessagesDatPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_14-9-2-3/MessageProcessorQv_14-9-2-3_cpp/MessageProcessorQv_14-9-2-3.dat",
);
export const ceremonyProcessMessagesWasmPath = path.resolve(
  root,
  "./zkeys/MessageProcessorQv_14-9-2-3/MessageProcessorQv_14-9-2-3_js/MessageProcessorQv_14-9-2-3.wasm",
);

// Process messages Non-QV paths
export const testProcessMessageNonQvZkeyPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_10-20-2_test/MessageProcessorNonQv_10-20-2_test.0.zkey",
);
export const testProcessMessagesNonQvWitnessPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_10-20-2_test/MessageProcessorNonQv_10-20-2_test_cpp/MessageProcessorNonQv_10-20-2_test",
);
export const testProcessMessagesNonQvWitnessDatPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_10-20-2_test/MessageProcessorNonQv_10-20-2_test_cpp/MessageProcessorNonQv_10-20-2_test.dat",
);
export const testProcessMessagesNonQvWasmPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_10-20-2_test/MessageProcessorNonQv_10-20-2_test_js/MessageProcessorNonQv_10-20-2_test.wasm",
);

// Process messages ceremony Non-QV paths
export const ceremonyProcessMessagesNonQvZkeyPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_6-9-2-3/MessageProcessorNonQv_6-9-2-3.zkey",
);
export const ceremonyProcessMessagesNonQvWitnessPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_14-9-2-3/MessageProcessorNonQv_14-9-2-3_cpp/MessageProcessorNonQv_14-9-2-3",
);
export const ceremonyProcessMessagesNonQvDatPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_14-9-2-3/MessageProcessorNonQv_14-9-2-3_cpp/MessageProcessorNonQv_14-9-2-3.dat",
);
export const ceremonyProcessMessagesNonQvWasmPath = path.resolve(
  root,
  "./zkeys/MessageProcessorNonQv_14-9-2-3/MessageProcessorNonQv_14-9-2-3_js/MessageProcessorNonQv_14-9-2-3.wasm",
);

// Process messages Full paths
export const testProcessMessageFullZkeyPath = path.resolve(
  root,
  "./zkeys/MessageProcessorFull_10-20-2_test/MessageProcessorFull_10-20-2_test.0.zkey",
);
export const testProcessMessagesFullWitnessPath = path.resolve(
  root,
  "./zkeys/MessageProcessorFull_10-20-2_test/MessageProcessorFull_10-20-2_test_cpp/MessageProcessorFull_10-20-2_test",
);
export const testProcessMessagesFullWitnessDatPath = path.resolve(
  root,
  "./zkeys/MessageProcessorFull_10-20-2_test/MessageProcessorFull_10-20-2_test_cpp/MessageProcessorFull_10-20-2_test.dat",
);
export const testProcessMessagesFullWasmPath = path.resolve(
  root,
  "./zkeys/MessageProcessorFull_10-20-2_test/MessageProcessorFull_10-20-2_test_js/MessageProcessorFull_10-20-2_test.wasm",
);

// Tally votes QV paths
export const testTallyVotesZkeyPath = path.resolve(
  root,
  "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test.0.zkey",
);
export const testTallyVotesWitnessPath = path.resolve(
  root,
  "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test_cpp/VoteTallyQv_10-1-2_test",
);
export const testTallyVotesWitnessDatPath = path.resolve(
  root,
  "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test_cpp/VoteTallyQv_10-1-2_test.dat",
);
export const testTallyVotesWasmPath = path.resolve(
  root,
  "./zkeys/VoteTallyQv_10-1-2_test/VoteTallyQv_10-1-2_test_js/VoteTallyQv_10-1-2_test.wasm",
);

// Tally votes ceremony QV paths
export const ceremonyTallyVotesZkeyPath = path.resolve(root, "./zkeys/VoteTallyQv_6-2-3/tallyVotes_6-2-3.zkey");
export const ceremonyTallyVotesWitnessPath = path.resolve(
  root,
  "./zkeys/VoteTallyQv_14-5-3/VoteTallyQv_14-5-3_cpp/VoteTallyQv_14-5-3",
);
export const ceremonyTallyVotesDatPath = path.resolve(
  root,
  "./zkeys/VoteTallyQv_14-5-3/VoteTallyQv_14-5-3_cpp/VoteTallyQv_14-5-3.dat",
);
export const ceremonyTallyVotesWasmPath = path.resolve(
  root,
  "./zkeys/VoteTallyQv_14-5-3/VoteTallyQv_14-5-3_js/VoteTallyQv_14-5-3.wasm",
);

// Tally votes Non-QV paths
export const testVoteTallyNonQvZkeyPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test.0.zkey",
);
export const testVoteTallyNonQvWitnessPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test_cpp/VoteTallyNonQv_10-1-2_test",
);
export const testVoteTallyNonQvWitnessDatPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test_cpp/VoteTallyNonQv_10-1-2_test.dat",
);
export const testVoteTallyNonQvWasmPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test_js/VoteTallyNonQv_10-1-2_test.wasm",
);

// Tally votes ceremony Non-QV paths
export const ceremonyVoteTallyNonQvZkeyPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_6-2-3/tallyVotesNonQv_6-2-3.zkey",
);
export const ceremonyVoteTallyNonQvWitnessPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_14-5-3/VoteTallyNonQv_14-5-3_cpp/VoteTallyNonQv_14-5-3",
);
export const ceremonyVoteTallyNonQvDatPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_14-5-3/VoteTallyNonQv_14-5-3_cpp/VoteTallyNonQv_14-5-3.dat",
);
export const ceremonyVoteTallyNonQvWasmPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_14-5-3/VoteTallyNonQv_14-5-3_js/VoteTallyNonQv_14-5-3.wasm",
);

// Tally votes Full paths
export const testTallyVotesFullZkeyPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test.0.zkey",
);
export const testTallyVotesFullWitnessPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test_cpp/VoteTallyNonQv_10-1-2_test",
);
export const testTallyVotesFullWitnessDatPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test_cpp/VoteTallyNonQv_10-1-2_test.dat",
);
export const testTallyVotesFullWasmPath = path.resolve(
  root,
  "./zkeys/VoteTallyNonQv_10-1-2_test/VoteTallyNonQv_10-1-2_test_js/VoteTallyNonQv_10-1-2_test.wasm",
);

export const checkVerifyingKeysArgs: Omit<ICheckVerifyingKeysArgs, "verifyingKeysRegistry" | "signer"> = {
  stateTreeDepth: STATE_TREE_DEPTH,
  tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
  voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
  messageBatchSize: MESSAGE_BATCH_SIZE,
  pollJoiningZkeyPath: testPollJoiningZkeyPath,
  pollJoinedZkeyPath: testPollJoinedZkeyPath,
  messageProcessorZkeyPath: testProcessMessageZkeyPath,
  voteTallyZkeyPath: testTallyVotesZkeyPath,
};

export const timeTravelArgs: Omit<ITimeTravelArgs, "signer"> = {
  seconds: pollDuration,
};

export const mergeSignupsArgs: Omit<IMergeSignupsArgs, "maciAddress" | "signer"> = {
  pollId: 0n,
};

export const proveOnChainArgs: Omit<IProveOnChainArgs, "maciAddress" | "signer"> = {
  pollId: 0n,
  tallyFile: testTallyFilePath,
  proofDir: testProofsDirPath,
};

export const verifyArgs = async (signer: Signer): Promise<IVerifyArgs> => {
  const tallyData = await readJSONFile<ITallyData>(testTallyFilePath);
  const pollParams = await getPollParams({ pollId: 0n, maciContractAddress: tallyData.maci, signer });
  const tallyCommitments = generateTallyCommitments({
    tallyData,
    voteOptionTreeDepth: pollParams.voteOptionTreeDepth,
  });

  return {
    pollId: 0n,
    tallyData,
    maciAddress: tallyData.maci,
    tallyCommitments,
    totalVoteOptions: tallyData.results.tally.length,
    voteOptionTreeDepth: pollParams.voteOptionTreeDepth,
    signer,
  };
};

const zkeysByMode = {
  [EMode.QV]: {
    messageProcessorZkeyPath: testProcessMessageZkeyPath,
    voteTallyZkeyPath: testTallyVotesZkeyPath,
  },
  [EMode.NON_QV]: {
    messageProcessorZkeyPath: testProcessMessageNonQvZkeyPath,
    voteTallyZkeyPath: testVoteTallyNonQvZkeyPath,
  },
  [EMode.FULL]: {
    messageProcessorZkeyPath: testProcessMessageFullZkeyPath,
    voteTallyZkeyPath: testTallyVotesFullZkeyPath,
  },
};

export const verifyingKeysArgs = async (
  signer: Signer,
  modes = [EMode.QV],
): Promise<Omit<ISetVerifyingKeysArgs, "verifyingKeysRegistryAddress">> => {
  const { pollJoiningVerifyingKey, pollJoinedVerifyingKey } = await extractAllVerifyingKeys({
    pollJoiningZkeyPath: testPollJoiningZkeyPath,
    pollJoinedZkeyPath: testPollJoinedZkeyPath,
  });

  const keysResults = await Promise.all(
    modes.map((mode) => {
      const { messageProcessorZkeyPath, voteTallyZkeyPath } = zkeysByMode[mode];

      return extractAllVerifyingKeys({
        messageProcessorZkeyPath,
        voteTallyZkeyPath,
      });
    }),
  );

  const processMessagesVerifyingKeys: VerifyingKey[] = [];
  const tallyVotesVerifyingKeys: VerifyingKey[] = [];

  keysResults.forEach(({ processVerifyingKey, tallyVerifyingKey }, idx) => {
    if (!processVerifyingKey || !tallyVerifyingKey) {
      throw new Error(`Verifying keys for mode ${modes[idx]} are not valid`);
    }

    processMessagesVerifyingKeys.push(processVerifyingKey);
    tallyVotesVerifyingKeys.push(tallyVerifyingKey);
  });

  return {
    stateTreeDepth: STATE_TREE_DEPTH,
    pollStateTreeDepth: POLL_STATE_TREE_DEPTH,
    tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
    voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
    messageBatchSize: MESSAGE_BATCH_SIZE,
    pollJoiningVerifyingKey: pollJoiningVerifyingKey!,
    pollJoinedVerifyingKey: pollJoinedVerifyingKey!,
    processMessagesVerifyingKeys,
    tallyVotesVerifyingKeys,
    modes,
    signer,
  };
};

export const deployArgs: Omit<IDeployMaciArgs, "signer" | "signupPolicyAddress"> = {
  stateTreeDepth: STATE_TREE_DEPTH,
};

export const deployPollArgs: Omit<
  IDeployPollArgs,
  | "relayers"
  | "signer"
  | "pollStartTimestamp"
  | "pollEndTimestamp"
  | "maciAddress"
  | "verifierContractAddress"
  | "verifyingKeysRegistryContractAddress"
  | "policyContractAddress"
  | "initialVoiceCreditProxyContractAddress"
> = {
  tallyProcessingStateTreeDepth: TALLY_PROCESSING_STATE_TREE_DEPTH,
  messageBatchSize: MESSAGE_BATCH_SIZE,
  stateTreeDepth: POLL_STATE_TREE_DEPTH,
  voteOptionTreeDepth: VOTE_OPTION_TREE_DEPTH,
  coordinatorPublicKey: coordinatorKeypair.publicKey,
  initialVoiceCredits: DEFAULT_INITIAL_VOICE_CREDITS,
  mode: EMode.QV,
  voteOptions: DEFAULT_VOTE_OPTIONS,
};

export const invalidVote = {
  voteWeight: 2n,
  nonce: 0n,
  maxVoteWeight: 1n,
  voteCreditBalance: 1n,
};
