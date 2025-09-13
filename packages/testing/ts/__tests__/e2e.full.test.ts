import { VOTE_OPTION_TREE_ARITY } from "@maci-protocol/core";
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
  EMode,
  proveOnChain,
  publish,
  deployPoll,
  generateProofs,
  deployVerifyingKeysRegistryContract,
  timeTravel,
  deployMaci,
  deployFreeForAllSignUpPolicy,
  deployConstantInitialVoiceCreditProxy,
  deployVerifier,
  type IGenerateProofsArgs,
  type IMaciContracts,
  joinPoll,
  deployConstantInitialVoiceCreditProxyFactory,
} from "@maci-protocol/sdk";
import { expect } from "chai";

import type { Signer } from "ethers";

import {
  DEFAULT_INITIAL_VOICE_CREDITS,
  DEFAULT_SG_DATA,
  deployPollArgs,
  coordinatorPrivateKey,
  pollDuration,
  proveOnChainArgs,
  verifyArgs,
  mergeSignupsArgs,
  testProofsDirPath,
  testRapidsnarkPath,
  testTallyFilePath,
  deployArgs,
  testProcessMessagesFullWitnessPath,
  testProcessMessagesFullWitnessDatPath,
  testTallyVotesFullWitnessPath,
  testTallyVotesFullWitnessDatPath,
  testProcessMessagesFullWasmPath,
  testTallyVotesFullWasmPath,
  testProcessMessageFullZkeyPath,
  testTallyVotesFullZkeyPath,
  coordinatorKeypair,
  verifyingKeysArgs,
  testPollJoiningZkeyPath,
  testPollJoiningWasmPath,
  testPollJoiningWitnessPath,
  DEFAULT_IVCP_DATA,
} from "../constants";
import { clean, getBackupFilenames, relayTestMessages } from "../utils";

/**
 Test scenarios:
    1 signup, 1 message
    1 signup, 1 relayed message
    1 signup, 2 valid messages
    1 signup, 2 valid and 2 invalid messages
    4 signups, 8 messages, 16 relayed messages
    30 signups (31 ballots), 21 messages
    30 signups, 30 invalid and 1 valid messages
 */
