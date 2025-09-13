import { EMode, VOTE_OPTION_TREE_ARITY } from "@maci-protocol/core";
import { generateRandomSalt } from "@maci-protocol/crypto";
import { Keypair } from "@maci-protocol/domainobjs";
import {
  generateVote,
  getBlockTimestamp,
  getDefaultSigner,
  getSignedupUserData,
  signup,
  mergeSignups,
  verify,
  setVerifyingKeys,
  generateMaciState,
  joinPoll,
  getJoinedUserData,
  proveOnChain,
  publish,
  deployPoll,
  generateProofs,
  deployVerifyingKeysRegistryContract,
  timeTravel,
  type IGenerateProofsArgs,
  deployMaci,
  type IMaciContracts,
  deployFreeForAllSignUpPolicy,
  deployConstantInitialVoiceCreditProxy,
  deployVerifier,
  deployConstantInitialVoiceCreditProxyFactory,
} from "@maci-protocol/sdk";
import { expect } from "chai";

import fs from "fs";

import type { Signer } from "ethers";

import {
  DEFAULT_IVCP_DATA,
  DEFAULT_SG_DATA,
  DEFAULT_INITIAL_VOICE_CREDITS,
  deployPollArgs,
  coordinatorPrivateKey,
  pollDuration,
  proveOnChainArgs,
  verifyArgs,
  mergeSignupsArgs,
  testPollJoiningZkeyPath,
  testProcessMessageZkeyPath,
  testTallyVotesZkeyPath,
  testPollJoiningWasmPath,
  testProcessMessagesWasmPath,
  testPollJoiningWitnessPath,
  testProcessMessagesWitnessDatPath,
  testProcessMessagesWitnessPath,
  testProofsDirPath,
  testRapidsnarkPath,
  testTallyFilePath,
  testTallyVotesWasmPath,
  testTallyVotesWitnessDatPath,
  testTallyVotesWitnessPath,
  deployArgs,
  timeTravelArgs,
  coordinatorKeypair,
  verifyingKeysArgs,
} from "../constants";
import { clean, getBackupFilenames, relayTestMessages } from "../utils";

/**
 Test scenarios:
    4 signups, 8 messages, 16 relayed messages
    8 signups (same key), 12 messages (same message), 12 relayed messages (same message)
    30 signups (31 ballots), 4 messages
    30 signups (31 ballots), 4 messages, 3 relayed messages
    multiple polls tests
    2 signups (1 after stateAq is merged and logs are fetched), 1 message
    30 signups (31 ballots), 21 messages (> 1 batch)
    1 signup and 1 valid message for multiple polls
    7 signups and 1 message, another polls and 6 messages
 */
