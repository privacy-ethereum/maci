import { EMode, VOTE_OPTION_TREE_ARITY } from "@maci-protocol/core";
import { generateRandomSalt } from "@maci-protocol/crypto";
import { Keypair } from "@maci-protocol/domainobjs";
import {
  generateVote,
  getBlockTimestamp,
  getDefaultSigner,
  signup,
  mergeSignups,
  verify,
  setVerifyingKeys,
  joinPoll,
  proveOnChain,
  publish,
  generateProofs,
  deployPoll,
  deployVerifyingKeysRegistryContract,
  timeTravel,
  type IGenerateProofsArgs,
  type ITallyData,
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
  coordinatorPrivateKey,
  deployArgs,
  deployPollArgs,
  testProcessMessageZkeyPath,
  mergeSignupsArgs,
  testTallyVotesZkeyPath,
  testProcessMessagesWasmPath,
  testProcessMessagesWitnessDatPath,
  testProcessMessagesWitnessPath,
  testProofsDirPath,
  testRapidsnarkPath,
  testTallyFilePath,
  testTallyVotesWasmPath,
  testTallyVotesWitnessDatPath,
  testTallyVotesWitnessPath,
  proveOnChainArgs,
  verifyArgs,
  timeTravelArgs,
  testPollJoiningZkeyPath,
  testPollJoiningWasmPath,
  testPollJoiningWitnessPath,
  pollDuration,
  coordinatorKeypair,
  verifyingKeysArgs,
} from "../constants";
import { clean, getBackupFilenames, relayTestMessages } from "../utils";

