import { Keypair } from "@maci-protocol/domainobjs";
import {
  getBlockTimestamp,
  getDefaultSigner,
  getJoinedUserData,
  joinPoll,
  setVerifyingKeys,
  signup,
  deployPoll,
  deployVkRegistryContract,
  type IMaciContracts,
  deployFreeForAllSignUpPolicy,
  deployConstantInitialVoiceCreditProxy,
  deployVerifier,
  deployMaci,
} from "@maci-protocol/sdk";
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

  const user = new Keypair();
  const userPrivateKey = user.privKey.serialize();
  const userPublicKey = user.pubKey.serialize();

  const mockStateIndex = 1n;
  const mockPollId = 9000n;

  this.timeout(900000);
  // before all tests we deploy the vk registry contract and set the verifying keys
  before(async () => {
    signer = await getDefaultSigner();

    const [signupPolicy] = await deployFreeForAllSignUpPolicy(signer, true);
    const signupPolicyContractAddress = await signupPolicy.getAddress();

    const [pollPolicy] = await deployFreeForAllSignUpPolicy(signer, true);
    const pollPolicyContractAddress = await pollPolicy.getAddress();

    const initialVoiceCreditProxy = await deployConstantInitialVoiceCreditProxy(
      DEFAULT_INITIAL_VOICE_CREDITS,
      signer,
      true,
    );
    initialVoiceCreditProxyContractAddress = await initialVoiceCreditProxy.getAddress();

    const verifier = await deployVerifier(signer, true);
    verifierContractAddress = await verifier.getAddress();

    const startDate = await getBlockTimestamp(signer);

    // we deploy the vk registry contract
    const vkRegistryAddress = await deployVkRegistryContract({ signer });
    // we set the verifying keys
    await setVerifyingKeys({ ...(await verifyingKeysArgs(signer)), vkRegistryAddress });
    // deploy the smart contracts
    maciAddresses = await deployMaci({
      ...deployArgs,
      signer,
      signupPolicyAddress: signupPolicyContractAddress,
    });

    // signup the user
    await signup({
      maciAddress: maciAddresses.maciContractAddress,
      maciPubKey: userPublicKey,
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
      vkRegistryContractAddress: vkRegistryAddress,
      policyContractAddress: pollPolicyContractAddress,
      initialVoiceCreditProxyContractAddress,
    });
  });

  it("should allow to join the poll and return the user data", async () => {
    const startBlock = await signer.provider?.getBlockNumber();

    await joinPoll({
      maciAddress: maciAddresses.maciContractAddress,
      privateKey: userPrivateKey,
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
      pollPubKey: user.pubKey.serialize(),
      signer,
      startBlock: startBlock || 0,
    });

    expect(registeredUserData.isJoined).to.eq(true);
    expect(BigInt(registeredUserData.pollStateIndex!)).to.eq(1);
  });

  it("should throw error if poll does not exist", async () => {
    await expect(
      joinPoll({
        maciAddress: maciAddresses.maciContractAddress,
        privateKey: userPrivateKey,
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
        privateKey: keypair.privKey.serialize(),
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
        privateKey: userPrivateKey,
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