describe("e2e tests", function test() {
  const useWasm = false;
  this.timeout(900000);

  let maciAddresses: IMaciContracts;
  let verifyingKeysRegistryAddress: string;
  let initialVoiceCreditProxyContractAddress: string;
  let verifierContractAddress: string;
  let signer: Signer;

  const generateProofsArgs: Omit<IGenerateProofsArgs, "maciAddress" | "signer"> = {
    outputDir: testProofsDirPath,
    tallyFile: testTallyFilePath,
    voteTallyZkey: testTallyVotesZkeyPath,
    messageProcessorZkey: testProcessMessageZkeyPath,
    pollId: 0n,
    rapidsnark: testRapidsnarkPath,
    messageProcessorWitnessGenerator: testProcessMessagesWitnessPath,
    messageProcessorWitnessDatFile: testProcessMessagesWitnessDatPath,
    voteTallyWitnessGenerator: testTallyVotesWitnessPath,
    voteTallyWitnessDatFile: testTallyVotesWitnessDatPath,
    coordinatorPrivateKey,
    messageProcessorWasm: testProcessMessagesWasmPath,
    voteTallyWasm: testTallyVotesWasmPath,
    useWasm,
    mode: EMode.QV,
  };

  // before all tests we deploy the verifying keys registry contract and set the verifying keys
  before(async () => {
    signer = await getDefaultSigner();

    // we deploy the verifying keys registry contract
    verifyingKeysRegistryAddress = await deployVerifyingKeysRegistryContract({ signer });

    const constantInitialVoiceCreditProxyFactory = await deployConstantInitialVoiceCreditProxyFactory(signer, true);
    const initialVoiceCreditProxy = await deployConstantInitialVoiceCreditProxy(
      { amount: DEFAULT_INITIAL_VOICE_CREDITS },
      constantInitialVoiceCreditProxyFactory,
      signer,
    );
    initialVoiceCreditProxyContractAddress = await initialVoiceCreditProxy.getAddress();

    const verifier = await deployVerifier(signer, true);
    verifierContractAddress = await verifier.getAddress();

    // we set the verifying keys
    await setVerifyingKeys({ ...(await verifyingKeysArgs(signer)), verifyingKeysRegistryAddress });
  });

  describe("2 signups (1 after stateAq is merged and logs are fetched), 1 message", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        { policy: signupPolicyFactory, checker: signupCheckerFactory },
        signer,
        true,
      );
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
    });

    it("should signup one user", async () => {
      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: user.publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });
    });

    it("should join one user", async () => {
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: user.privateKey.serialize(),
        pollId: 0n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });
    });

    it("should publish one message", async () => {
      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
      });
      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: new Keypair().publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });
    });
  });

  describe("4 signups, 8 messages, 16 relayed messages", () => {
    after(async () => {
      await clean();
    });

    const users = [new Keypair(), new Keypair(), new Keypair(), new Keypair()];

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        { policy: signupPolicyFactory, checker: signupCheckerFactory },
        signer,
        true,
      );
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
    });

    it("should signup four users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: users[i].publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        });
      }
    });

    it("should join four users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciContractAddress,
          privateKey: users[i].privateKey.serialize(),
          pollId: 0n,
          pollJoiningZkey: testPollJoiningZkeyPath,
          useWasm,
          pollWasm: testPollJoiningWasmPath,
          pollWitnessGenerator: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          sgDataArg: DEFAULT_SG_DATA,
          ivcpDataArg: DEFAULT_IVCP_DATA,
          signer,
        });
      }
    });

    it("should publish eight messages", async () => {
      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 2n,
        pollId: 0n,
        newVoteWeight: 4n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 2n,
        pollId: 0n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[1].publicKey.serialize(),
        stateIndex: 2n,
        voteOptionIndex: 2n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[1].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[2].publicKey.serialize(),
        stateIndex: 3n,
        voteOptionIndex: 2n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[2].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[3].publicKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 2n,
        nonce: 3n,
        pollId: 0n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[3].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[3].publicKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 2n,
        nonce: 2n,
        pollId: 0n,
        newVoteWeight: 2n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[3].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[3].publicKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[3].privateKey.serialize(),
        signer,
      });
    });

    it("should relay sixteen messages", async () => {
      const votes = [
        {
          pollId: 0n,
          voteOptionIndex: 1n,
          salt: generateRandomSalt(),
          nonce: 2n,
          privateKey: users[0].privateKey,
          stateIndex: 1n,
          voteWeight: 4n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[0].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 1n,
          salt: generateRandomSalt(),
          nonce: 2n,
          privateKey: users[0].privateKey,
          stateIndex: 1n,
          voteWeight: 3n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[0].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 1n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[0].privateKey,
          stateIndex: 1n,
          voteWeight: 9n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[0].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 1n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[1].privateKey,
          stateIndex: 2n,
          voteWeight: 9n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[1].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 1n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[2].privateKey,
          stateIndex: 3n,
          voteWeight: 9n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[2].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 0n,
          salt: generateRandomSalt(),
          nonce: 3n,
          privateKey: users[3].privateKey,
          stateIndex: 4n,
          voteWeight: 3n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[3].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 0n,
          salt: generateRandomSalt(),
          nonce: 2n,
          privateKey: users[3].privateKey,
          stateIndex: 4n,
          voteWeight: 2n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[3].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 0n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[3].privateKey,
          stateIndex: 4n,
          voteWeight: 9n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[3].publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 0,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 0, maciAddress: maciAddresses.maciContractAddress });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await generateProofs({
        ...generateProofsArgs,
        signer,
        maciAddress: maciAddresses.maciContractAddress,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)) });
    });
  });

  describe("8 signups (same key), 12 messages (same message), 12 relayed messages (same message)", () => {
    after(async () => {
      await clean();
    });

    const users = Array.from({ length: 30 }, () => new Keypair());

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        { policy: signupPolicyFactory, checker: signupCheckerFactory },
        signer,
        true,
      );
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
    });

    it("should signup eight users", async () => {
      for (let i = 0; i < 8; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: users[i].publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        });
      }
    });

    it("should join user", async () => {
      // eslint-disable-next-line no-await-in-loop
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[0].privateKey.serialize(),
        pollId: 0n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });
    });

    it("should publish and relay 12 messages with the same nonce", async () => {
      const messages = new Array(12)
        .fill(0)
        .map(() =>
          generateVote({
            pollId: 0n,
            voteOptionIndex: 0n,
            salt: generateRandomSalt(),
            nonce: 1n,
            privateKey: users[0].privateKey,
            stateIndex: 1n,
            voteWeight: 9n,
            coordinatorPublicKey: coordinatorKeypair.publicKey,
            maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
            newPublicKey: users[0].publicKey,
          }),
        )
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 0,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 0, maciAddress: maciAddresses.maciContractAddress });

      for (let i = 0; i < 12; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await publish({
          publicKey: users[0].publicKey.serialize(),
          stateIndex: 1n,
          voteOptionIndex: 0n,
          nonce: 1n,
          pollId: 0n,
          newVoteWeight: 9n,
          maciAddress: maciAddresses.maciContractAddress,
          salt: generateRandomSalt(),
          privateKey: users[0].privateKey.serialize(),
          signer,
        });
      }
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)) });
    });
  });

  describe("30 signups (31 ballots), 30 messages", () => {
    after(async () => {
      await clean();
    });

    const users = Array.from({ length: 30 }, () => new Keypair());

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        { policy: signupPolicyFactory, checker: signupCheckerFactory },
        signer,
        true,
      );
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
    });

    it("should signup thirty users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: users[i].publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        });
      }
    });

    it("should join thirty users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciContractAddress,
          privateKey: users[i].privateKey.serialize(),
          pollId: 0n,
          pollJoiningZkey: testPollJoiningZkeyPath,
          useWasm,
          pollWasm: testPollJoiningWasmPath,
          pollWitnessGenerator: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          sgDataArg: DEFAULT_SG_DATA,
          ivcpDataArg: DEFAULT_IVCP_DATA,
          signer,
        });
      }
    });

    it("should publish 30 messages", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await publish({
          maciAddress: maciAddresses.maciContractAddress,
          publicKey: users[i].publicKey.serialize(),
          stateIndex: BigInt(i + 1),
          voteOptionIndex: 0n,
          nonce: 1n,
          pollId: 0n,
          newVoteWeight: 9n,
          salt: generateRandomSalt(),
          privateKey: users[i].privateKey.serialize(),
          signer,
        });
      }
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)), tallyData: tallyFileData });
    });
  });

  describe("30 signups (31 ballots), 30 messages, 3 relayed messages", () => {
    after(async () => {
      await clean();
    });

    const users = Array.from({ length: 30 }, () => new Keypair());

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        { policy: signupPolicyFactory, checker: signupCheckerFactory },
        signer,
        true,
      );
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
    });

    it("should signup thirty users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: users[i].publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        });
      }
    });

    it("should join thirty users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciContractAddress,
          privateKey: users[i].privateKey.serialize(),
          pollId: 0n,
          pollJoiningZkey: testPollJoiningZkeyPath,
          useWasm,
          pollWasm: testPollJoiningWasmPath,
          pollWitnessGenerator: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          sgDataArg: DEFAULT_SG_DATA,
          ivcpDataArg: DEFAULT_IVCP_DATA,
          signer,
        });
      }
    });

    it("should publish 30 messages", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await publish({
          maciAddress: maciAddresses.maciContractAddress,
          publicKey: users[i].publicKey.serialize(),
          stateIndex: 1n,
          voteOptionIndex: 0n,
          nonce: 1n,
          pollId: 0n,
          newVoteWeight: 9n,
          salt: generateRandomSalt(),
          privateKey: users[i].privateKey.serialize(),
          signer,
        });
      }
    });

    it("should relay 3 messages", async () => {
      const votes = [
        {
          pollId: 0n,
          voteOptionIndex: 1n,
          salt: generateRandomSalt(),
          nonce: 2n,
          privateKey: users[0].privateKey,
          stateIndex: 1n,
          voteWeight: 5n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[0].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 2n,
          salt: generateRandomSalt(),
          nonce: 3n,
          privateKey: users[2].privateKey,
          stateIndex: 3n,
          voteWeight: 9n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[2].publicKey,
        },
        {
          pollId: 0n,
          voteOptionIndex: 3n,
          salt: generateRandomSalt(),
          nonce: 3n,
          privateKey: users[3].privateKey,
          stateIndex: 4n,
          voteWeight: 7n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[3].publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 0,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 0, maciAddress: maciAddresses.maciContractAddress });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)), tallyData: tallyFileData });
    });
  });

  describe("multiplePolls with new signups", () => {
    after(async () => {
      await clean();
    });

    const users = Array.from({ length: 5 }, () => new Keypair());

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        { policy: signupPolicyFactory, checker: signupCheckerFactory },
        signer,
        true,
      );
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
      // signup
      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: users[0].publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[0].privateKey.serialize(),
        pollId: 0n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });

      // publish
      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });

      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: users[1].publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });

      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: users[2].publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });

      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[1].privateKey.serialize(),
        pollId: 0n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });

      const votes = [
        {
          pollId: 0n,
          voteOptionIndex: 0n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[1].privateKey,
          stateIndex: 2n,
          voteWeight: 2n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[1].publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 0,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 0, maciAddress: maciAddresses.maciContractAddress });

      const ipfsMessageBackupFiles = await getBackupFilenames();
      // time travel
      await timeTravel({ ...timeTravelArgs, signer });
      // generate proofs
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)), tallyData: tallyFileData });
      await clean();
    });

    it("should deploy a new poll", async () => {
      const [pollPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
    });

    it("should signup two new users", async () => {
      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: users[3].publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });
      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: users[4].publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });
    });

    it("should join users", async () => {
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[3].privateKey.serialize(),
        pollId: 1n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[4].privateKey.serialize(),
        pollId: 1n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });
    });

    it("should relay new messages", async () => {
      const votes = [
        {
          pollId: 1n,
          voteOptionIndex: 1n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[0].privateKey,
          stateIndex: 1n,
          voteWeight: 9n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[0].publicKey,
        },
        {
          pollId: 1n,
          voteOptionIndex: 0n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[1].privateKey,
          stateIndex: 1n,
          voteWeight: 5n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[1].publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 1,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 1, maciAddress: maciAddresses.maciContractAddress });
    });

    it("should publish a new message from the first poll voter", async () => {
      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 7n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });
    });

    it("should publish a new message by the new poll voters", async () => {
      await publish({
        publicKey: users[1].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 7n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[1].privateKey.serialize(),
        signer,
      });
    });

    it("should generate proofs and verify them", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ maciAddress: maciAddresses.maciContractAddress, pollId: 1n, signer });
      await generateProofs({
        ...generateProofsArgs,
        pollId: 1,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, pollId: 1n, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)), pollId: 1n });
    });
  });

  describe("multiplePolls", () => {
    const users = [
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
    ];

    after(async () => {
      await clean();
    });

    before(async () => {
      const [signupPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });
    });

    it("should run the first poll", async () => {
      const [pollPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });

      // signup
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: users[i].publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        });

        // eslint-disable-next-line no-await-in-loop
        const { isRegistered, stateIndex } = await getSignedupUserData({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: users[i].publicKey.serialize(),
          signer,
        });

        expect(isRegistered).to.eq(true);
        expect(stateIndex).to.not.eq(undefined);
      }

      // join the first poll
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciContractAddress,
          privateKey: users[i].privateKey.serialize(),
          pollId: 0n,
          pollJoiningZkey: testPollJoiningZkeyPath,
          useWasm,
          pollWasm: testPollJoiningWasmPath,
          pollWitnessGenerator: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          sgDataArg: DEFAULT_SG_DATA,
          ivcpDataArg: DEFAULT_IVCP_DATA,
          signer,
        });
        // eslint-disable-next-line no-await-in-loop
        const { isJoined, pollStateIndex } = await getJoinedUserData({
          maciAddress: maciAddresses.maciContractAddress,
          pollId: 0n,
          pollPublicKey: users[i].publicKey.serialize(),
          signer,
          startBlock: 0,
        });

        expect(isJoined).to.eq(true);
        expect(pollStateIndex).to.not.eq(undefined);
      }

      // publish
      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });

      const votes = [
        {
          pollId: 0n,
          voteOptionIndex: 0n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[0].privateKey,
          stateIndex: 1n,
          voteWeight: 5n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[0].publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 0,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 0, maciAddress: maciAddresses.maciContractAddress });

      const ipfsMessageBackupFiles = await getBackupFilenames();
      // time travel
      await timeTravel({ ...timeTravelArgs, signer });
      // generate proofs
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)) });
      await clean();
    });

    it("should deploy two more polls", async () => {
      const startDate = await getBlockTimestamp(signer);

      {
        const [pollPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
        const pollPolicyContractAddress = await pollPolicy.getAddress();

        // deploy a poll contract
        await deployPoll({
          ...deployPollArgs,
          signer,
          pollStartTimestamp: startDate,
          pollEndTimestamp: startDate + pollDuration,
          relayers: [await signer.getAddress()],
          maciAddress: maciAddresses.maciContractAddress,
          verifierContractAddress,
          verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
          policyContractAddress: pollPolicyContractAddress,
          initialVoiceCreditProxyContractAddress,
        });
      }

      {
        const [pollPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
        const pollPolicyContractAddress = await pollPolicy.getAddress();

        // deploy a poll contract
        await deployPoll({
          ...deployPollArgs,
          signer,
          pollStartTimestamp: startDate,
          pollEndTimestamp: startDate + pollDuration,
          relayers: [await signer.getAddress()],
          maciAddress: maciAddresses.maciContractAddress,
          verifierContractAddress,
          verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
          policyContractAddress: pollPolicyContractAddress,
          initialVoiceCreditProxyContractAddress,
        });
      }
    });

    it("join the second and third polls", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let pollId = 1; pollId <= 2; pollId += 1) {
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < users.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await joinPoll({
            maciAddress: maciAddresses.maciContractAddress,
            privateKey: users[i].privateKey.serialize(),
            pollId: BigInt(pollId),
            pollJoiningZkey: testPollJoiningZkeyPath,
            useWasm,
            pollWasm: testPollJoiningWasmPath,
            pollWitnessGenerator: testPollJoiningWitnessPath,
            rapidsnark: testRapidsnarkPath,
            sgDataArg: DEFAULT_SG_DATA,
            ivcpDataArg: DEFAULT_IVCP_DATA,
            signer,
          });
          // eslint-disable-next-line no-await-in-loop
          const { isJoined, pollStateIndex } = await getJoinedUserData({
            maciAddress: maciAddresses.maciContractAddress,
            pollId: BigInt(pollId),
            pollPublicKey: users[i].publicKey.serialize(),
            signer,
            startBlock: 0,
          });

          expect(isJoined).to.eq(true);
          expect(pollStateIndex).to.not.eq(undefined);
        }
      }
    });

    it("should publish messages to the second poll", async () => {
      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[1].publicKey.serialize(),
        stateIndex: 2n,
        voteOptionIndex: 3n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 1n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[1].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[2].publicKey.serialize(),
        stateIndex: 3n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[2].privateKey.serialize(),
        signer,
      });
    });

    it("should relay a message to the second poll", async () => {
      const votes = [
        {
          pollId: 1n,
          voteOptionIndex: 0n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[0].privateKey,
          stateIndex: 1n,
          voteWeight: 3n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[0].publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 1,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 1, maciAddress: maciAddresses.maciContractAddress });
    });

    it("should relay two messages to the third poll", async () => {
      const votes = [
        {
          pollId: 2n,
          voteOptionIndex: 7n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[4].privateKey,
          stateIndex: 4n,
          voteWeight: 3n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[4].publicKey,
        },
        {
          pollId: 2n,
          voteOptionIndex: 5n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: users[5].privateKey,
          stateIndex: 5n,
          voteWeight: 4n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: users[5].publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 2,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 2, maciAddress: maciAddresses.maciContractAddress });
    });

    it("should publish messages to the third poll", async () => {
      await publish({
        publicKey: users[3].publicKey.serialize(),
        stateIndex: 3n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 2n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[3].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[4].publicKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 7n,
        nonce: 1n,
        pollId: 2n,
        newVoteWeight: 2n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[4].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[5].publicKey.serialize(),
        stateIndex: 5n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 2n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[5].privateKey.serialize(),
        signer,
      });
    });

    it("should complete the second poll", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ maciAddress: maciAddresses.maciContractAddress, pollId: 1n, signer });
      const { tallyData } = await generateProofs({
        ...generateProofsArgs,
        pollId: 1,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({
        ...proveOnChainArgs,
        pollId: 1n,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
      });
      await verify({
        ...(await verifyArgs(signer)),
        pollId: 1n,
        tallyData,
        maciAddress: maciAddresses.maciContractAddress,
      });
      await clean(false);
    });

    it("should complete the third poll", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await mergeSignups({ maciAddress: maciAddresses.maciContractAddress, pollId: 2n, signer });
      const { tallyData } = await generateProofs({
        ...generateProofsArgs,
        pollId: 2,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({
        ...proveOnChainArgs,
        pollId: 2n,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
      });
      await verify({
        ...(await verifyArgs(signer)),
        pollId: 2n,
        tallyData,
        maciAddress: maciAddresses.maciContractAddress,
      });
    });
  });

  describe("pre fetch logs", () => {
    const stateOutPath = "./state.json";

    const user = new Keypair();

    after(async () => {
      await clean();

      if (fs.existsSync(stateOutPath)) {
        await fs.promises.unlink(stateOutPath);
      }
    });

    before(async () => {
      const [signupPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
      const pollPolicyContractAddress = await pollPolicy.getAddress();

      // deploy the smart contracts
      maciAddresses = await deployMaci({
        ...deployArgs,
        signer,
        signupPolicyAddress: signupPolicyContractAddress,
      });

      const startDate = await getBlockTimestamp(signer);

      // deploy a poll contract
      await deployPoll({
        ...deployPollArgs,
        signer,
        pollStartTimestamp: startDate,
        pollEndTimestamp: startDate + pollDuration,
        relayers: [await signer.getAddress()],
        maciAddress: maciAddresses.maciContractAddress,
        verifierContractAddress,
        verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
        policyContractAddress: pollPolicyContractAddress,
        initialVoiceCreditProxyContractAddress,
      });
    });

    it("should signup one user", async () => {
      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: user.publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });
    });

    it("should join one user", async () => {
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: user.privateKey.serialize(),
        pollId: 0n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });
    });

    it("should publish one message", async () => {
      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });
    });

    it("should relay one message", async () => {
      const votes = [
        {
          pollId: 0n,
          voteOptionIndex: 5n,
          salt: generateRandomSalt(),
          nonce: 1n,
          privateKey: user.privateKey,
          stateIndex: 1n,
          voteWeight: 5n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: user.publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: 0,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({ messages, signer, pollId: 0, maciAddress: maciAddresses.maciContractAddress });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await generateMaciState({
        maciAddress: maciAddresses.maciContractAddress,
        outputPath: stateOutPath,
        coordinatorPrivateKey,
        blockPerBatch: 50,
        pollId: 0n,
        signer,
        ipfsMessageBackupFiles,
      });
      await generateProofs({
        ...generateProofsArgs,
        stateFile: stateOutPath,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)) });
    });
  });
});
