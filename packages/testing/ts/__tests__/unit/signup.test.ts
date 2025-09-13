import { Keypair } from "@maci-protocol/domainobjs";
import {
  getDefaultSigner,
  getSignedupUserData,
  type IMaciContracts,
  setVerifyingKeys,
  signup,
  deployMaci,
  deployFreeForAllSignUpPolicy,
  deployVerifyingKeysRegistryContract,
} from "@maci-protocol/sdk";
import { expect } from "chai";
import { type Signer } from "ethers";

import { deployArgs, verifyingKeysArgs, DEFAULT_SG_DATA } from "../../constants";

describe("signup", function test() {
  this.timeout(900000);

  let signer: Signer;
  let maciAddresses: IMaciContracts;

  const user = new Keypair();
  // before all tests we deploy the verifying keys registry contract and set the verifying keys
  before(async () => {
    signer = await getDefaultSigner();
    const [signupPolicy] = await deployFreeForAllSignUpPolicy({}, signer, true);
    const signupPolicyContractAddress = await signupPolicy.getAddress();

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
  });

  it("should allow to signup and return the user data", async () => {
    const startBlock = await signer.provider?.getBlockNumber();

    const signUpData = await signup({
      maciAddress: maciAddresses.maciContractAddress,
      maciPublicKey: user.publicKey.serialize(),
      sgData: DEFAULT_SG_DATA,
      signer,
    });

    const registeredUserData = await getSignedupUserData({
      maciAddress: maciAddresses.maciContractAddress,
      startBlock,
      maciPublicKey: user.publicKey.serialize(),
      signer,
    });

    expect(registeredUserData.isRegistered).to.eq(true);
    expect(registeredUserData.stateIndex).to.eq(signUpData.stateIndex);
  });

  it("should not get the user data if the user is not registered", async () => {
    const registeredUserData = await getSignedupUserData({
      maciAddress: maciAddresses.maciContractAddress,
      startBlock: await signer.provider?.getBlockNumber(),
      maciPublicKey: new Keypair().publicKey.serialize(),
      signer,
    });

    expect(registeredUserData.isRegistered).to.eq(false);
  });

  it("should start fetchig from block zero if the start block is not provided", async () => {
    const registeredUserData = await getSignedupUserData({
      maciAddress: maciAddresses.maciContractAddress,
      maciPublicKey: user.publicKey.serialize(),
      signer,
    });

    expect(registeredUserData.isRegistered).to.eq(true);
  });
});
