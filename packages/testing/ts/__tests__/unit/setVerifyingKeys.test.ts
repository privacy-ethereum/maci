import { deployVerifyingKeysRegistryContract, EMode, getDefaultSigner, setVerifyingKeys } from "@maci-protocol/sdk";
import { expect } from "chai";
import { type Signer } from "ethers";

import { verifyingKeysArgs } from "../../constants";

describe("setVerifyingKeys", function test() {
  this.timeout(900000);

  let signer: Signer;
  let verifyingKeysRegistryAddress: string;

  before(async () => {
    signer = await getDefaultSigner();
  });

  beforeEach(async () => {
    verifyingKeysRegistryAddress = await deployVerifyingKeysRegistryContract({ signer });
  });

  it("should set the verifying keys of mode QV on the contract", async () => {
    await setVerifyingKeys({ ...(await verifyingKeysArgs(signer)), verifyingKeysRegistryAddress });
  });

  it("should set the verifying keys of mode QV and NON_QV on the contract", async () => {
    await setVerifyingKeys({
      ...(await verifyingKeysArgs(signer, [EMode.QV, EMode.NON_QV])),
      verifyingKeysRegistryAddress,
    });
  });

  it("should set the verifying keys of mode QV, NON_QV and FULL on the contract", async () => {
    await setVerifyingKeys({
      ...(await verifyingKeysArgs(signer, [EMode.QV, EMode.NON_QV, EMode.FULL])),
      verifyingKeysRegistryAddress,
    });
  });

  it("should throw when setting verifying keys twice", async () => {
    await setVerifyingKeys({
      ...(await verifyingKeysArgs(signer)),
      verifyingKeysRegistryAddress,
    });

    expect(
      setVerifyingKeys({
        ...(await verifyingKeysArgs(signer, [EMode.NON_QV])),
        verifyingKeysRegistryAddress,
      }),
    ).rejectedWith("This poll joining verifying key is already set in the contract");
  });

  it("should throw when setting different number of modes and different number of process verifying keys", async () => {
    const args = await verifyingKeysArgs(signer, [EMode.QV, EMode.NON_QV]);
    args.processMessagesVerifyingKeys.splice(1, 1);

    await expect(setVerifyingKeys({ ...args, verifyingKeysRegistryAddress })).eventually.rejectedWith(
      "Number of process messages verifying keys must match number of modes",
    );
  });

  it("should throw when setting different number of modes and different number of tally verifying keys", async () => {
    const args = await verifyingKeysArgs(signer, [EMode.QV, EMode.NON_QV]);
    args.tallyVotesVerifyingKeys.splice(1, 1);

    await expect(setVerifyingKeys({ ...args, verifyingKeysRegistryAddress })).eventually.rejectedWith(
      "Number of tally votes verifying keys must match number of modes",
    );
  });
});
