import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type Signer, ZeroAddress } from "ethers";

import type { MACI, AnonAadhaarPolicy, MockAnonAadhaar, AnonAadhaarChecker } from "../../typechain-types";

import { deployAnonAadhaarPolicy, deployContract } from "../../ts/deploy";
import { getDefaultSigner, getSigners } from "../../ts/utils";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("AnonAadhaar", () => {
  let anonAadhaarPolicy: AnonAadhaarPolicy;
  let anonAadhaarChecker: AnonAadhaarChecker;
  let mockAnonAadhaar: MockAnonAadhaar;
  let signer: Signer;
  let signerAddressUint256: bigint;
  let signerAddress: string;
  let encodedProof: string;

  const user = new Keypair();

  // Define the constant nullifierSeed
  const nullifierSeed = 1234;

  // Mock AnonAadhaar proof
  const mockProof = {
    timestamp: Math.floor(new Date().getTime() / 1000) - 2 * 60 * 60,
    nullifierSeed: nullifierSeed.toString(),
    nullifier: "7946664694698614794431553425553810756961743235367295886353548733878558886762",
    ageAbove18: "1",
    gender: "77",
    pincode: "110051",
    state: "452723500356",
    packedGroth16Proof: ["0", "1", "2", "3", "4", "5", "6", "7"],
  };

  before(async () => {
    signer = await getDefaultSigner();
    mockAnonAadhaar = await deployContract("MockAnonAadhaar", signer, true);
    const mockAnonAadhaarAddress = await mockAnonAadhaar.getAddress();
    signerAddress = await signer.getAddress();
    [anonAadhaarPolicy, anonAadhaarChecker] = await deployAnonAadhaarPolicy(
      {
        verifierAddress: mockAnonAadhaarAddress,
        nullifierSeed: nullifierSeed.toString(),
      },
      {},
      signer,
      true,
    );

    signerAddressUint256 = BigInt(signerAddress);
    encodedProof = AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "uint256", "uint256", "uint256[4]", "uint256[8]"],
      [
        mockProof.nullifierSeed,
        mockProof.nullifier,
        mockProof.timestamp,
        signerAddressUint256,
        [mockProof.ageAbove18, mockProof.gender, mockProof.pincode, mockProof.state],
        mockProof.packedGroth16Proof,
      ],
    );
  });

  describe("Deployment", () => {
    it("The policy should be deployed correctly", () => {
      expect(anonAadhaarPolicy).to.not.eq(undefined);
    });
  });

  describe("Policy", () => {
    let maciContract: MACI;

    before(async () => {
      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
        policy: anonAadhaarPolicy,
      });

      maciContract = r.maciContract;
    });

    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await anonAadhaarPolicy.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await anonAadhaarPolicy.guarded()).to.eq(maciAddress);
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      const [, secondSigner] = await getSigners();
      await expect(anonAadhaarPolicy.connect(secondSigner).setTarget(signerAddress)).to.be.revertedWithCustomError(
        anonAadhaarPolicy,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should fail to set guarded target when the MACI instance is not valid", async () => {
      await expect(anonAadhaarPolicy.setTarget(ZeroAddress)).to.be.revertedWithCustomError(
        anonAadhaarPolicy,
        "ZeroAddress",
      );
    });

    it("should revert if the nullifier seed is invalid", async () => {
      const invalidNullifierSeedProof = {
        ...mockProof,
        nullifierSeed: "5678",
      };

      const encodedInvalidNullifierSeedProof = AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "uint256", "uint256", "uint256[4]", "uint256[8]"],
        [
          invalidNullifierSeedProof.nullifierSeed,
          invalidNullifierSeedProof.nullifier,
          invalidNullifierSeedProof.timestamp,
          signerAddressUint256,
          [
            invalidNullifierSeedProof.ageAbove18,
            invalidNullifierSeedProof.gender,
            invalidNullifierSeedProof.pincode,
            invalidNullifierSeedProof.state,
          ],
          invalidNullifierSeedProof.packedGroth16Proof,
        ],
      );

      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), encodedInvalidNullifierSeedProof),
      ).to.be.revertedWithCustomError(anonAadhaarChecker, "InvalidNullifierSeed");
    });

    it("should revert if the signal is invalid", async () => {
      const encodedInvalidProof = AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "uint256", "uint256", "uint256[4]", "uint256[8]"],
        [
          mockProof.nullifierSeed,
          mockProof.nullifier,
          mockProof.timestamp,
          BigInt(ZeroAddress),
          [mockProof.ageAbove18, mockProof.gender, mockProof.pincode, mockProof.state],
          mockProof.packedGroth16Proof,
        ],
      );
      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), encodedInvalidProof),
      ).to.be.revertedWithCustomError(anonAadhaarChecker, "InvalidSignal");
    });

    it("should revert if the proof is invalid (mock)", async () => {
      await mockAnonAadhaar.flipValid();
      await expect(maciContract.signUp(user.publicKey.asContractParam(), encodedProof)).to.be.revertedWithCustomError(
        anonAadhaarChecker,
        "InvalidProof",
      );
      await mockAnonAadhaar.flipValid();
    });

    it("should register a user if the register function is called with the valid data", async () => {
      const tx = await maciContract.signUp(user.publicKey.asContractParam(), encodedProof);

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });

    it("should prevent signing up twice", async () => {
      await expect(maciContract.signUp(user.publicKey.asContractParam(), encodedProof)).to.be.revertedWithCustomError(
        anonAadhaarPolicy,
        "AlreadyEnforced",
      );
    });
  });
});
