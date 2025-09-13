import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type Signer, ZeroAddress } from "ethers";

import type { MACI, MockSemaphore, SemaphorePolicy, SemaphoreChecker } from "../../typechain-types";

import { deploySemaphoreSignupPolicy, deployContract } from "../../ts/deploy";
import { getDefaultSigner, getSigners } from "../../ts/utils";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("Semaphore", () => {
  let semaphorePolicy: SemaphorePolicy;
  let semaphoreChecker: SemaphoreChecker;
  let mockSemaphore: MockSemaphore;
  let signer: Signer;
  let signerAddress: string;

  const user = new Keypair();

  const validGroupId = 0n;
  const invalidGroupId = 1n;

  const proof = {
    merkleTreeDepth: 1n,
    merkleTreeRoot: 0n,
    nullifier: 0n,
    message: 0n,
    scope: validGroupId,
    points: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
  };

  const invalidProof = {
    merkleTreeDepth: 1n,
    merkleTreeRoot: 0n,
    nullifier: 0n,
    message: 0n,
    scope: invalidGroupId,
    points: [1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
  };

  const encodedProofInvalidGroupId = AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256[8]"],
    [proof.merkleTreeDepth, proof.merkleTreeRoot, proof.nullifier, proof.message, invalidGroupId, proof.points],
  );

  before(async () => {
    signer = await getDefaultSigner();
    mockSemaphore = await deployContract("MockSemaphore", signer, true, validGroupId);
    const mockSemaphoreAddress = await mockSemaphore.getAddress();
    signerAddress = await signer.getAddress();

    // eslint-disable-next-line no-bitwise
    proof.scope = (BigInt(signerAddress) << 96n) | validGroupId;

    [semaphorePolicy, semaphoreChecker] = await deploySemaphoreSignupPolicy(
      { semaphore: mockSemaphoreAddress, groupId: validGroupId },
      {},
      signer,
      true,
    );
  });

  describe("Deployment", () => {
    it("The policy should be deployed correctly", () => {
      expect(semaphorePolicy).to.not.eq(undefined);
    });
  });

  describe("Policy", () => {
    let maciContract: MACI;

    before(async () => {
      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
        policy: semaphorePolicy,
      });

      maciContract = r.maciContract;
    });

    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await semaphorePolicy.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await semaphorePolicy.guarded()).to.eq(maciAddress);
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      const [, secondSigner] = await getSigners();
      await expect(semaphorePolicy.connect(secondSigner).setTarget(signerAddress)).to.be.revertedWithCustomError(
        semaphorePolicy,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should fail to set guarded target when the MACI instance is not valid", async () => {
      await expect(semaphorePolicy.setTarget(ZeroAddress)).to.be.revertedWithCustomError(
        semaphorePolicy,
        "ZeroAddress",
      );
    });

    it("should not register a user if the register function is called with invalid groupId", async () => {
      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), encodedProofInvalidGroupId),
      ).to.be.revertedWithCustomError(semaphoreChecker, "InvalidGroup");
    });

    it("should revert if the proof is invalid (mock)", async () => {
      const encodedInvalidProof = AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256[8]"],
        [
          invalidProof.merkleTreeDepth,
          invalidProof.merkleTreeRoot,
          invalidProof.nullifier,
          invalidProof.message,
          proof.scope,
          invalidProof.points,
        ],
      );

      await mockSemaphore.flipValid();
      await expect(
        maciContract.signUp(user.publicKey.asContractParam(), encodedInvalidProof),
      ).to.be.revertedWithCustomError(semaphoreChecker, "InvalidProof");
      await mockSemaphore.flipValid();
    });

    it("should register a user if the register function is called with the valid data", async () => {
      const encodedProof = AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256[8]"],
        [proof.merkleTreeDepth, proof.merkleTreeRoot, proof.nullifier, proof.message, proof.scope, proof.points],
      );

      const tx = await maciContract.signUp(user.publicKey.asContractParam(), encodedProof);

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });

    it("should prevent signing up twice", async () => {
      const encodedProof = AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256[8]"],
        [proof.merkleTreeDepth, proof.merkleTreeRoot, proof.nullifier, proof.message, proof.scope, proof.points],
      );

      await expect(maciContract.signUp(user.publicKey.asContractParam(), encodedProof)).to.be.revertedWithCustomError(
        semaphorePolicy,
        "AlreadyEnforced",
      );
    });
  });
});
