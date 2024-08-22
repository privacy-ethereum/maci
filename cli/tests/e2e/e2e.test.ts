import { expect } from "chai";
import { getDefaultSigner } from "maci-contracts";
import { genRandomSalt } from "maci-crypto";
import { Keypair } from "maci-domainobjs";

import fs from "fs";

import type { Signer } from "ethers";

import {
  checkVerifyingKeys,
  deploy,
  deployPoll,
  deployVkRegistryContract,
  genLocalState,
  genProofs,
  mergeSignups,
  proveOnChain,
  publish,
  setVerifyingKeys,
  signup,
  timeTravel,
  verify,
  isRegisteredUser,
  joinPoll,
  isJoinedUser,
} from "../../ts/commands";
import { DeployedContracts, GenProofsArgs, PollContracts } from "../../ts/utils";
import {
  deployPollArgs,
  checkVerifyingKeysArgs,
  coordinatorPrivKey,
  pollDuration,
  proveOnChainArgs,
  verifyArgs,
  mergeSignupsArgs,
  pollJoiningTestZkeyPath,
  processMessageTestZkeyPath,
  setVerifyingKeysArgs,
  tallyVotesTestZkeyPath,
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
} from "../constants";
import { clean, isArm } from "../utils";

/**
 Test scenarios:
    1 signup, 1 message
    4 signups, 8 messages
    5 signups, 1 message
    8 signups, 10 messages
    4 signups, 4 messages
    test if keys are set correctly given a set of files
    1 signup and 1 valid message for multiple polls
    7 signups and 1 message, another polls and 6 messages
 */
