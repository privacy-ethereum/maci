import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type Signer, ZeroAddress } from "ethers";

import { getSigners } from "../../ts";
import { deployERC20Policy, deployMockERC20Votes } from "../../ts/deploy";
import { type ERC20Policy, type MockERC20, type ERC20Checker, type MACI } from "../../typechain-types";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("ERC20", () => {
  let policy: ERC20Policy;
  let checker: ERC20Checker;
  let mockERC20: MockERC20;
  let deployer: Signer;
  let subject: Signer;
  let notSubject: Signer;

  let maciContract: MACI;

  const threshold = 5n;

  const [key1, key2] = [new Keypair(), new Keypair()];

  before(async () => {
    [deployer, subject, notSubject] = await getSigners();

    mockERC20 = await deployMockERC20Votes(deployer, true);

    await mockERC20.transfer(await subject.getAddress(), threshold + 1n);
    await mockERC20.transfer(await notSubject.getAddress(), threshold - 1n);

    [policy, checker] = await deployERC20Policy(
      {
        threshold,
        token: await mockERC20.getAddress(),
      },
      {},
      deployer,
      true,
    );

    const r = await deployTestContracts({
      initialVoiceCreditBalance,
      stateTreeDepth: STATE_TREE_DEPTH,
      signer: deployer,
      policy,
    });

    maciContract = r.maciContract;
  });

  describe("Deployment", () => {
    it("should be deployed correctly", () => {
      expect(policy).to.not.eq(undefined);
    });
  });

  describe("Policy", () => {
    it("should set guarded target correctly", async () => {
      await policy.setTarget(await maciContract.getAddress()).then((tx) => tx.wait());

      expect(await policy.guarded()).to.eq(await maciContract.getAddress());
    });

    it("should return trait properly", async () => {
      expect(await policy.trait()).to.eq("ERC20");
    });

    it("should fail to set guarded target when the caller is not the owner", async () => {
      await expect(policy.connect(notSubject).setTarget(await maciContract.getAddress())).to.be.revertedWithCustomError(
        policy,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should fail to set guarded target when the target is not valid", async () => {
      await expect(policy.setTarget(ZeroAddress)).to.be.revertedWithCustomError(policy, "ZeroAddress");
    });
  });

  describe("Signup", () => {
    it("should allow a user to signup", async () => {
      const tx = await maciContract
        .connect(subject)
        .signUp(key1.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode([], []));

      const receipt = await tx.wait();

      expect(receipt?.status).to.eq(1);
    });

    it("should prevent a user from signing up twice", async () => {
      await expect(
        maciContract
          .connect(subject)
          .signUp(key1.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode([], [])),
      ).to.be.revertedWithCustomError(policy, "AlreadyEnforced");
    });

    it("should not allow a user to signup when the balance is too low", async () => {
      await expect(
        maciContract
          .connect(notSubject)
          .signUp(key2.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode([], [])),
      ).to.be.revertedWithCustomError(checker, "BalanceTooLow");
    });
  });
});
