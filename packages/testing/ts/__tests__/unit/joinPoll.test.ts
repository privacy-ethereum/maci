import { getSigners } from "@maci-protocol/contracts";
import { Keypair } from "@maci-protocol/domainobjs";
import {
  getBlockTimestamp,
  getJoinedUserData,
  joinPoll,
  setVerifyingKeys,
  signup,
  deployPoll,
  type IMaciContracts,
  deployFreeForAllSignUpPolicy,
  deployConstantInitialVoiceCreditProxy,
  deployMaci,
  generateMaciStateTreeWithEndKey,
  deployConstantInitialVoiceCreditProxyFactory,
} from "@maci-protocol/sdk";
import { joinPoll as joinPollBrowser } from "@maci-protocol/sdk/browser";
import { expect } from "chai";
import { type Signer } from "ethers";

import {
  DEFAULT_INITIAL_VOICE_CREDITS,
  DEFAULT_IVCP_DATA,
  DEFAULT_SG_DATA,
  deployArgs,
  deployPollArgs,
  testPollJoiningZkeyPath,
  testPollJoiningWasmPath,
  testRapidsnarkPath,
  testPollJoiningWitnessPath,
  pollDuration,
  verifyingKeysArgs,
} from "../../constants";
import { isArm } from "../../utils";

const useWasm = isArm();

describe("joinPoll", function test() {
  let signer: Signer;
  let userSigners: Signer[];
  let maciAddresses: IMaciContracts;
  let initialVoiceCreditProxyContractAddress: string;

  const users = new Array(3).fill(undefined).map(() => new Keypair());

  const mockPollId = 9000n;

  this.timeout(900000);
  // before all tests we deploy the verifying keys registry contract and set the verifying keys
  before(async () => {
    const signers = await getSigners();
    [signer, ...userSigners] = signers;
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

    const constantInitialVoiceCreditProxyFactory = await deployConstantInitialVoiceCreditProxyFactory(signer, true);
    const initialVoiceCreditProxy = await deployConstantInitialVoiceCreditProxy(
      { amount: DEFAULT_INITIAL_VOICE_CREDITS },
      constantInitialVoiceCreditProxyFactory,
      signer,
    );
    initialVoiceCreditProxyContractAddress = await initialVoiceCreditProxy.getAddress();

    const startDate = await getBlockTimestamp(signer);

    // deploy the smart contracts
    maciAddresses = await deployMaci({
      ...deployArgs,
      signer,
      signupPolicyAddress: signupPolicyContractAddress,
    });

    // we set the verifying keys
    const { verifyingKeysRegistryContractAddress } = maciAddresses;
    await setVerifyingKeys({
      ...(await verifyingKeysArgs(signer)),
      verifyingKeysRegistryAddress: verifyingKeysRegistryContractAddress,
    });

    // signup the user
    await signup({
      maciAddress: maciAddresses.maciContractAddress,
      maciPublicKey: users[0].publicKey.serialize(),
      sgData: DEFAULT_SG_DATA,
      signer: userSigners[0],
    });

    await signup({
      maciAddress: maciAddresses.maciContractAddress,
      maciPublicKey: users[1].publicKey.serialize(),
      sgData: DEFAULT_SG_DATA,
      signer: userSigners[1],
    });

    await signup({
      maciAddress: maciAddresses.maciContractAddress,
      maciPublicKey: users[2].publicKey.serialize(),
      sgData: DEFAULT_SG_DATA,
      signer: userSigners[2],
    });

    // deploy a poll contract
    await deployPoll({
      ...deployPollArgs,
      signer,
      pollStartTimestamp: startDate,
      pollEndTimestamp: startDate + pollDuration,
      relayers: [await signer.getAddress()],
      maciAddress: maciAddresses.maciContractAddress,
      policyContractAddress: pollPolicyContractAddress,
      initialVoiceCreditProxyContractAddress,
    });
  });

  it("should allow to join the poll and return the user data", async () => {
    const startBlock = await signer.provider?.getBlockNumber();

    await joinPoll({
      maciAddress: maciAddresses.maciContractAddress,
      privateKey: users[0].privateKey.serialize(),
      signer: userSigners[0],
      pollId: 0n,
      pollJoiningZkey: testPollJoiningZkeyPath,
      useWasm,
      pollJoiningWasm: testPollJoiningWasmPath,
      pollWitnessGenerator: testPollJoiningWitnessPath,
      rapidsnark: testRapidsnarkPath,
      sgDataArg: DEFAULT_SG_DATA,
      ivcpDataArg: DEFAULT_IVCP_DATA,
    });

    const registeredUserData = await getJoinedUserData({
      maciAddress: maciAddresses.maciContractAddress,
      pollId: 0n,
      pollPublicKey: users[0].publicKey.serialize(),
      signer: userSigners[0],
      startBlock: startBlock || 0,
    });

    expect(registeredUserData.isJoined).to.eq(true);
    expect(BigInt(registeredUserData.pollStateIndex!)).to.eq(1);
  });

  it("should allow to join the poll using a precomputed inclusion proof", async () => {
    const startBlock = await signer.provider?.getBlockNumber();

    const stateTree = await generateMaciStateTreeWithEndKey({
      maciContractAddress: maciAddresses.maciContractAddress,
      signer: userSigners[1],
      userPublicKey: users[1].publicKey,
    });

    const inclusionProof = stateTree.signUpTree.generateProof(2);

    await joinPollBrowser({
      maciAddress: maciAddresses.maciContractAddress,
      privateKey: users[1].privateKey.serialize(),
      signer: userSigners[1],
      pollId: 0n,
      inclusionProof,
      pollJoiningZkey: testPollJoiningZkeyPath,
      pollJoiningWasm: testPollJoiningWasmPath,
      sgDataArg: DEFAULT_SG_DATA,
      ivcpDataArg: DEFAULT_IVCP_DATA,
    });

    const registeredUserData = await getJoinedUserData({
      maciAddress: maciAddresses.maciContractAddress,
      pollId: 0n,
      pollPublicKey: users[1].publicKey.serialize(),
      signer: userSigners[1],
      startBlock: startBlock || 0,
    });

    expect(registeredUserData.isJoined).to.eq(true);
    expect(BigInt(registeredUserData.pollStateIndex!)).to.eq(2);
  });

  it("should throw error if poll does not exist", async () => {
    await expect(
      joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: users[0].privateKey.serialize(),
        signer,
        pollId: mockPollId,
        pollJoiningZkey: testPollJoiningZkeyPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
      }),
    ).eventually.rejectedWith("PollDoesNotExist(9000)");
  });

  it("should throw error if user did not sign up to maci and therefore state index is invalid", async () => {
    const keypair = new Keypair();

    await expect(
      joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: keypair.privateKey.serialize(),
        signer,
        pollId: 0n,
        pollJoiningZkey: testPollJoiningZkeyPath,
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
        signer,
        pollId: -1n,
        pollJoiningZkey: testPollJoiningZkeyPath,
        sgDataArg: DEFAULT_SG_DATA,
        ivcpDataArg: DEFAULT_IVCP_DATA,
      }),
    ).eventually.rejectedWith("Invalid poll id");
  });
});
