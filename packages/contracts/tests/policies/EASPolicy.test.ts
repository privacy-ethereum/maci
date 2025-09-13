import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type Signer, ZeroAddress, toBeArray } from "ethers";

import type { MACI, EASChecker, EASPolicy } from "../../typechain-types";

import { deployContract, deployEASSignUpPolicy } from "../../ts/deploy";
import { getDefaultSigner, getSigners } from "../../ts/utils";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("EAS", () => {
  let easPolicy: EASPolicy;
  let easChecker: EASChecker;
  let signer: Signer;
  let signerAddress: string;
  let easAddress: string;

  const schema = "0xfdcfdad2dbe7489e0ce56b260348b7f14e8365a8a325aef9834818c00d46b31b";

  const revokedAttestation = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const invalidSchemaAttestation = "0x0000000000000000000000000000000000000000000000000000000000000002";
  const invalidRecipientAttestation = "0x0000000000000000000000000000000000000000000000000000000000000003";
  const invalidAttesterAttestation = "0x0000000000000000000000000000000000000000000000000000000000000004";
  // valid attestation
  const attestation = "0x0000000000000000000000000000000000000000000000000000000000000000";

  const user = new Keypair();

  before(async () => {
    signer = await getDefaultSigner();
    signerAddress = await signer.getAddress();
    const mockEAS = await deployContract("MockEAS", signer, true, signerAddress, toBeArray(schema), signerAddress);
    easAddress = await mockEAS.getAddress();
    [easPolicy, easChecker] = await deployEASSignUpPolicy(
      { eas: easAddress, attester: signerAddress, schema: toBeArray(schema) },
      {},
      signer,
      true,
    );
  });

  describe("Deployment", () => {
    it("The policy should be deployed correctly", async () => {
      expect(easPolicy).to.not.eq(undefined);
      expect(await easPolicy.getAddress()).to.not.eq(ZeroAddress);
    });
  });

  describe("EASPolicy", () => {
    let maciContract: MACI;

    before(async () => {
      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
        policy: easPolicy,
      });

      maciContract = r.maciContract;
    });

    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await easPolicy.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await easPolicy.guarded()).to.eq(maciAddress);
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      const [, secondSigner] = await getSigners();
      await expect(easPolicy.connect(secondSigner).setTarget(signerAddress)).to.be.revertedWithCustomError(
        easPolicy,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should fail to set guarded target when the MACI instance is not valid", async () => {
      await expect(easPolicy.setTarget(ZeroAddress)).to.be.revertedWithCustomError(easPolicy, "ZeroAddress");
    });

    it("should throw when the attestation is not owned by the caller (mocking maci.signUp call)", async () => {
      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), invalidRecipientAttestation),
      ).to.be.revertedWithCustomError(easChecker, "NotYourAttestation");
    });

    it("should throw when the attestation has been revoked", async () => {
      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), revokedAttestation),
      ).to.be.revertedWithCustomError(easChecker, "AttestationRevoked");
    });

    it("should throw when the attestation schema is not the one expected by the policy", async () => {
      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), invalidSchemaAttestation),
      ).to.be.revertedWithCustomError(easChecker, "InvalidSchema");
    });

    it("should throw when the attestation is not signed by the attestation owner", async () => {
      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), invalidAttesterAttestation),
      ).to.be.revertedWithCustomError(easChecker, "AttesterNotTrusted");
    });

    it("should register a user if the register function is called with the valid data", async () => {
      // signup via MACI
      const tx = await maciContract.signUp(user.publicKey.asContractParam(), attestation);

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });

    it("should prevent signing up twice", async () => {
      await expect(maciContract.signUp(user.publicKey.asContractParam(), attestation)).to.be.revertedWithCustomError(
        easPolicy,
        "AlreadyEnforced",
      );
    });
  });
});
