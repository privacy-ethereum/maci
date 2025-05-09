import { Keypair } from "@maci-protocol/domainobjs";
import {
  getBlockTimestamp,
  getDefaultSigner,
  getJoinedUserData,
  joinPoll,
  setVerifyingKeys,
  signup,
  deployPoll,
  deployVerifyingKeysRegistryContract,
  type IMaciContracts,
  deployFreeForAllSignUpPolicy,
  deployConstantInitialVoiceCreditProxy,
  deployVerifier,
  deployMaci,
  MACI__factory as MACIFactory,
  genMaciStateTreeWithEndKey,
} from "@maci-protocol/sdk";
import { downloadPollJoiningArtifactsBrowser, joinPoll as joinPollBrowser } from "@maci-protocol/sdk/browser";
import { expect } from "chai";
import { Signer } from "ethers";

import {
  DEFAULT_INITIAL_VOICE_CREDITS,
  DEFAULT_IVCP_DATA,
  DEFAULT_SG_DATA,
  deployArgs,
  deployPollArgs,
  pollJoiningTestZkeyPath,
  testPollJoiningWasmPath,
  testRapidsnarkPath,
  testPollJoiningWitnessPath,
  pollDuration,
  verifyingKeysArgs,
} from "../../constants";

describe("joinPoll", function test() {
  let signer: Signer;
  let maciAddresses: IMaciContracts;
  let initialVoiceCreditProxyContractAddress: string;
  let verifierContractAddress: string;

  const users = new Array(3).fill(undefined).map(() => new Keypair());

  const mockStateIndex = 1n;
  const mockPollId = 9000n;

  this.timeout(900000);
  // before all tests we deploy the verifying keys registry contract and set the verifying keys
  before(async () => {
    signer = await getDefaultSigner();

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

    const [initialVoiceCreditProxy] = await deployConstantInitialVoiceCreditProxy(
      { amount: DEFAULT_INITIAL_VOICE_CREDITS },
      signer,
      undefined,
      true,
    );
    initialVoiceCreditProxyContractAddress = await initialVoiceCreditProxy.getAddress();

    const verifier = await deployVerifier(signer, true);
    verifierContractAddress = await verifier.getAddress();

    const startDate = await getBlockTimestamp(signer);

    // we deploy the verifying keys registry contract
    const verifyingKeysRegistryAddress = await deployVerifyingKeysRegistryContract({ signer });
    // we set the verifying keys
    await setVerifyingKeys({ ...(await verifyingKeysArgs(signer)), verifyingKeysRegistryAddress });
    // deploy the smart contracts
    maciAddresses = await deployMaci({
      ...deployArgs,
      signer,
      signupPolicyAddress: signupPolicyContractAddress,
    });

    // signup the user
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

    await signup({
      maciAddress: maciAddresses.maciContractAddress,
      maciPublicKey: users[2].publicKey.serialize(),
      sgData: DEFAULT_SG_DATA,
      signer,
    });

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

  it("should allow to join the poll and return the user data", async () => {
    const startBlock = await signer.provider?.getBlockNumber();

    await joinPoll({
      maciAddress: maciAddresses.maciContractAddress,
      privateKey: users[0].privateKey.serialize(),
      stateIndex: 1n,
      signer,
      pollId: 0n,
      pollJoiningZkey: pollJoiningTestZkeyPath,
      useWasm: true,
      pollWasm: testPollJoiningWasmPath,
      pollWitgen: testPollJoiningWitnessPath,
      rapidsnark: testRapidsnarkPath,
      sgDataArg: DEFAULT_SG_DATA,
      ivcpDataArg: DEFAULT_IVCP_DATA,
    });

    const registeredUserData = await getJoinedUserData({
      maciAddress: maciAddresses.maciContractAddress,
      pollId: 0n,
      pollPublicKey: users[0].publicKey.serialize(),
      signer,
      startBlock: startBlock || 0,
    });

    expect(registeredUserData.isJoined).to.eq(true);
    expect(BigInt(registeredUserData.pollStateIndex!)).to.eq(1);
  });

  it("should allow to join the poll and return the user data using a downloaded zKey", async () => {
    const startBlock = await signer.provider?.getBlockNumber();

    const { zKey, wasm } = await downloadPollJoiningArtifactsBrowser({
      testing: true,
      stateTreeDepth: 10,
    });

    await joinPollBrowser({
      maciAddress: maciAddresses.maciContractAddress,
      privateKey: users[1].privateKey.serialize(),
      stateIndex: 2n,
      signer,
      pollId: 0n,
      pollJoiningZkey: zKey as unknown as string,
      useWasm: true,
      pollWasm: wasm as unknown as string,
      sgDataArg: DEFAULT_SG_DATA,
      ivcpDataArg: DEFAULT_IVCP_DATA,
      useLatestStateIndex: true,
    });

    const registeredUserData = await getJoinedUserData({
      maciAddress: maciAddresses.maciContractAddress,
      pollId: 0n,
      pollPublicKey: users[1].publicKey.serialize(),
      signer,
      startBlock: startBlock || 0,
    });

    expect(registeredUserData.isJoined).to.eq(true);
    expect(BigInt(registeredUserData.pollStateIndex!)).to.eq(2);
  });

  it("should allow to join the poll using a precomputed inclusion proof", async () => {
    const startBlock = await signer.provider?.getBlockNumber();

    const stateTree = await genMaciStateTreeWithEndKey({
      maciContractAddress: maciAddresses.maciContractAddress,
      signer,
      userPublicKey: users[2].publicKey,
    });

    const inclusionProof = stateTree.signUpTree.generateProof(3);

    const { zKey, wasm } = await downloadPollJoiningArtifactsBrowser({
      testing: true,
      stateTreeDepth: 10,
    });

    await joinPollBrowser({
      maciAddress: maciAddresses.maciContractAddress,
      privateKey: users[2].privateKey.serialize(),
      stateIndex: 3n,
      signer,
      pollId: 0n,
      inclusionProof,
      pollJoiningZkey: zKey as unknown as string,
      pollWasm: wasm as unknown as string,
      sgDataArg: DEFAULT_SG_DATA,
      ivcpDataArg: DEFAULT_IVCP_DATA,
    });

    const registeredUserData = await getJoinedUserData({
      maciAddress: maciAddresses.maciContractAddress,
      pollId: 0n,
      pollPublicKey: users[2].publicKey.serialize(),
      signer,
      startBlock: startBlock || 0,
    });

    expect(registeredUserData.isJoined).to.eq(true);
    expect(BigInt(registeredUserData.pollStateIndex!)).to.eq(3);
  });

  it("should throw error if poll does not exist", async () => {
    await expect(
      joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[0].privateKey.serialize(),
        stateIndex: mockStateIndex,
        signer,
        pollId: mockPollId,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
      }),
    ).eventually.rejectedWith("PollDoesNotExist(9000)");
  });

  it("should throw error if state index is invalid", async () => {
    const keypair = new Keypair();

    await expect(
      joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: keypair.privateKey.serialize(),
        stateIndex: -1n,
        signer,
        pollId: 0n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
      }),
    ).eventually.rejectedWith("Invalid state index");
  });

  it("should throw error if current poll id is invalid", async () => {
    await expect(
      joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[0].privateKey.serialize(),
        stateIndex: mockStateIndex,
        signer,
        pollId: -1n,
        pollJoiningZkey: pollJoiningTestZkeyPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
      }),
    ).eventually.rejectedWith("Invalid poll id");
  });
});
