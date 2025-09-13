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
  type IGenerateProofsArgs,
  deployMaci,
  type IMaciContracts,
  deployFreeForAllSignUpPolicy,
  deployConstantInitialVoiceCreditProxy,
  deployVerifier,
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
  testProcessMessagesNonQvWitnessPath,
  testProcessMessagesNonQvWitnessDatPath,
  testVoteTallyNonQvWitnessPath,
  testVoteTallyNonQvWitnessDatPath,
  testProcessMessagesNonQvWasmPath,
  testVoteTallyNonQvWasmPath,
  testProcessMessageNonQvZkeyPath,
  testVoteTallyNonQvZkeyPath,
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
    1 signup, 1 message with quadratic voting disabled
    1 signup, 1 relayed message
    1 signup, 2 valid messages
    1 signup, 2 valid and 2 invalid messages
    2 signups, 2 different messages
 */
describe("e2e tests with non quadratic voting", function test() {
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
    voteTallyZkey: testVoteTallyNonQvZkeyPath,
    messageProcessorZkey: testProcessMessageNonQvZkeyPath,
    pollId: 0n,
    rapidsnark: testRapidsnarkPath,
    messageProcessorWitnessGenerator: testProcessMessagesNonQvWitnessPath,
    messageProcessorWitnessDatFile: testProcessMessagesNonQvWitnessDatPath,
    voteTallyWitnessGenerator: testVoteTallyNonQvWitnessPath,
    voteTallyWitnessDatFile: testVoteTallyNonQvWitnessDatPath,
    coordinatorPrivateKey,
    messageProcessorWasm: testProcessMessagesNonQvWasmPath,
    voteTallyWasm: testVoteTallyNonQvWasmPath,
    useWasm,
    mode: EMode.NON_QV,
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
    await setVerifyingKeys({ ...(await verifyingKeysArgs(signer, [EMode.NON_QV])), verifyingKeysRegistryAddress });
  });

  describe("1 signup, 1 message", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();
    const voteWeight = 9n;

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
        mode: EMode.NON_QV,
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
        newVoteWeight: voteWeight,
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
        mode: EMode.NON_QV,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(voteWeight.toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index === 0 ? voteWeight.toString() : "0");
      });
    });
  });

  describe("1 signup, 1 relayed message", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();
    const voteWeight = 9n;

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
        mode: EMode.NON_QV,
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

    it("should relay one message", async () => {
      const { message, ephemeralKeypair } = generateVote({
        pollId: 0n,
        voteOptionIndex: 0n,
        salt: generateRandomSalt(),
        nonce: 1n,
        privateKey: user.privateKey,
        stateIndex: 1n,
        voteWeight,
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
        mode: EMode.NON_QV,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(voteWeight.toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index === 0 ? voteWeight.toString() : "0");
      });
    });
  });

  describe("1 signup, 2 valid messages", () => {
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
        mode: EMode.NON_QV,
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

    it("should publish two messages", async () => {
      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 2n,
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
        mode: EMode.NON_QV,
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

  describe("1 signup, 2 valid and 1 invalid message", () => {
    after(async () => {
      await clean();
    });

    const user = new Keypair();
    const voteWeight = 9n;

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
        mode: EMode.NON_QV,
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

    it("should publish two valid and two invalid messages", async () => {
      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: voteWeight,
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

      await publish({
        publicKey: user.publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: -voteWeight,
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
        newVoteWeight: voteWeight,
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
        mode: EMode.NON_QV,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq(voteWeight.toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index === 1 ? voteWeight.toString() : "0");
      });
    });
  });

  describe("2 signups, 2 different messages", () => {
    after(async () => {
      await clean();
    });

    const users = [new Keypair(), new Keypair()];
    const voteWeight = 9n;

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
        mode: EMode.NON_QV,
      });
    });

    it("should signup two users", async () => {
      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: users[0].publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });

      await signup({
        maciAddress: maciAddresses.maciContractAddress,
        maciPublicKey: users[1].publicKey.serialize(),
        sgData: DEFAULT_SG_DATA,
        signer,
      });
    });

    it("should join two users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let index = 0; index < users.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciContractAddress,
          privateKey: users[index].privateKey.serialize(),
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

    it("should publish two different messages", async () => {
      await publish({
        publicKey: users[0].publicKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: voteWeight,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[0].privateKey.serialize(),
        signer,
      });

      await publish({
        publicKey: users[1].publicKey.serialize(),
        stateIndex: 2n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: voteWeight,
        maciAddress: maciAddresses.maciContractAddress,
        salt: generateRandomSalt(),
        privateKey: users[1].privateKey.serialize(),
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
        mode: EMode.NON_QV,
      });
      await proveOnChain({ ...proveOnChainArgs, maciAddress: maciAddresses.maciContractAddress, signer });
      await verify({
        ...(await verifyArgs(signer)),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
      });

      expect(tallyFileData.totalSpentVoiceCredits.spent.toString()).to.eq((voteWeight * 2n).toString());

      tallyFileData.results.tally.forEach((result, index) => {
        expect(result.toString()).to.eq(index < 2 ? voteWeight.toString() : "0");
      });
    });
  });
});