describe("e2e tests", function test() {
  const useWasm = isArm();
  this.timeout(900000);

  let maciAddresses: DeployedContracts;
  let pollAddresses: PollContracts;
  let signer: Signer;

  const genProofsArgs: Omit<GenProofsArgs, "signer"> = {
    outputDir: testProofsDirPath,
    tallyFile: testTallyFilePath,
    tallyZkey: tallyVotesTestZkeyPath,
    processZkey: processMessageTestZkeyPath,
    pollId: 0n,
    rapidsnark: testRapidsnarkPath,
    processWitgen: testProcessMessagesWitnessPath,
    processDatFile: testProcessMessagesWitnessDatPath,
    tallyWitgen: testTallyVotesWitnessPath,
    tallyDatFile: testTallyVotesWitnessDatPath,
    coordinatorPrivKey,
    processWasm: testProcessMessagesWasmPath,
    tallyWasm: testTallyVotesWasmPath,
    useWasm,
    useQuadraticVoting: true,
  };

  // before all tests we deploy the vk registry contract and set the verifying keys
  before(async () => {
    signer = await getDefaultSigner();

    // we deploy the vk registry contract
    await deployVkRegistryContract({ signer });
    // we set the verifying keys
    await setVerifyingKeys({ ...setVerifyingKeysArgs, signer });
  });

  describe("1 signup, 1 message", () => {
    after(() => {
      clean();
    });

    const user = new Keypair();
    const pollKeys = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer, useQuadraticVoting: true });
    });

    it("should signup one user", async () => {
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: user.pubKey.serialize(), signer });
    });

    it("should join one user", async () => {
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: user.privKey.serialize(),
        pollPrivKey: pollKeys.privKey.serialize(),
        stateIndex: 1n,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 10n,
        quiet: true,
      });
    });

    it("should publish one message", async () => {
      await publish({
        pubkey: pollKeys.pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys.privKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ seconds: pollDuration, signer });
      await mergeSignups({ ...mergeSignupsArgs, signer });
      const tallyFileData = await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({
        ...verifyArgs(),
        tallyData: tallyFileData,
        signer,
      });
    });
  });

  describe("2 signups (1 after stateAq is merged and logs are fetched), 1 message", () => {
    after(() => {
      clean();
    });

    const user = new Keypair();
    const pollKeys = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should signup one user", async () => {
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: user.pubKey.serialize(), signer });
    });

    it("should join one user", async () => {
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: user.privKey.serialize(),
        pollPrivKey: pollKeys.privKey.serialize(),
        stateIndex: 1n,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 10n,
        quiet: true,
      });
    });

    it("should publish one message", async () => {
      await publish({
        pubkey: pollKeys.pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys.privKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, signer });
      const tallyFileData = await genProofs({ ...genProofsArgs, signer });
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: user.pubKey.serialize(), signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({
        ...verifyArgs(),
        tallyData: tallyFileData,
        maciAddress: tallyFileData.maci,
        tallyAddress: tallyFileData.tallyAddress,
        signer,
      });
    });
  });

  describe("4 signups, 8 messages", () => {
    after(() => {
      clean();
    });

    const users = [new Keypair(), new Keypair(), new Keypair(), new Keypair()];
    const pollKeys = [new Keypair(), new Keypair(), new Keypair(), new Keypair()];

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should signup four users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[i].pubKey.serialize(), signer });
      }
    });

    it("should join four users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciAddress,
          privateKey: users[i].privKey.serialize(),
          pollPrivKey: pollKeys[i].privKey.serialize(),
          stateIndex: BigInt(i + 1),
          pollId: 0n,
          pollJoiningZkey: pollJoiningTestZkeyPath,
          useWasm: true,
          pollWasm: testPollJoiningWasmPath,
          pollWitgen: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          signer,
          newVoiceCreditBalance: 1n,
          quiet: true,
        });
      }
    });

    it("should publish eight messages", async () => {
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 2n,
        pollId: 0n,
        newVoteWeight: 4n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 2n,
        pollId: 0n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });
      await publish({
        pubkey: pollKeys[1].pubKey.serialize(),
        stateIndex: 2n,
        voteOptionIndex: 2n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[1].privKey.serialize(),
        signer,
      });
      await publish({
        pubkey: pollKeys[2].pubKey.serialize(),
        stateIndex: 3n,
        voteOptionIndex: 2n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[2].privKey.serialize(),
        signer,
      });
      await publish({
        pubkey: pollKeys[3].pubKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 2n,
        nonce: 3n,
        pollId: 0n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[3].privKey.serialize(),
        signer,
      });
      await publish({
        pubkey: pollKeys[3].pubKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 2n,
        nonce: 2n,
        pollId: 0n,
        newVoteWeight: 2n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[3].privKey.serialize(),
        signer,
      });
      await publish({
        pubkey: pollKeys[3].pubKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[3].privKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, signer });
      await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), signer });
    });
  });

  describe("9 signups, 1 message", () => {
    after(() => {
      clean();
    });

    const users = [
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
    ];

    const pollKeys = [
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
    ];

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should signup nine users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[i].pubKey.serialize(), signer });
      }
    });

    it("should join nine users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciAddress,
          privateKey: users[i].privKey.serialize(),
          pollPrivKey: pollKeys[i].privKey.serialize(),
          stateIndex: BigInt(i + 1),
          pollId: 0n,
          pollJoiningZkey: pollJoiningTestZkeyPath,
          useWasm: true,
          pollWasm: testPollJoiningWasmPath,
          pollWitgen: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          signer,
          newVoiceCreditBalance: 1n,
          quiet: true,
        });
      }
    });

    it("should publish one message", async () => {
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, signer });
      const tallyFileData = await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), tallyData: tallyFileData, signer });
    });
  });

  describe("8 signups (same key), 12 messages (same message)", () => {
    after(() => {
      clean();
    });

    const user = new Keypair();
    const pollKeys = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should signup eight users (same pub key)", async () => {
      for (let i = 0; i < 8; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: user.pubKey.serialize(), signer });
      }
    });

    it("should join user", async () => {
      // eslint-disable-next-line no-await-in-loop
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: user.privKey.serialize(),
        pollPrivKey: pollKeys.privKey.serialize(),
        stateIndex: 1n,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });
    });

    it("should publish 12 messages with the same nonce", async () => {
      for (let i = 0; i < 12; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await publish({
          pubkey: pollKeys.pubKey.serialize(),
          stateIndex: 1n,
          voteOptionIndex: 0n,
          nonce: 1n,
          pollId: 0n,
          newVoteWeight: 9n,
          maciAddress: maciAddresses.maciAddress,
          salt: genRandomSalt(),
          privateKey: pollKeys.privKey.serialize(),
          signer,
        });
      }
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, signer });
      await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), signer });
    });
  });

  describe("30 signups (31 ballots), 4 messages", () => {
    after(() => {
      clean();
    });

    const users = Array.from({ length: 30 }, () => new Keypair());
    const pollKeys = Array.from({ length: 30 }, () => new Keypair());

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should signup thirty users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[i].pubKey.serialize(), signer });
      }
    });

    it("should join thirty users", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await joinPoll({
          maciAddress: maciAddresses.maciAddress,
          privateKey: users[i].privKey.serialize(),
          pollPrivKey: pollKeys[i].privKey.serialize(),
          stateIndex: BigInt(i + 1),
          pollId: 0n,
          pollJoiningZkey: pollJoiningTestZkeyPath,
          useWasm: true,
          pollWasm: testPollJoiningWasmPath,
          pollWitgen: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          signer,
          newVoiceCreditBalance: 1n,
          quiet: true,
        });
      }
    });

    it("should publish 4 messages", async () => {
      // publish four different messages
      await publish({
        maciAddress: maciAddresses.maciAddress,
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });

      await publish({
        maciAddress: maciAddresses.maciAddress,
        pubkey: pollKeys[1].pubKey.serialize(),
        stateIndex: 2n,
        voteOptionIndex: 1n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        salt: genRandomSalt(),
        privateKey: pollKeys[1].privKey.serialize(),
        signer,
      });

      await publish({
        maciAddress: maciAddresses.maciAddress,
        pubkey: pollKeys[2].pubKey.serialize(),
        stateIndex: 3n,
        voteOptionIndex: 2n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        salt: genRandomSalt(),
        privateKey: pollKeys[2].privKey.serialize(),
        signer,
      });

      await publish({
        maciAddress: maciAddresses.maciAddress,
        pubkey: pollKeys[3].pubKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 3n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        salt: genRandomSalt(),
        privateKey: pollKeys[3].privKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, signer });
      const tallyFileData = await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), tallyData: tallyFileData, signer });
    });
  });

  describe("checkKeys", () => {
    before(async () => {
      // deploy maci as we need the address
      await deploy({ ...deployArgs, signer });
    });
    it("should check if the verifying keys have been set correctly", async () => {
      await checkVerifyingKeys({ ...checkVerifyingKeysArgs, signer });
    });
  });

  describe("multiplePolls1", () => {
    after(() => {
      clean();
    });

    const user = new Keypair();
    const pollKeys = new Keypair();

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
      // signup
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: user.pubKey.serialize(), signer });
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: user.privKey.serialize(),
        pollPrivKey: pollKeys.privKey.serialize(),
        stateIndex: 1n,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });
      // publish
      await publish({
        pubkey: user.pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: user.privKey.serialize(),
        signer,
      });
      // time travel
      await timeTravel({ ...timeTravelArgs, signer });
      // generate proofs
      await mergeSignups({ ...mergeSignupsArgs, signer });
      const tallyFileData = await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), tallyData: tallyFileData, signer });
      clean();
    });

    it("should deploy a new poll", async () => {
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should join to new poll", async () => {
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: user.privKey.serialize(),
        pollPrivKey: pollKeys.privKey.serialize(),
        stateIndex: 1n,
        pollId: 1n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });
    });

    it("should publish a new message", async () => {
      await publish({
        pubkey: pollKeys.pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 7n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys.privKey.serialize(),
        signer,
      });
    });

    it("should generate proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ pollId: 1n, signer });
      await genProofs({ ...genProofsArgs, pollId: 1n, signer });
      await proveOnChain({ ...proveOnChainArgs, pollId: 1n, signer });
      await verify({ ...verifyArgs(), pollId: 1n, signer });
    });
  });

  describe("multiplePolls with new signups", () => {
    after(() => {
      clean();
    });

    const users = Array.from({ length: 4 }, () => new Keypair());
    const pollKeys = Array.from({ length: 4 }, () => new Keypair());

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
      // signup
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[0].pubKey.serialize(), signer });
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: users[0].privKey.serialize(),
        pollPrivKey: pollKeys[0].privKey.serialize(),
        stateIndex: 1n,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });

      // publish
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });

      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[1].pubKey.serialize(), signer });

      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[1].pubKey.serialize(), signer });

      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: users[1].privKey.serialize(),
        pollPrivKey: pollKeys[1].privKey.serialize(),
        stateIndex: 2n,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });

      // time travel
      await timeTravel({ ...timeTravelArgs, signer });
      // generate proofs
      await mergeSignups({ ...mergeSignupsArgs, signer });
      const tallyFileData = await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), tallyData: tallyFileData, signer });
      clean();
    });

    it("should deploy a new poll", async () => {
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should signup four new users", async () => {
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[2].pubKey.serialize(), signer });
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[3].pubKey.serialize(), signer });
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[3].pubKey.serialize(), signer });
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[3].pubKey.serialize(), signer });
    });

    it("should join users", async () => {
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: users[2].privKey.serialize(),
        pollPrivKey: pollKeys[2].privKey.serialize(),
        stateIndex: 4n,
        pollId: 1n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: users[3].privKey.serialize(),
        pollPrivKey: pollKeys[3].privKey.serialize(),
        stateIndex: 5n,
        pollId: 1n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });
    });

    it("should publish a new message from the first poll voter", async () => {
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 7n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });
    });

    it("should publish a new message by the new poll voters", async () => {
      await publish({
        pubkey: pollKeys[1].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 7n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[1].privKey.serialize(),
        signer,
      });
    });

    it("should generate proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ pollId: 1n, signer });
      await genProofs({ ...genProofsArgs, pollId: 1n, signer });
      await proveOnChain({ ...proveOnChainArgs, pollId: 1n, signer });
      await verify({ ...verifyArgs(), pollId: 1n, signer });
    });
  });

  describe("multiplePolls2", () => {
    const users = [
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
    ];
    const pollKeys = [
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
      new Keypair(),
    ];

    let secondPollAddresses: PollContracts;

    after(() => {
      clean();
    });

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
    });

    it("should run the first poll", async () => {
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });

      // signup
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < users.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: users[i].pubKey.serialize(), signer });

        // eslint-disable-next-line no-await-in-loop
        const { isRegistered, stateIndex } = await isRegisteredUser({
          maciAddress: maciAddresses.maciAddress,
          maciPubKey: users[i].pubKey.serialize(),
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
          maciAddress: maciAddresses.maciAddress,
          privateKey: users[i].privKey.serialize(),
          pollPrivKey: pollKeys[i].privKey.serialize(),
          stateIndex: BigInt(i + 1),
          pollId: 0n,
          pollJoiningZkey: pollJoiningTestZkeyPath,
          useWasm: true,
          pollWasm: testPollJoiningWasmPath,
          pollWitgen: testPollJoiningWitnessPath,
          rapidsnark: testRapidsnarkPath,
          signer,
          newVoiceCreditBalance: 1n,
          quiet: true,
        });
        // eslint-disable-next-line no-await-in-loop
        const { isJoined, pollStateIndex } = await isJoinedUser({
          maciAddress: maciAddresses.maciAddress,
          pollId: 0n,
          pollPubKey: pollKeys[i].pubKey.serialize(),
          signer,
          startBlock: 0,
          quiet: true,
        });

        expect(isJoined).to.eq(true);
        expect(pollStateIndex).to.not.eq(undefined);
      }

      // publish
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });

      // time travel
      await timeTravel({ ...timeTravelArgs, signer });
      // generate proofs
      await mergeSignups({ ...mergeSignupsArgs, signer });
      await genProofs({ ...genProofsArgs, signer });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), signer });
      clean();
    });

    it("should deploy two more polls", async () => {
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
      secondPollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("join the second and third polls", async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let p = 1; p <= 2; p += 1) {
        for (let i = 0; i < users.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await joinPoll({
            maciAddress: maciAddresses.maciAddress,
            privateKey: users[i].privKey.serialize(),
            pollPrivKey: pollKeys[i].privKey.serialize(),
            stateIndex: BigInt(i + 1),
            pollId: BigInt(p),
            pollJoiningZkey: pollJoiningTestZkeyPath,
            useWasm: true,
            pollWasm: testPollJoiningWasmPath,
            pollWitgen: testPollJoiningWitnessPath,
            rapidsnark: testRapidsnarkPath,
            signer,
            newVoiceCreditBalance: 1n,
            quiet: true,
          });
          // eslint-disable-next-line no-await-in-loop
          const { isJoined, pollStateIndex } = await isJoinedUser({
            maciAddress: maciAddresses.maciAddress,
            pollId: BigInt(p),
            pollPubKey: pollKeys[i].pubKey.serialize(),
            signer,
            startBlock: 0,
            quiet: true,
          });

          expect(isJoined).to.eq(true);
          expect(pollStateIndex).to.not.eq(undefined);
        }
      }
    });

    it("should publish messages to the second poll", async () => {
      await publish({
        pubkey: pollKeys[0].pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 0n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[0].privKey.serialize(),
        signer,
      });

      await publish({
        pubkey: pollKeys[1].pubKey.serialize(),
        stateIndex: 2n,
        voteOptionIndex: 3n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 1n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[1].privKey.serialize(),
        signer,
      });

      await publish({
        pubkey: pollKeys[2].pubKey.serialize(),
        stateIndex: 3n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 1n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[2].privKey.serialize(),
        signer,
      });
    });

    it("should publish messages to the third poll", async () => {
      await publish({
        pubkey: pollKeys[3].pubKey.serialize(),
        stateIndex: 3n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 2n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[3].privKey.serialize(),
        signer,
      });

      await publish({
        pubkey: pollKeys[4].pubKey.serialize(),
        stateIndex: 4n,
        voteOptionIndex: 7n,
        nonce: 1n,
        pollId: 2n,
        newVoteWeight: 2n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[4].privKey.serialize(),
        signer,
      });

      await publish({
        pubkey: pollKeys[5].pubKey.serialize(),
        stateIndex: 5n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 2n,
        newVoteWeight: 9n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys[5].privKey.serialize(),
        signer,
      });
    });

    it("should complete the second poll", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ pollId: 1n, signer });
      const tallyData = await genProofs({ ...genProofsArgs, pollId: 1n, signer });
      await proveOnChain({
        ...proveOnChainArgs,
        pollId: 1n,
        maciAddress: maciAddresses.maciAddress,
        messageProcessorAddress: pollAddresses.messageProcessor,
        tallyAddress: pollAddresses.tally,
        signer,
      });
      await verify({
        ...verifyArgs(),
        pollId: 1n,
        tallyData,
        maciAddress: maciAddresses.maciAddress,
        tallyAddress: pollAddresses.tally,
        signer,
      });
      clean();
    });

    it("should complete the third poll", async () => {
      await mergeSignups({ pollId: 2n, signer });
      const tallyData = await genProofs({ ...genProofsArgs, pollId: 2n, signer });
      await proveOnChain({
        ...proveOnChainArgs,
        pollId: 2n,
        maciAddress: maciAddresses.maciAddress,
        messageProcessorAddress: secondPollAddresses.messageProcessor,
        tallyAddress: secondPollAddresses.tally,
        signer,
      });
      await verify({
        ...verifyArgs(),
        pollId: 2n,
        tallyData,
        maciAddress: maciAddresses.maciAddress,
        tallyAddress: secondPollAddresses.tally,
        signer,
      });
    });
  });

  describe("pre fetch logs", () => {
    const stateOutPath = "./state.json";

    const user = new Keypair();
    const pollKeys = new Keypair();

    after(() => {
      clean();

      if (fs.existsSync(stateOutPath)) {
        fs.unlinkSync(stateOutPath);
      }
    });

    before(async () => {
      // deploy the smart contracts
      maciAddresses = await deploy({ ...deployArgs, signer });
      // deploy a poll contract
      pollAddresses = await deployPoll({ ...deployPollArgs, signer });
    });

    it("should signup one user", async () => {
      await signup({ maciAddress: maciAddresses.maciAddress, maciPubKey: user.pubKey.serialize(), signer });
    });

    it("should join one user", async () => {
      // joinPoll
      await joinPoll({
        maciAddress: maciAddresses.maciAddress,
        privateKey: user.privKey.serialize(),
        pollPrivKey: pollKeys.privKey.serialize(),
        stateIndex: 1n,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm: true,
        pollWasm: testPollJoiningWasmPath,
        pollWitgen: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        signer,
        newVoiceCreditBalance: 1n,
        quiet: true,
      });
    });

    it("should publish one message", async () => {
      await publish({
        pubkey: pollKeys.pubKey.serialize(),
        stateIndex: 1n,
        voteOptionIndex: 5n,
        nonce: 1n,
        pollId: 0n,
        newVoteWeight: 3n,
        maciAddress: maciAddresses.maciAddress,
        salt: genRandomSalt(),
        privateKey: pollKeys.privKey.serialize(),
        signer,
      });
    });

    it("should generate zk-SNARK proofs and verify them", async () => {
      await timeTravel({ ...timeTravelArgs, signer });
      await mergeSignups({ ...mergeSignupsArgs, signer });
      await genLocalState({
        outputPath: stateOutPath,
        coordinatorPrivateKey: coordinatorPrivKey,
        blockPerBatch: 50,
        pollId: 0n,
        signer,
      });
      await genProofs({
        ...genProofsArgs,
        stateFile: stateOutPath,
        signer,
      });
      await proveOnChain({ ...proveOnChainArgs, signer });
      await verify({ ...verifyArgs(), signer });
    });
  });
});
