import { EMode } from "@maci-protocol/core";
import { expect } from "chai";
import { type Signer } from "ethers";

import {
  type IVerifyingKeyStruct,
  type VerifyingKeysRegistry,
  deployVerifyingKeysRegistry,
  getDefaultSigner,
} from "../ts";

import {
  messageBatchSize,
  testPollJoinedVerifyingKey,
  testPollJoiningVerifyingKey,
  testProcessVerifyingKey,
  testProcessVerifyingKeyNonQv,
  testTallyVerifyingKey,
  testTallyVerifyingKeyNonQv,
  treeDepths,
} from "./constants";
import { compareVerifyingKeys } from "./utils";

describe("VerifyingKeysRegistry", () => {
  let signer: Signer;
  let verifyingKeysRegistryContract: VerifyingKeysRegistry;

  const stateTreeDepth = 10;
  const pollStateTreeDepth = 10;

  describe("deployment", () => {
    before(async () => {
      signer = await getDefaultSigner();
      verifyingKeysRegistryContract = await deployVerifyingKeysRegistry(signer, true);
    });

    it("should have set the correct owner", async () => {
      expect(await verifyingKeysRegistryContract.owner()).to.eq(await signer.getAddress());
    });
  });

  describe("setPollJoiningVerifyingKey", () => {
    it("should set the poll verifying key", async () => {
      const tx = await verifyingKeysRegistryContract.setPollJoiningVerifyingKey(
        stateTreeDepth + 1,
        testPollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        { gasLimit: 1000000 },
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });

    it("should throw when trying to set another verifying key for the same params", async () => {
      await expect(
        verifyingKeysRegistryContract.setPollJoiningVerifyingKey(
          stateTreeDepth + 1,
          testPollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct,
          { gasLimit: 1000000 },
        ),
      ).to.be.revertedWithCustomError(verifyingKeysRegistryContract, "VerifyingKeyAlreadySet");
    });
  });

  describe("setPollJoinedVerifyingKey", () => {
    it("should set the poll verifying key", async () => {
      const tx = await verifyingKeysRegistryContract.setPollJoinedVerifyingKey(
        stateTreeDepth + 1,
        testPollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        { gasLimit: 1000000 },
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });

    it("should throw when trying to set another verifying key for the same params", async () => {
      await expect(
        verifyingKeysRegistryContract.setPollJoinedVerifyingKey(
          stateTreeDepth + 1,
          testPollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct,
          { gasLimit: 1000000 },
        ),
      ).to.be.revertedWithCustomError(verifyingKeysRegistryContract, "VerifyingKeyAlreadySet");
    });
  });

  describe("setVerifyingKeys", () => {
    it("should set the process, tally verifying keys", async () => {
      const tx = await verifyingKeysRegistryContract.setVerifyingKeys(
        stateTreeDepth,
        treeDepths.tallyProcessingStateTreeDepth,
        treeDepths.voteOptionTreeDepth,
        messageBatchSize,
        EMode.QV,
        testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct,
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });

    it("should throw when trying to set another verifying key for the same params", async () => {
      await expect(
        verifyingKeysRegistryContract.setVerifyingKeys(
          stateTreeDepth,
          treeDepths.tallyProcessingStateTreeDepth,
          treeDepths.voteOptionTreeDepth,
          messageBatchSize,
          EMode.QV,
          testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
          testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        ),
      ).to.be.revertedWithCustomError(verifyingKeysRegistryContract, "VerifyingKeyAlreadySet");
    });

    it("should allow to set verifying keys for different params", async () => {
      const tx = await verifyingKeysRegistryContract.setVerifyingKeys(
        stateTreeDepth + 1,
        treeDepths.tallyProcessingStateTreeDepth,
        treeDepths.voteOptionTreeDepth,
        messageBatchSize,
        EMode.QV,
        testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct,
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });

    it("should allow to set verifying keys for different modes", async () => {
      const tx = await verifyingKeysRegistryContract.setVerifyingKeys(
        stateTreeDepth + 1,
        treeDepths.tallyProcessingStateTreeDepth,
        treeDepths.voteOptionTreeDepth,
        messageBatchSize,
        EMode.NON_QV,
        testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct,
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });
  });

  describe("setVerifyingKeysBatch", () => {
    it("should set the process, tally, poll verifying keys", async () => {
      const tx = await verifyingKeysRegistryContract.setVerifyingKeysBatch({
        stateTreeDepth,
        pollStateTreeDepth,
        tallyProcessingStateTreeDepth: treeDepths.tallyProcessingStateTreeDepth,
        voteOptionTreeDepth: treeDepths.voteOptionTreeDepth,
        messageBatchSize,
        modes: [EMode.NON_QV],
        pollJoiningVerifyingKey: testPollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        pollJoinedVerifyingKey: testPollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct,
        processVerifyingKeys: [testProcessVerifyingKeyNonQv.asContractParam() as IVerifyingKeyStruct],
        tallyVerifyingKeys: [testTallyVerifyingKeyNonQv.asContractParam() as IVerifyingKeyStruct],
      });

      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });

    it("should throw when zkeys doesn't have the same length", async () => {
      await expect(
        verifyingKeysRegistryContract.setVerifyingKeysBatch({
          stateTreeDepth,
          pollStateTreeDepth,
          tallyProcessingStateTreeDepth: treeDepths.tallyProcessingStateTreeDepth,
          voteOptionTreeDepth: treeDepths.voteOptionTreeDepth,
          messageBatchSize,
          modes: [EMode.QV],
          pollJoiningVerifyingKey: testPollJoiningVerifyingKey.asContractParam() as IVerifyingKeyStruct,
          pollJoinedVerifyingKey: testPollJoinedVerifyingKey.asContractParam() as IVerifyingKeyStruct,
          processVerifyingKeys: [
            testProcessVerifyingKey.asContractParam() as IVerifyingKeyStruct,
            testProcessVerifyingKeyNonQv.asContractParam() as IVerifyingKeyStruct,
          ],
          tallyVerifyingKeys: [testTallyVerifyingKey.asContractParam() as IVerifyingKeyStruct],
        }),
      ).to.be.revertedWithCustomError(verifyingKeysRegistryContract, "InvalidKeysParams");
    });
  });

  describe("hasVerifyingKeys", () => {
    describe("hasProcessVerifyingKey", () => {
      it("should return true for the process verifying key", async () => {
        expect(
          await verifyingKeysRegistryContract.hasProcessVerifyingKey(
            stateTreeDepth,
            treeDepths.voteOptionTreeDepth,
            messageBatchSize,
            EMode.QV,
          ),
        ).to.eq(true);
      });

      it("should return false for a non-existing verifying key", async () => {
        expect(
          await verifyingKeysRegistryContract.hasProcessVerifyingKey(
            stateTreeDepth + 2,
            treeDepths.voteOptionTreeDepth,
            messageBatchSize,
            EMode.QV,
          ),
        ).to.eq(false);
      });
    });

    describe("hasTallyVerifyingKey", () => {
      it("should return true for the tally verifying key", async () => {
        expect(
          await verifyingKeysRegistryContract.hasTallyVerifyingKey(
            stateTreeDepth,
            treeDepths.tallyProcessingStateTreeDepth,
            treeDepths.voteOptionTreeDepth,
            EMode.QV,
          ),
        ).to.eq(true);
      });

      it("should return false for a non-existing verifying key", async () => {
        expect(
          await verifyingKeysRegistryContract.hasTallyVerifyingKey(
            stateTreeDepth + 2,
            treeDepths.tallyProcessingStateTreeDepth,
            treeDepths.voteOptionTreeDepth,
            EMode.QV,
          ),
        ).to.eq(false);
      });
    });
  });

  describe("generateSignatures", () => {
    describe("generatePollJoiningVerifyingKeySignature", () => {
      it("should generate a valid signature", async () => {
        const signature =
          await verifyingKeysRegistryContract.generatePollJoiningVerifyingKeySignature(pollStateTreeDepth);
        const verifyingKey = await verifyingKeysRegistryContract.getPollJoiningVerifyingKeyBySignature(signature);
        compareVerifyingKeys(testPollJoiningVerifyingKey, verifyingKey);
      });
    });

    describe("generatePollJoinedVerifyingKeySignature", () => {
      it("should generate a valid signature", async () => {
        const signature =
          await verifyingKeysRegistryContract.generatePollJoinedVerifyingKeySignature(pollStateTreeDepth);
        const verifyingKey = await verifyingKeysRegistryContract.getPollJoinedVerifyingKeyBySignature(signature);
        compareVerifyingKeys(testPollJoinedVerifyingKey, verifyingKey);
      });
    });

    describe("generateProcessVerifyingKeySignature", () => {
      it("should generate a valid signature", async () => {
        const signature = await verifyingKeysRegistryContract.generateProcessVerifyingKeySignature(
          stateTreeDepth,
          treeDepths.voteOptionTreeDepth,
          messageBatchSize,
        );
        const verifyingKey = await verifyingKeysRegistryContract.getProcessVerifyingKeyBySignature(signature, EMode.QV);
        compareVerifyingKeys(testProcessVerifyingKey, verifyingKey);
      });
    });

    describe("generateTallyVerifyingKeySignature", () => {
      it("should generate a valid signature", async () => {
        const signature = await verifyingKeysRegistryContract.generateTallyVerifyingKeySignature(
          stateTreeDepth,
          treeDepths.tallyProcessingStateTreeDepth,
          treeDepths.voteOptionTreeDepth,
        );
        const verifyingKey = await verifyingKeysRegistryContract.getTallyVerifyingKeyBySignature(signature, EMode.QV);
        compareVerifyingKeys(testTallyVerifyingKey, verifyingKey);
      });
    });
  });
});