describe("e2e tests with full credits voting", function test() {
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
    voteTallyZkey: testTallyVotesFullZkeyPath,
    messageProcessorZkey: testProcessMessageFullZkeyPath,
    pollId: 0n,
    rapidsnark: testRapidsnarkPath,
    messageProcessorWitnessGenerator: testProcessMessagesFullWitnessPath,
    messageProcessorWitnessDatFile: testProcessMessagesFullWitnessDatPath,
    voteTallyWitnessGenerator: testTallyVotesFullWitnessPath,
    voteTallyWitnessDatFile: testTallyVotesFullWitnessDatPath,
    coordinatorPrivateKey,
    messageProcessorWasm: testProcessMessagesFullWasmPath,
    voteTallyWasm: testTallyVotesFullWasmPath,
    useWasm,
    mode: EMode.FULL,
  };

  const prepareTest = async () => {
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
    const maciContractsAddresses = await deployMaci({
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
      maciAddress: maciContractsAddresses.maciContractAddress,
      verifierContractAddress,
      verifyingKeysRegistryContractAddress: verifyingKeysRegistryAddress,
      policyContractAddress: pollPolicyContractAddress,
      initialVoiceCreditProxyContractAddress,
      mode: EMode.FULL,
    });

    return maciContractsAddresses;
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

    // we deploy the verifying keys registry contract
    verifyingKeysRegistryAddress = await deployVerifyingKeysRegistryContract({ signer });
    // we set the verifying keys
    await setVerifyingKeys({ ...(await verifyingKeysArgs(signer, [EMode.FULL])), verifyingKeysRegistryAddress });
  });

  describe("1 signup, 1 message", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await prepareTest();
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        signer,
        maciAddress: maciAddresses.maciContractAddress,
        mode: EMode.FULL,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(DEFAULT_INITIAL_VOICE_CREDITS.toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index === 0 ? DEFAULT_INITIAL_VOICE_CREDITS.toString() : "0");
      });
    });
  });

  describe("1 signup, 1 relayed message", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await prepareTest();
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

    it("should relay one message", async () => {
      const { message, ephemeralKeypair } = generateVote({
        pollId: 0n,
        voteOptionIndex: 0n,
        salt: generateRandomSalt(),
        nonce: 1n,
        privateKey: user.privateKey,
        stateIndex: 1n,
        voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
        coordinatorPublicKey: coordinatorKeypair.publicKey,
        maxVoteOption: BigInt(VOTE_OPTION_TREE_ARITY ** deployPollArgs.voteOptionTreeDepth),
        newPublicKey: user.publicKey,
      });

      const messages = [
        {
          maciAddress: maciAddresses.maciContractAddress,
          poll: 0,
          data: message.data.map(String),
          publicKey: ephemeralKeypair.publicKey.asArray().map(String),
          hash: message.hash(ephemeralKeypair.publicKey).toString(),
        },
      ];

      await relayTestMessages({ messages, signer, pollId: 0, maciAddress: maciAddresses.maciContractAddress });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      const ipfsMessageBackupFiles = await getBackupFilenames();
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        signer,
        maciAddress: maciAddresses.maciContractAddress,
        ipfsMessageBackupFiles,
        mode: EMode.FULL,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(DEFAULT_INITIAL_VOICE_CREDITS.toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index === 0 ? DEFAULT_INITIAL_VOICE_CREDITS.toString() : "0");
      });
    });
  });

  describe("1 signup, 2 valid messages", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await prepareTest();
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

    it("should publish two messages", async () => {
      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        signer,
        maciAddress: maciAddresses.maciContractAddress,
        mode: EMode.FULL,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(DEFAULT_INITIAL_VOICE_CREDITS.toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index === 1 ? DEFAULT_INITIAL_VOICE_CREDITS.toString() : "0");
      });
    });
  });

  describe("1 signup, 2 valid and 2 invalid message", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await prepareTest();
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

    it("should publish two valid and two invalid messages", async () => {
      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS - 10),
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS + 10),
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: user.privateKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        signer,
        maciAddress: maciAddresses.maciContractAddress,
        mode: EMode.FULL,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(DEFAULT_INITIAL_VOICE_CREDITS.toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index === 1 ? DEFAULT_INITIAL_VOICE_CREDITS.toString() : "0");
      });
    });
  });

  describe("4 signups, 8 messages, 16 relayed messages", () => {
    after(async () => {
      await clean();
    });

    const users = [new Keypair(), new Keypair(), new Keypair(), new Keypair()];

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await prepareTest();
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
          voteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
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
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        signer,
        maciAddress: maciAddresses.maciContractAddress,
        ipfsMessageBackupFiles,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)) });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(
        (DEFAULT_INITIAL_VOICE_CREDITS * users.length).toString(),
      );
      expect(tallyFileData.results.tally[0].toString()).to.eq("100");
      expect(tallyFileData.results.tally[1].toString()).to.eq("300");

      tallyFileData.results.tally.forEach((result, index) => {
        if (index > 1) {
          expect(result).to.eq("0");
        }
      });
    });
  });

  describe("30 signups (31 ballots), 30 messages", () => {
    after(async () => {
      await clean();
    });

    const users = Array.from({ length: 30 }, () => new Keypair());

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await prepareTest();
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
          newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
          salt: generateRandomSalt(),
          privateKey: users[i].privateKey.serialize(),
          signer,
        });
      }
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)), tallyData: tallyFileData });

      const totalSpent = (DEFAULT_INITIAL_VOICE_CREDITS * users.length).toString();

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(totalSpent);
      expect(tallyFileData.results.tally[0].toString()).to.eq(totalSpent);
    });
  });

  describe("30 signups, 20 invalid and 1 valid messages", () => {
    after(async () => {
      await clean();
    });

    const users = Array.from({ length: 30 }, () => new Keypair());

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await prepareTest();
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

    it("should publish 30 invalid and 1 valid messages", async () => {
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
          newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS + 10),
          salt: generateRandomSalt(),
          privateKey: users[i].privateKey.serialize(),
          signer,
        });
      }

      await publish({
        maciAddress: maciAddresses.maciContractAddress,
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      const { tallyData: tallyFileData } = await generateProofs({
        ...generateProofsArgs,
        maciAddress: maciAddresses.maciContractAddress,
        signer,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({ ...(await verifyArgs(signer)), tallyData: tallyFileData });

      const totalSpent = DEFAULT_INITIAL_VOICE_CREDITS.toString();

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(totalSpent);
      expect(tallyFileData.results.tally[0].toString()).to.eq(totalSpent);
    });
  });
});