describe("keyChange tests", function test() {
  const useWasm = false;
  this.timeout(900000);

  let maciAddresses: IMaciContracts;
  let initialVoiceCreditProxyContractAddress: string;
  let verifierContractAddress: string;
  let signer: Signer;
  let verifyingKeysRegistryAddress: string;

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

  describe("keyChange and new vote (new vote has same nonce)", () => {
    after(async () => {
      await clean();
    });

    const user1Keypair = new Keypair();
    const { privateKey: pollPrivateKey, publicKey: pollPublicKey1 } = user1Keypair;
    const { publicKey: pollPublicKey2 } = new Keypair();

    const initialNonce = 1n;
    const initialVoteOption = 0n;
    const initialVoteAmount = 9n;
    const pollId = 0n;
    let stateIndex = 0n;
    const expectedTally = initialVoteAmount - 1n;
    const expectedPerVoteOptionTally = (initialVoteAmount - 1n) ** 2n;

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        {
          policy: signupPolicyFactory,
          checker: signupCheckerFactory,
        },
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
      stateIndex = BigInt(
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: user1Keypair.publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        }).then((result) => result.stateIndex),
      );
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: user1Keypair.privateKey.serialize(),
        pollId,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });
      await publish({
        publicKey: pollPublicKey1.serialize(),
        stateIndex,
        voteOptionIndex: initialVoteOption,
        nonce: initialNonce,
        pollId,
        newVoteWeight: initialVoteAmount,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: pollPrivateKey.serialize(),
        signer,
      });
    });

    it("should publish relay a message to change the poll key and cast a new vote", async () => {
      const votes = [
        {
          pollId,
          voteOptionIndex: initialVoteOption,
          salt: generateRandomSalt(),
          nonce: initialNonce,
          privateKey: pollPrivateKey,
          stateIndex,
          voteWeight: initialVoteAmount - 2n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: pollPublicKey2,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: Number(pollId),
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({
        messages,
        signer,
        pollId: Number(pollId),
        maciAddress: maciAddresses.maciContractAddress,
      });
    });

    it("should publish a message to change the poll key and cast a new vote", async () => {
      await publish({
        publicKey: pollPublicKey2.serialize(),
        stateIndex,
        voteOptionIndex: initialVoteOption,
        nonce: initialNonce,
        pollId,
        newVoteWeight: initialVoteAmount - 1n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: pollPrivateKey.serialize(),
        signer,
      });
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

    it("should confirm the tally is correct", async () => {
      const tallyData = JSON.parse(
        await fs.promises.readFile(testTallyFilePath).then((res) => res.toString()),
      ) as ITallyData;
      expect(tallyData.results.tally[0]).to.equal(expectedTally.toString());
      expect(tallyData.perVoteOptionSpentVoiceCredits?.tally[0]).to.equal(expectedPerVoteOptionTally.toString());
    });
  });

  describe("keyChange and new vote (new vote has greater nonce and different vote option)", () => {
    after(async () => {
      await clean();
    });

    const user1Keypair = new Keypair();
    const { publicKey: pollPublicKey2 } = new Keypair();

    const initialNonce = 1n;
    const initialVoteOption = 0n;
    const initialVoteAmount = 9n;
    const pollId = 0n;
    let stateIndex = 0n;
    const expectedTally = initialVoteAmount;
    const expectedPerVoteOptionTally = initialVoteAmount ** 2n;

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        {
          policy: signupPolicyFactory,
          checker: signupCheckerFactory,
        },
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
      stateIndex = BigInt(
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: user1Keypair.publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        }).then((result) => result.stateIndex),
      );
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: user1Keypair.privateKey.serialize(),
        pollId,
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
          pollId,
          voteOptionIndex: initialVoteOption,
          salt: generateRandomSalt(),
          nonce: initialNonce,
          privateKey: user1Keypair.privateKey,
          stateIndex,
          voteWeight: initialVoteAmount,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: user1Keypair.publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: Number(pollId),
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({
        messages,
        signer,
        pollId: Number(pollId),
        maciAddress: maciAddresses.maciContractAddress,
      });
    });

    it("should publish a message to change the key and cast a new vote", async () => {
      await publish({
        publicKey: pollPublicKey2.serialize(),
        stateIndex,
        voteOptionIndex: initialVoteOption + 1n,
        nonce: initialNonce + 1n,
        pollId,
        newVoteWeight: initialVoteAmount - 1n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user1Keypair.privateKey.serialize(),
        signer,
      });
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

    it("should confirm the tally is correct", async () => {
      const tallyData = JSON.parse(
        await fs.promises.readFile(testTallyFilePath).then((res) => res.toString()),
      ) as ITallyData;
      expect(tallyData.results.tally[0]).to.equal(expectedTally.toString());
      expect(tallyData.perVoteOptionSpentVoiceCredits?.tally[0]).to.equal(expectedPerVoteOptionTally.toString());
    });
  });

  describe("keyChange and new vote (new vote has same nonce and different vote option)", () => {
    after(async () => {
      await clean();
    });

    const user1Keypair = new Keypair();
    const secondKeypair = new Keypair();

    const initialNonce = 1n;
    const initialVoteOption = 0n;
    const initialVoteAmount = 9n;
    const pollId = 0n;
    let stateIndex = 0n;
    const expectedTally = initialVoteAmount - 3n;
    const expectedPerVoteOptionTally = (initialVoteAmount - 3n) ** 2n;

    before(async () => {
      const [signupPolicy, , signupPolicyFactory, signupCheckerFactory] = await deployFreeForAllSignUpPolicy(
        {},
        signer,
        true,
      );
      const signupPolicyContractAddress = await signupPolicy.getAddress();

      const [pollPolicy] = await deployFreeForAllSignUpPolicy(
        {
          policy: signupPolicyFactory,
          checker: signupCheckerFactory,
        },
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
      stateIndex = BigInt(
        await signup({
          maciAddress: maciAddresses.maciContractAddress,
          maciPublicKey: user1Keypair.publicKey.serialize(),
          sgData: DEFAULT_SG_DATA,
          signer,
        }).then((result) => result.stateIndex),
      );
      await joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: user1Keypair.privateKey.serialize(),
        pollId,
        pollJoiningZkey: testPollJoiningZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
        signer,
      });

      await publish({
        publicKey: user1Keypair.publicKey.serialize(),
        stateIndex,
        voteOptionIndex: initialVoteOption,
        nonce: initialNonce,
        pollId,
        newVoteWeight: initialVoteAmount,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user1Keypair.privateKey.serialize(),
        signer,
      });
    });

    it("should relay a message to change the poll key, and a new vote", async () => {
      const votes = [
        {
          pollId,
          voteOptionIndex: initialVoteOption + 2n,
          salt: generateRandomSalt(),
          nonce: initialNonce,
          privateKey: user1Keypair.privateKey,
          stateIndex,
          voteWeight: initialVoteAmount - 2n,
          coordinatorPublicKey: coordinatorKeypair.publicKey,
          maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
          newPublicKey: secondKeypair.publicKey,
        },
      ];

      const messages = votes
        .map((vote) => generateVote(vote))
        .map(({ message, ephemeralKeypair }) => ({
          maciAddress: maciAddresses.maciContractAddress,
          poll: Number(pollId),
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        }));

      await relayTestMessages({
        messages,
        signer,
        pollId: Number(pollId),
        maciAddress: maciAddresses.maciContractAddress,
      });
    });

    it("should publish a message to change the poll key, and a new vote", async () => {
      await publish({
        publicKey: secondKeypair.publicKey.serialize(),
        stateIndex,
        voteOptionIndex: initialVoteOption + 2n,
        nonce: initialNonce,
        pollId,
        newVoteWeight: initialVoteAmount - 3n,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user1Keypair.privateKey.serialize(),
        signer,
      });
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

    it("should confirm the tally is correct", async () => {
      const tallyData = JSON.parse(
        await fs.promises.readFile(testTallyFilePath).then((res) => res.toString()),
      ) as ITallyData;
      expect(tallyData.results.tally[2]).to.equal(expectedTally.toString());
      expect(tallyData.perVoteOptionSpentVoiceCredits?.tally[2]).to.equal(expectedPerVoteOptionTally.toString());
    });
  });
});
