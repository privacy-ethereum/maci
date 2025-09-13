import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type Signer, ZeroAddress } from "ethers";

import { getSigners } from "../../ts";
import { deployERC20VotesPolicy, deployMockERC20Votes } from "../../ts/deploy";
import { type ERC20VotesPolicy, type MockERC20Votes, type ERC20VotesChecker, type MACI } from "../../typechain-types";
import { STATE_TREE_DEPTH, initialVoiceCreditBalance } from "../constants";
import { deployTestContracts } from "../utils";

describe("ERC20Votes", () => {
  let policy: ERC20VotesPolicy;
  let checker: ERC20VotesChecker;
  let mockERC20Votes: MockERC20Votes;
  let deployer: Signer;
  let subject: Signer;
  let notSubject: Signer;

  let maciContract: MACI;

  const snapshotBlock = 1n;
  const threshold = 5n;

  const [key1, key2] = [new Keypair(), new Keypair()];

  before(async () => {
    [deployer, subject, notSubject] = await getSigners();

    mockERC20Votes = await deployMockERC20Votes(deployer, true);

    await mockERC20Votes.changeVotes(threshold + 1n);

    [policy, checker] = await deployERC20VotesPolicy(
      {
        snapshotBlock,
        threshold,
        token: await mockERC20Votes.getAddress(),
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
      expect(await policy.trait()).to.eq("ERC20Votes");
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
      await mockERC20Votes.changeVotes(threshold - 1n);
      await expect(
        maciContract
          .connect(notSubject)
          .signUp(key2.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode([], [])),
      ).to.be.revertedWithCustomError(checker, "BalanceTooLow");
    });
  });
});
