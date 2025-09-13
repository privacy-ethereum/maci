import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type Signer, ZeroAddress } from "ethers";

import type {
  MACI,
  GitcoinPassportChecker,
  GitcoinPassportPolicy,
  MockGitcoinPassportDecoder,
} from "../../typechain-types";

import { deployContract, deployGitcoinPassportPolicy, getDefaultSigner, getSigners } from "../../ts";
import { initialVoiceCreditBalance, STATE_TREE_DEPTH } from "../constants";
import { deployTestContracts } from "../utils";

describe("GitcoinPassport", () => {
  let gitcoinPolicy: GitcoinPassportPolicy;
  let gitcoinChecker: GitcoinPassportChecker;
  let maciContract: MACI;
  let mockDecoder: MockGitcoinPassportDecoder;

  let signer: Signer;
  let signerAddress: string;
  let decoderAddress: string;

  // @note score is 4 digit (2 decimals)
  // 50.00
  const passingScore = 5000;

  const user = new Keypair();
  const secondUser = new Keypair();

  before(async () => {
    signer = await getDefaultSigner();
    signerAddress = await signer.getAddress();
    mockDecoder = await deployContract("MockGitcoinPassportDecoder", signer, true);
    decoderAddress = await mockDecoder.getAddress();
    [gitcoinPolicy, gitcoinChecker] = await deployGitcoinPassportPolicy(
      { decoderAddress, minimumScore: passingScore },
      {},
      signer,
      true,
    );

    const r = await deployTestContracts({
      initialVoiceCreditBalance,
      stateTreeDepth: STATE_TREE_DEPTH,
      signer,
      policy: gitcoinPolicy,
    });
    maciContract = r.maciContract;
  });

  describe("Deployment", () => {
    it("The policy should be deployed correctly", async () => {
      expect(gitcoinPolicy).to.not.eq(undefined);
      expect(await gitcoinPolicy.getAddress()).to.not.eq(ZeroAddress);
    });
  });

  describe("GitcoinGakeeper", () => {
    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await gitcoinPolicy.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await gitcoinPolicy.guarded()).to.eq(maciAddress);
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      const [, secondSigner] = await getSigners();
      await expect(gitcoinPolicy.connect(secondSigner).setTarget(signerAddress)).to.be.revertedWithCustomError(
        gitcoinPolicy,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should fail to set guarded target when the MACI instance is not valid", async () => {
      await expect(gitcoinPolicy.setTarget(ZeroAddress)).to.be.revertedWithCustomError(gitcoinPolicy, "ZeroAddress");
    });

    it("should throw when the score is not high enough", async () => {
      await expect(maciContract.signUp(user.publicKey.asContractParam(), "0x")).to.be.revertedWithCustomError(
        gitcoinChecker,
        "ScoreTooLow",
      );
    });

    it("should allow to signup when the score is high enough", async () => {
      await mockDecoder.changeScore(passingScore * 100).then((tx) => tx.wait());
      await maciContract.signUp(user.publicKey.asContractParam(), "0x").then((tx) => tx.wait());

      expect(await gitcoinPolicy.enforcedUsers(signerAddress)).to.eq(true);
    });

    it("should prevent signing up twice", async () => {
      await expect(maciContract.signUp(user.publicKey.asContractParam(), "0x")).to.be.revertedWithCustomError(
        gitcoinPolicy,
        "AlreadyEnforced",
      );
    });

    it("should signup via MACI", async () => {
      const [, secondSigner] = await getSigners();

      const tx = await maciContract
        .connect(secondSigner)
        .signUp(secondUser.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1]));

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });
  });
});
