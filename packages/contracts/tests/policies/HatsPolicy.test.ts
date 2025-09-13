import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type Signer, ZeroAddress } from "ethers";

import type { MACI, HatsChecker, HatsPolicy, MockHatsProtocol } from "../../typechain-types";

import { deployContract, deployHatsSignupPolicy } from "../../ts/deploy";
import { getSigners } from "../../ts/utils";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("HatsProtocol", () => {
  let maciContract: MACI;

  let hatsPolicy: HatsPolicy;
  let hatsChecker: HatsChecker;

  let signer: Signer;
  let voter: Signer;
  let signerAddress: string;

  let mockHats: MockHatsProtocol;
  let mockHatsAddress: string;

  const user = new Keypair();

  const hatId = 1;
  const secondHatId = 2;
  const thirdHatId = 50;

  before(async () => {
    [signer, voter] = await getSigners();
    signerAddress = await signer.getAddress();

    // deploy Mock Hats Protocol contract
    mockHats = await deployContract("MockHatsProtocol", signer, true);
    mockHatsAddress = await mockHats.getAddress();

    // deploy policies
    [hatsPolicy, hatsChecker] = await deployHatsSignupPolicy(
      { hats: mockHatsAddress, criterionHats: [hatId, thirdHatId] },
      {},
      signer,
      true,
    );

    const r = await deployTestContracts({
      initialVoiceCreditBalance,
      stateTreeDepth: STATE_TREE_DEPTH,
      signer,
      policy: hatsPolicy,
    });

    maciContract = r.maciContract;
  });

  describe("Deployment", () => {
    it("should be deployed correctly", async () => {
      expect(hatsPolicy).to.not.eq(undefined);
      expect(await hatsChecker.criterionHats(hatId)).to.eq(true);
      expect(await hatsChecker.criterionHats(thirdHatId)).to.eq(true);
      expect(await hatsChecker.hats()).to.eq(mockHatsAddress);
    });
  });

  describe("setMaci", () => {
    it("should set guarded target correctly", async () => {
      const maciAddress = await maciContract.getAddress();
      await hatsPolicy.setTarget(maciAddress).then((tx) => tx.wait());

      expect(await hatsPolicy.guarded()).to.eq(maciAddress);
    });

    it("should fail to set guarded target to the zero address", async () => {
      await expect(hatsPolicy.setTarget(ZeroAddress)).to.be.revertedWithCustomError(hatsPolicy, "ZeroAddress");
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      await expect(hatsPolicy.connect(voter).setTarget(signerAddress)).to.be.revertedWithCustomError(
        hatsPolicy,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("register", () => {
    it("should not allow to call from a non-registered MACI contract", async () => {
      await expect(
        hatsPolicy.enforce(await signer.getAddress(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1])),
      ).to.be.revertedWithCustomError(hatsPolicy, "TargetOnly");
    });

    it("should fail to register a user if they pass a non-criterion hat", async () => {
      await expect(
        maciContract
          .connect(voter)
          .signUp(user.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [secondHatId])),
      ).to.be.revertedWithCustomError(hatsChecker, "NotCriterionHat");
    });

    it("should register a user if the register function is called with the valid data", async () => {
      // signup via MACI
      const tx = await maciContract
        .connect(voter)
        .signUp(user.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [hatId]));

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });

    it("should fail to register a user if they do not own a criterion hat", async () => {
      // get another signer
      const [, , another] = await getSigners();

      await expect(
        maciContract
          .connect(another)
          .signUp(user.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [thirdHatId])),
      ).to.be.revertedWithCustomError(hatsChecker, "NotWearingCriterionHat");
    });

    it("should prevent signing up twice", async () => {
      await expect(
        maciContract
          .connect(voter)
          .signUp(user.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [hatId])),
      ).to.be.revertedWithCustomError(hatsPolicy, "AlreadyEnforced");
    });
  });
});
