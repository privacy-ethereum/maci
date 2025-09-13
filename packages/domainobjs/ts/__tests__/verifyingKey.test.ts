import { type G1Point } from "@maci-protocol/crypto";
import { expect } from "chai";

import fs from "fs";
import path from "path";

import { type IVerifyingKeyObjectParams, VerifyingKey } from "..";

describe("verifyingKey", () => {
  describe("fromJSON", () => {
    it("should convert a JSON file from snarkjs to a VerifyingKey", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const d = JSON.parse(j) as IVerifyingKeyObjectParams;
      const verifyingKey = VerifyingKey.fromJSON(j);

      expect(d.vk_alpha_1[0]).to.eq(verifyingKey.alpha1.x.toString());
      expect(d.vk_alpha_1[1]).to.eq(verifyingKey.alpha1.y.toString());

      expect(d.vk_beta_2[0][0]).to.eq(verifyingKey.beta2.x[1].toString());
      expect(d.vk_beta_2[0][1]).to.eq(verifyingKey.beta2.x[0].toString());
      expect(d.vk_beta_2[1][0]).to.eq(verifyingKey.beta2.y[1].toString());
      expect(d.vk_beta_2[1][1]).to.eq(verifyingKey.beta2.y[0].toString());

      expect(d.vk_gamma_2[0][0]).to.eq(verifyingKey.gamma2.x[1].toString());
      expect(d.vk_gamma_2[0][1]).to.eq(verifyingKey.gamma2.x[0].toString());
      expect(d.vk_gamma_2[1][0]).to.eq(verifyingKey.gamma2.y[1].toString());
      expect(d.vk_gamma_2[1][1]).to.eq(verifyingKey.gamma2.y[0].toString());

      expect(d.vk_delta_2[0][0]).to.eq(verifyingKey.delta2.x[1].toString());
      expect(d.vk_delta_2[0][1]).to.eq(verifyingKey.delta2.x[0].toString());
      expect(d.vk_delta_2[1][0]).to.eq(verifyingKey.delta2.y[1].toString());
      expect(d.vk_delta_2[1][1]).to.eq(verifyingKey.delta2.y[0].toString());

      expect(d.IC.length).to.eq(verifyingKey.ic.length);
      for (let i = 0; i < d.IC.length; i += 1) {
        expect(d.IC[i][0]).to.eq(verifyingKey.ic[i].x.toString());
        expect(d.IC[i][1]).to.eq(verifyingKey.ic[i].y.toString());
      }
    });
  });

  describe("copy", () => {
    it("Copy should generate a deep copy", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const verifyingKey = VerifyingKey.fromJSON(j);

      const verifyingKeyCopy = verifyingKey.copy();
      expect(verifyingKey.equals(verifyingKeyCopy)).to.eq(true);
    });
  });

  describe("equals", () => {
    it("should return true for equal verifying keys", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const verifyingKey = VerifyingKey.fromJSON(j);
      const verifyingKeyCopy = verifyingKey.copy();

      expect(verifyingKey.equals(verifyingKeyCopy)).to.eq(true);
    });

    it("should return false for unequal verifying keys", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const verifyingKey = VerifyingKey.fromJSON(j);
      const verifyingKeyCopy = verifyingKey.copy();
      verifyingKeyCopy.alpha1.x = BigInt(123);

      expect(verifyingKey.equals(verifyingKeyCopy)).to.eq(false);
    });

    it("should return false for unequal verifying keys (different ic)", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const verifyingKey = VerifyingKey.fromJSON(j);
      const verifyingKeyCopy = verifyingKey.copy();
      verifyingKeyCopy.ic[15] = {} as unknown as G1Point;

      expect(verifyingKey.equals(verifyingKeyCopy)).to.eq(false);
    });
  });

  describe("fromObj", () => {
    it("should convert an object to a VerifyingKey", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const d = JSON.parse(j) as IVerifyingKeyObjectParams;
      const verifyingKey = VerifyingKey.fromObj(d);

      expect(d.vk_alpha_1[0]).to.eq(verifyingKey.alpha1.x.toString());
      expect(d.vk_alpha_1[1]).to.eq(verifyingKey.alpha1.y.toString());

      expect(d.vk_beta_2[0][0]).to.eq(verifyingKey.beta2.x[1].toString());
      expect(d.vk_beta_2[0][1]).to.eq(verifyingKey.beta2.x[0].toString());
      expect(d.vk_beta_2[1][0]).to.eq(verifyingKey.beta2.y[1].toString());
      expect(d.vk_beta_2[1][1]).to.eq(verifyingKey.beta2.y[0].toString());

      expect(d.vk_gamma_2[0][0]).to.eq(verifyingKey.gamma2.x[1].toString());
      expect(d.vk_gamma_2[0][1]).to.eq(verifyingKey.gamma2.x[0].toString());
      expect(d.vk_gamma_2[1][0]).to.eq(verifyingKey.gamma2.y[1].toString());
      expect(d.vk_gamma_2[1][1]).to.eq(verifyingKey.gamma2.y[0].toString());

      expect(d.vk_delta_2[0][0]).to.eq(verifyingKey.delta2.x[1].toString());
      expect(d.vk_delta_2[0][1]).to.eq(verifyingKey.delta2.x[0].toString());
      expect(d.vk_delta_2[1][0]).to.eq(verifyingKey.delta2.y[1].toString());
      expect(d.vk_delta_2[1][1]).to.eq(verifyingKey.delta2.y[0].toString());

      expect(d.IC.length).to.eq(verifyingKey.ic.length);
      for (let i = 0; i < d.IC.length; i += 1) {
        expect(d.IC[i][0]).to.eq(verifyingKey.ic[i].x.toString());
        expect(d.IC[i][1]).to.eq(verifyingKey.ic[i].y.toString());
      }
    });
  });

  describe("asContractParam", () => {
    it("should produce an object with the correct properties", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const verifyingKey = VerifyingKey.fromJSON(j);
      const obj = verifyingKey.asContractParam();

      expect(Object.keys(obj)).to.deep.eq(["alpha1", "beta2", "gamma2", "delta2", "ic"]);
    });
  });

  describe("fromContract", () => {
    it("should produce a VerifyingKey from a contract object", () => {
      const file = path.join(__dirname, "./artifacts/test_vk.json");
      const j = fs.readFileSync(file).toString();
      const verifyingKey = VerifyingKey.fromJSON(j);
      const obj = verifyingKey.asContractParam();
      const verifyingKeyCopy = VerifyingKey.fromContract(obj);

      expect(verifyingKey.equals(verifyingKeyCopy)).to.eq(true);
    });
  });
});
