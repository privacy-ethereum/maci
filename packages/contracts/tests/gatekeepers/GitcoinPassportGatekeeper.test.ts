import { expect } from "chai";
import { AbiCoder, Signer, ZeroAddress } from "ethers";
import { Keypair } from "maci-domainobjs";

import { deployContract, deployGitcoinPassportGatekeeper, getDefaultSigner, getSigners } from "../../ts";
import {
  GitcoinPassportChecker,
  GitcoinPassportGatekeeper,
  MACI,
  MockGitcoinPassportDecoder,
} from "../../typechain-types";
import { initialVoiceCreditBalance, STATE_TREE_DEPTH } from "../constants";
import { deployTestContracts } from "../utils";

describe("GitcoinPassport Gatekeeper", () => {
  let gitcoinGatekeeper: GitcoinPassportGatekeeper;
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
    [gitcoinGatekeeper, gitcoinChecker] = await deployGitcoinPassportGatekeeper(
      { decoderAddress, minimumScore: passingScore },
      signer,
      true,
    );

    const r = await deployTestContracts({
      initialVoiceCreditBalance,
      stateTreeDepth: STATE_TREE_DEPTH,
      signer,
      gatekeeper: gitcoinGatekeeper,
    });
    maciContract = r.maciContract;
  });

  describe("Deployment", () => {
    it("The gatekeeper should be deployed correctly", async () => {
      expect(gitcoinGatekeeper).to.not.eq(undefined);
      expect(await gitcoinGatekeeper.getAddress()).to.not.eq(ZeroAddress);
    });
  });

  describe("GitcoinGakeeper", () => {
    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await gitcoinGatekeeper.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await gitcoinGatekeeper.guarded()).to.eq(maciAddress);
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      const [, secondSigner] = await getSigners();
      await expect(gitcoinGatekeeper.connect(secondSigner).setTarget(signerAddress)).to.be.revertedWithCustomError(
        gitcoinGatekeeper,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should fail to set guarded target when the MACI instance is not valid", async () => {
      await expect(gitcoinGatekeeper.setTarget(ZeroAddress)).to.be.revertedWithCustomError(
        gitcoinGatekeeper,
        "ZeroAddress",
      );
    });

    it("should throw when the score is not high enough", async () => {
      await expect(maciContract.signUp(user.pubKey.asContractParam(), "0x")).to.be.revertedWithCustomError(
        gitcoinChecker,
        "ScoreTooLow",
      );
    });

    it("should allow to signup when the score is high enough", async () => {
      await mockDecoder.changeScore(passingScore * 100).then((tx) => tx.wait());
      await maciContract.signUp(user.pubKey.asContractParam(), "0x").then((tx) => tx.wait());

      expect(await gitcoinGatekeeper.registeredUsers(signerAddress)).to.eq(true);
    });

    it("should prevent signing up twice", async () => {
      await expect(maciContract.signUp(user.pubKey.asContractParam(), "0x")).to.be.revertedWithCustomError(
        gitcoinGatekeeper,
        "AlreadyRegistered",
      );
    });

    it("should signup via MACI", async () => {
      const [, secondSigner] = await getSigners();

      const tx = await maciContract
        .connect(secondSigner)
        .signUp(secondUser.pubKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1]));

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });
  });
});
