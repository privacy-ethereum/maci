import { Keypair, VoteCommand } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type WitnessTester } from "circomkit";

import { circomkitInstance, getSignal } from "./utils/utils";

describe("IsOnCurve circuit", function test() {
  this.timeout(90000);

  let circuit: WitnessTester<["x", "y"], ["isValid"]>;

  before(async () => {
    circuit = await circomkitInstance.WitnessTester("IsOnCurve", {
      file: "./utils/IsOnCurve",
      template: "IsOnCurve",
    });
  });

  it("should return 1 for the identity point (0, 1)", async () => {
    const circuitInputs = {
      x: 0,
      y: 1,
    };

    const witness = await circuit.calculateWitness(circuitInputs);
    await circuit.expectConstraintPass(witness);
    const isValid = await getSignal(circuit, witness, "isValid");
    expect(isValid.toString()).to.eq("1");
  });

  it("should return 1 for a public key generated from a Keypair", async () => {
    const keypair = new Keypair();
    const circuitInputs = {
      x: keypair.publicKey.raw[0],
      y: keypair.publicKey.raw[1],
    };

    const witness = await circuit.calculateWitness(circuitInputs);
    await circuit.expectConstraintPass(witness);
    const isValid = await getSignal(circuit, witness, "isValid");
    expect(isValid.toString()).to.eq("1");
  });

  it("should return 1 for a signature point (R8) from a real signature", async () => {
    const keypair = new Keypair();
    const command = new VoteCommand(
      BigInt(0),
      keypair.publicKey,
      BigInt(0),
      BigInt(0),
      BigInt(1),
      BigInt(0),
      BigInt(0),
    );
    const signature = command.sign(keypair.privateKey);
    const circuitInputs = {
      x: BigInt(signature.R8[0]),
      y: BigInt(signature.R8[1]),
    };

    const witness = await circuit.calculateWitness(circuitInputs);
    await circuit.expectConstraintPass(witness);
    const isValid = await getSignal(circuit, witness, "isValid");
    expect(isValid.toString()).to.eq("1");
  });

  it("should return 0 for an off-curve point (0, 0)", async () => {
    const circuitInputs = {
      x: 0,
      y: 0,
    };

    const witness = await circuit.calculateWitness(circuitInputs);
    await circuit.expectConstraintPass(witness);
    const isValid = await getSignal(circuit, witness, "isValid");
    expect(isValid.toString()).to.eq("0");
  });

  it("should return 0 for an off-curve point (1, 1)", async () => {
    const circuitInputs = {
      x: 1,
      y: 1,
    };

    const witness = await circuit.calculateWitness(circuitInputs);
    await circuit.expectConstraintPass(witness);
    const isValid = await getSignal(circuit, witness, "isValid");
    expect(isValid.toString()).to.eq("0");
  });
});
