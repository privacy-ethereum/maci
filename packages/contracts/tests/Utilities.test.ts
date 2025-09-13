import { StateLeaf, Keypair, Message, PublicKey } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type BigNumberish, ZeroAddress } from "ethers";

import { linkPoseidonLibraries } from "../tasks/helpers/abi";
import { deployPoseidonContracts, createContractFactory } from "../ts/deploy";
import { getDefaultSigner } from "../ts/utils";
import { type Utilities, Utilities__factory as UtilitiesFactory } from "../typechain-types";

describe("Utilities", () => {
  let utilitiesContract: Utilities;

  describe("Deployment", () => {
    before(async () => {
      const { PoseidonT3Contract, PoseidonT4Contract, PoseidonT5Contract, PoseidonT6Contract } =
        await deployPoseidonContracts(await getDefaultSigner(), {}, true);

      const [
        poseidonT3ContractAddress,
        poseidonT4ContractAddress,
        poseidonT5ContractAddress,
        poseidonT6ContractAddress,
      ] = await Promise.all([
        PoseidonT3Contract.getAddress(),
        PoseidonT4Contract.getAddress(),
        PoseidonT5Contract.getAddress(),
        PoseidonT6Contract.getAddress(),
      ]);

      // Link Poseidon contracts
      const utilitiesContractFactory = await createContractFactory(
        UtilitiesFactory.abi,
        UtilitiesFactory.linkBytecode(
          linkPoseidonLibraries(
            poseidonT3ContractAddress,
            poseidonT4ContractAddress,
            poseidonT5ContractAddress,
            poseidonT6ContractAddress,
          ),
        ),
        await getDefaultSigner(),
      );

      utilitiesContract = (await utilitiesContractFactory.deploy()) as Utilities;
      await utilitiesContract.deploymentTransaction()?.wait();
    });

    it("should have been deployed", async () => {
      expect(utilitiesContract).to.not.eq(undefined);
      expect(await utilitiesContract.getAddress()).to.not.eq(ZeroAddress);
    });
  });

  describe("hashStateLeaf", () => {
    it("should correctly hash a StateLeaf", async () => {
      const keypair = new Keypair();
      const voiceCreditBalance = BigInt(1234);
      const stateLeaf = new StateLeaf(keypair.publicKey, voiceCreditBalance);
      const onChainHash = await utilitiesContract.hashStateLeaf(stateLeaf.asContractParam());
      const expectedHash = stateLeaf.hash();

      expect(onChainHash.toString()).to.eq(expectedHash.toString());
    });
  });

  describe("padAndHashMessage", () => {
    it("should correctly pad and hash a message", async () => {
      const dataToPad: [BigNumberish, BigNumberish] = [1234, 1234];

      // Call the padAndHashMessage function
      const { message, padKey } = await utilitiesContract.padAndHashMessage(dataToPad);

      // Validate the returned message
      expect(message.data.slice(0, 2)).to.deep.eq(dataToPad);
      for (let i = 2; i < 10; i += 1) {
        expect(message.data[i]).to.eq(0);
      }

      // Validate the returned padKey
      expect(padKey.x.toString()).to.eq(
        "10457101036533406547632367118273992217979173478358440826365724437999023779287",
      );
      expect(padKey.y.toString()).to.eq(
        "19824078218392094440610104313265183977899662750282163392862422243483260492317",
      );
    });

    it("should produce the same hash locally", async () => {
      const message = new Message([0n, 0n, 1234n, 1234n, 0n, 0n, 0n, 0n, 0n, 0n]);
      const padKey = new PublicKey([
        10457101036533406547632367118273992217979173478358440826365724437999023779287n,
        19824078218392094440610104313265183977899662750282163392862422243483260492317n,
      ]);

      const expectedHash = message.hash(padKey);

      const onChainHash = await utilitiesContract.hashMessageAndPublicKey(
        message.asContractParam(),
        padKey.asContractParam(),
      );

      expect(onChainHash.toString()).to.eq(expectedHash.toString());
    });
  });
});
