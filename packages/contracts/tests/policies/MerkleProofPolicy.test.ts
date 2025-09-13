import { Keypair } from "@maci-protocol/domainobjs";
import { type StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { AbiCoder, type Signer, ZeroAddress, encodeBytes32String } from "ethers";

import type { MACI, MerkleProofPolicy, MerkleProofChecker } from "../../typechain-types";

import { deployMerkleProofPolicy } from "../../ts/deploy";
import { getDefaultSigner, getSigners, generateMerkleTree } from "../../ts/utils";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("MerkleProof", () => {
  let merkleProofPolicy: MerkleProofPolicy;
  let merkleProofChecker: MerkleProofChecker;
  let signer: Signer;
  let signerAddress: string;
  let tree: StandardMerkleTree<string[]>;
  let validProof: string[];

  const allowedAddress = [
    ["0x2fbca3862a7d99486c61e0275b6f5660180fb1b3"],
    ["0x70564145fa8e8a15348ef0190e6b7c07a2120462"],
    ["0x27cfc88640089f340aeaec182baff0ddf15b1b37"],
    ["0xccde65cf4e39a2d28b50e3030fdab60c463fe215"],
    ["0x9bae2cfa33280a8332da9a3bd589f91935b12804"],
  ];

  const invalidRoot = encodeBytes32String("");
  const invalidProof = ["0x0000000000000000000000000000000000000000000000000000000000000000"];

  const user = new Keypair();

  before(async () => {
    signer = await getDefaultSigner();
    signerAddress = await signer.getAddress();
    allowedAddress.push([signerAddress]);
    tree = generateMerkleTree(allowedAddress);
    [merkleProofPolicy, merkleProofChecker] = await deployMerkleProofPolicy({ root: tree.root }, {}, signer, true);
  });

  describe("Deployment", () => {
    it("The policy should be deployed correctly", async () => {
      expect(merkleProofPolicy).to.not.eq(undefined);
      expect(await merkleProofPolicy.getAddress()).to.not.eq(ZeroAddress);
    });

    it("should fail to deploy when the root is not valid", async () => {
      await expect(deployMerkleProofPolicy({ root: invalidRoot }, {}, signer, true)).to.be.revertedWithCustomError(
        merkleProofChecker,
        "InvalidRoot",
      );
    });
  });

  describe("MerkleProofPolicy", () => {
    let maciContract: MACI;

    before(async () => {
      const r = await deployTestContracts({
        initialVoiceCreditBalance,
        stateTreeDepth: STATE_TREE_DEPTH,
        signer,
        policy: merkleProofPolicy,
      });

      maciContract = r.maciContract;
      validProof = tree.getProof([signerAddress]);
    });

    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await merkleProofPolicy.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await merkleProofPolicy.guarded()).to.eq(maciAddress);
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      const [, secondSigner] = await getSigners();
      await expect(merkleProofPolicy.connect(secondSigner).setTarget(signerAddress)).to.be.revertedWithCustomError(
        merkleProofPolicy,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should fail to set guarded target when the MACI instance is not valid", async () => {
      await expect(merkleProofPolicy.setTarget(ZeroAddress)).to.be.revertedWithCustomError(
        merkleProofPolicy,
        "ZeroAddress",
      );
    });

    it("should throw when the proof is invalid", async () => {
      await expect(
        maciContract.signUp(
          user.publicKey.asContractParam(),
          AbiCoder.defaultAbiCoder().encode(["bytes32[]"], [invalidProof]),
        ),
      ).to.be.revertedWithCustomError(merkleProofChecker, "InvalidProof");
    });

    it("should register a user if the register function is called with the valid data", async () => {
      // signup via MACI
      const tx = await maciContract.signUp(
        user.publicKey.asContractParam(),
        AbiCoder.defaultAbiCoder().encode(["bytes32[]"], [validProof]),
      );

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });

    it("should prevent signing up twice", async () => {
      await expect(
        maciContract.signUp(
          user.publicKey.asContractParam(),
          AbiCoder.defaultAbiCoder().encode(["bytes32[]"], [validProof]),
        ),
      ).to.be.revertedWithCustomError(merkleProofPolicy, "AlreadyEnforced");
    });
  });
});
