import { generateRandomSalt } from "@maci-protocol/crypto";
import { Keypair } from "@maci-protocol/domainobjs";
import {
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

import type { Signer } from "ethers";

import {
  DEFAULT_INITIAL_VOICE_CREDITS,
  DEFAULT_SG_DATA,
  DEFAULT_IVCP_DATA,
  deployPollArgs,
  coordinatorPrivateKey,
  proveOnChainArgs,
  verifyArgs,
  mergeSignupsArgs,
  testProofsDirPath,
  testRapidsnarkPath,
  testTallyFilePath,
  deployArgs,
  verifyingKeysArgs,
  testPollJoiningZkeyPath,
  testPollJoiningWasmPath,
  testPollJoiningWitnessPath,
  testProcessMessagesFullWitnessPath,
  testProcessMessagesFullWitnessDatPath,
  testTallyVotesFullWitnessPath,
  testTallyVotesFullWitnessDatPath,
  testProcessMessagesFullWasmPath,
  testTallyVotesFullWasmPath,
  testProcessMessageFullZkeyPath,
  testTallyVotesFullZkeyPath,
  // testVoteTallyNonQvZkeyPath,
  // testProcessMessageNonQvZkeyPath,
  // testProcessMessagesNonQvWitnessPath,
  // testProcessMessagesNonQvWitnessDatPath,
  // testVoteTallyNonQvWitnessPath,
  // testVoteTallyNonQvWitnessDatPath,
  // testProcessMessagesNonQvWasmPath,
  // testVoteTallyNonQvWasmPath,
  // testTallyVotesZkeyPath,
  // testProcessMessageZkeyPath,
  // testProcessMessagesWitnessPath,
  // testProcessMessagesWitnessDatPath,
  // testTallyVotesWitnessPath,
  // testTallyVotesWitnessDatPath,
  // testProcessMessagesWasmPath,
  // testTallyVotesWasmPath,
} from "../../constants";
import { clean } from "../../utils";

const filePerMode = {
  [EMode.FULL]: {
    voteTallyZkey: testTallyVotesFullZkeyPath,
    messageProcessorZkey: testProcessMessageFullZkeyPath,
    messageProcessorWitnessGenerator: testProcessMessagesFullWitnessPath,
    messageProcessorWitnessDatFile: testProcessMessagesFullWitnessDatPath,
    voteTallyWitnessGenerator: testTallyVotesFullWitnessPath,
    voteTallyWitnessDatFile: testTallyVotesFullWitnessDatPath,
    messageProcessorWasm: testProcessMessagesFullWasmPath,
    voteTallyWasm: testTallyVotesFullWasmPath,
  },

  // [EMode.NON_QV]: {
  //   voteTallyZkey: testVoteTallyNonQvZkeyPath,
  //   messageProcessorZkey: testProcessMessageNonQvZkeyPath,
  //   messageProcessorWitnessGenerator: testProcessMessagesNonQvWitnessPath,
  //   messageProcessorWitnessDatFile: testProcessMessagesNonQvWitnessDatPath,
  //   voteTallyWitnessGenerator: testVoteTallyNonQvWitnessPath,
  //   voteTallyWitnessDatFile: testVoteTallyNonQvWitnessDatPath,
  //   messageProcessorWasm: testProcessMessagesNonQvWasmPath,
  //   voteTallyWasm: testVoteTallyNonQvWasmPath,
  // },

  // [EMode.QV]: {
  //   voteTallyZkey: testTallyVotesZkeyPath,
  //   messageProcessorZkey: testProcessMessageZkeyPath,
  //   messageProcessorWitnessGenerator: testProcessMessagesWitnessPath,
  //   messageProcessorWitnessDatFile: testProcessMessagesWitnessDatPath,
  //   voteTallyWitnessGenerator: testTallyVotesWitnessPath,
  //   voteTallyWitnessDatFile: testTallyVotesWitnessDatPath,
  //   messageProcessorWasm: testProcessMessagesWasmPath,
  //   voteTallyWasm: testTallyVotesWasmPath,
  // },
};

const numberSignups = 10;
const numberMessagesPerUser = 2;
const pollDuration = 900_000;

Object.entries(filePerMode).forEach((data) => {
  const mode = Number(data[0]) as EMode;
  const files = data[1];

  describe(`stress tests ${EMode[mode]}`, function test() {
    const useWasm = false;
    this.timeout(pollDuration);

    let maciAddresses: IMaciContracts;
    let initialVoiceCreditProxyContractAddress: string;
    let verifierContractAddress: string;
    let signer: Signer;
    let verifyingKeysRegistryAddress: string;

    const generateProofsArgs: Omit<IGenerateProofsArgs, "maciAddress" | "signer"> = {
      outputDir: testProofsDirPath,
      tallyFile: testTallyFilePath,
      voteTallyZkey: files.voteTallyZkey,
      messageProcessorZkey: files.messageProcessorZkey,
      pollId: 0n,
      rapidsnark: testRapidsnarkPath,
      messageProcessorWitnessGenerator: files.messageProcessorWitnessGenerator,
      messageProcessorWitnessDatFile: files.messageProcessorWitnessDatFile,
      voteTallyWitnessGenerator: files.voteTallyWitnessGenerator,
      voteTallyWitnessDatFile: files.voteTallyWitnessDatFile,
      coordinatorPrivateKey,
      messageProcessorWasm: files.messageProcessorWasm,
      voteTallyWasm: files.voteTallyWasm,
      useWasm,
      mode,
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
        mode,
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
      await setVerifyingKeys({
        ...(await verifyingKeysArgs(signer, [mode])),
        verifyingKeysRegistryAddress,
      });
    });

    describe(`${numberSignups} signup(s), ${numberSignups * numberMessagesPerUser} message(s)`, () => {
      const users = Array.from({ length: numberSignups }, () => new Keypair());

      before(async () => {
        // deploy the smart contracts
        maciAddresses = await prepareTest();
      });

      after(async () => {
        await clean();
      });

      it("should signup users", async () => {
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let index = 0; index < users.length; index += 1) {
          // eslint-disable-next-line no-await-in-loop
          await signup({
            maciAddress: maciAddresses.maciContractAddress,
            maciPublicKey: users[index].publicKey.serialize(),
            sgData: DEFAULT_SG_DATA,
            signer,
          });
        }
      });

      it("should join users", async () => {
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

      it("should publish messages", async () => {
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let index = 0; index < users.length; index += 1) {
          for (let voteOptionIndex = numberMessagesPerUser; voteOptionIndex >= 0; voteOptionIndex -= 1) {
            // eslint-disable-next-line no-await-in-loop
            await publish({
              publicKey: users[index].publicKey.serialize(),
              stateIndex: BigInt(index + 1),
              voteOptionIndex: BigInt(voteOptionIndex),
              nonce: 1n,
              pollId: 0n,
              newVoteWeight: BigInt(DEFAULT_INITIAL_VOICE_CREDITS),
              maciAddress: maciAddresses.maciContractAddress,
              salt: generateRandomSalt(),
              privateKey: users[index].privateKey.serialize(),
              signer,
            });
          }
        }
      });

      it.skip("should generate zk-SNARK proofs and verify them", async () => {
        await timeTravel({ seconds: pollDuration, signer });
        await mergeSignups({ ...mergeSignupsArgs, maciAddress: maciAddresses.maciContractAddress, signer });
        const { tallyData: tallyFileData } = await generateProofs({
          ...generateProofsArgs,
          maciAddress: maciAddresses.maciContractAddress,
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
  });
});
