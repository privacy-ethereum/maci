import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, ZeroAddress, type Signer } from "ethers";

import type {
  MACI,
  FreeForAllPolicy,
  MockToken,
  TokenChecker,
  TokenPolicy,
  TokenCheckerFactory,
  TokenPolicyFactory,
} from "../../typechain-types";

import { deploySignupToken, deploySignupTokenPolicy, deployFreeForAllSignUpPolicy } from "../../ts/deploy";
import { getDefaultSigner } from "../../ts/utils";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("SignUpPolicy", () => {
  let signUpToken: MockToken;
  let freeForAllContract: FreeForAllPolicy;
  let tokenPolicyContract: TokenPolicy;
  let tokenChecker: TokenChecker;
  let tokenCheckerFactory: TokenCheckerFactory;
  let tokenPolicyFactory: TokenPolicyFactory;
  let signer: Signer;

  before(async () => {
    signer = await getDefaultSigner();
    [freeForAllContract] = await deployFreeForAllSignUpPolicy({}, signer, true);
    signUpToken = await deploySignupToken(signer, true);
    [tokenPolicyContract, tokenChecker, tokenPolicyFactory, tokenCheckerFactory] = await deploySignupTokenPolicy(
      { token: await signUpToken.getAddress() },
      {},
      signer,
      true,
    );
  });

  describe("Deployment", () => {
    it("should be deployed correctly", () => {
      expect(freeForAllContract).to.not.eq(undefined);
      expect(signUpToken).to.not.eq(undefined);
      expect(tokenPolicyContract).to.not.eq(undefined);
      expect(tokenChecker).to.not.eq(undefined);
    });

    it("TokenPolicy has token address set", async () => {
      expect(await tokenChecker.token()).to.eq(await signUpToken.getAddress());
    });
  });

  describe("TokenPolicy", () => {
    let maciContract: MACI;

    beforeEach(async () => {
      signUpToken = await deploySignupToken(signer, true);
      [tokenPolicyContract, tokenChecker] = await deploySignupTokenPolicy(
        { token: await signUpToken.getAddress() },
        { checker: tokenCheckerFactory, policy: tokenPolicyFactory },
        signer,
        true,
      );

      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
        policy: tokenPolicyContract,
      });

      maciContract = r.maciContract;
    });

    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await tokenPolicyContract.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await tokenPolicyContract.guarded()).to.eq(maciAddress);
    });

    it("it should revert if the register function is called by a non registered maci instance", async () => {
      const user = new Keypair();

      await signUpToken.giveToken(await signer.getAddress(), 0);

      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1])),
      ).to.be.revertedWithCustomError(tokenPolicyContract, "TargetOnly");
    });

    it("should register a user if the register function is called by a registered maci instance", async () => {
      const user = new Keypair();

      await signUpToken.giveToken(await signer.getAddress(), 0);

      const maciAddress = await maciContract.getAddress();
      await tokenPolicyContract.setTarget(maciAddress).then((tx) => tx.wait());

      const tx = await maciContract.signUp(
        user.publicKey.asContractParam(),
        AbiCoder.defaultAbiCoder().encode(["uint256"], [0]),
      );
      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });
  });

  describe("FreeForAllPolicy", () => {
    it("should always complete successfully", async () => {
      await freeForAllContract.setTarget(await signer.getAddress()).then((tx) => tx.wait());

      const tx = await freeForAllContract.enforce(ZeroAddress, AbiCoder.defaultAbiCoder().encode(["uint256"], [1]));
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });
  });
});
