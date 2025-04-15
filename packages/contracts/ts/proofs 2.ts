import { stringifyBigInts } from "@maci-protocol/crypto";
import { IVkObjectParams } from "@maci-protocol/domainobjs";
import { groth16, type PublicSignals, type Groth16Proof, zKey } from "snarkjs";

import childProcess from "child_process";
import fs from "fs";
import { tmpdir } from "os";
import path from "path";

import type { IGenProofOptions, ISnarkJSVerificationKey, FullProveResult, Proof } from "./types";

import { cleanThreads, unlinkFile } from "./utils";

/**
 * Generate a zk-SNARK proof using snarkjs
 * @param inputs - the inputs to the circuit
 * @param zkeyPath - the path to the zkey
 * @param wasmPath - the path to the wasm witness
 * @returns the zk-SNARK proof and public signals
 */
export const genProofSnarkjs = async ({ inputs, zkeyPath, wasmPath }: IGenProofOptions): Promise<FullProveResult> => {
  if (!wasmPath) {
    throw new Error("wasmPath must be specified");
  }

  const { proof, publicSignals } = await groth16.fullProve(inputs, wasmPath, zkeyPath);
  return { proof, publicSignals };
};

/**
 * Generate a zk-SNARK proof using rapidnsark
 * @param inputs - the inputs to the circuit
 * @param zkeyPath - the path to the zkey
 * @param witnessExePath - the path to the compiled witness binary
 * @param rapidsnarkExePath - the path to the rapidnsark binary
 * @returns the zk-SNARK proof and public signals
 */
export const genProofRapidSnark = async ({
  inputs,
  zkeyPath,
  witnessExePath,
  rapidsnarkExePath,
}: IGenProofOptions): Promise<FullProveResult> => {
  // intel chip flow (use rapidnsark)
  // Create tmp directory
  const tmpPath = path.resolve(tmpdir(), `tmp-${Date.now()}`);
  await fs.promises.mkdir(tmpPath, { recursive: true });

  const inputJsonPath = path.resolve(tmpPath, "input.json");
  const outputWtnsPath = path.resolve(tmpPath, "output.wtns");
  const proofJsonPath = path.resolve(tmpPath, "proof.json");
  const publicJsonPath = path.resolve(tmpPath, "public.json");

  // Write input.json
  const jsonData = JSON.stringify(stringifyBigInts(inputs));
  await fs.promises.writeFile(inputJsonPath, jsonData);

  const { promisify } = await import("util");
  const execFile = promisify(childProcess.execFile);

  // Generate the witness
  await execFile(witnessExePath!, [inputJsonPath, outputWtnsPath]);

  const isOutputWtnsExists = fs.existsSync(outputWtnsPath);

  if (!isOutputWtnsExists) {
    throw new Error(`Error executing ${witnessExePath} ${inputJsonPath} ${outputWtnsPath}`);
  }

  // Generate the proof
  await execFile(rapidsnarkExePath!, [zkeyPath, outputWtnsPath, proofJsonPath, publicJsonPath]);

  const isProofJsonPathExists = fs.existsSync(proofJsonPath);

  if (!isProofJsonPathExists) {
    throw new Error(
      `Error executing ${rapidsnarkExePath} ${zkeyPath} ${outputWtnsPath} ${proofJsonPath} ${publicJsonPath}`,
    );
  }

  // Read the proof and public inputs
  const proof = JSON.parse(await fs.promises.readFile(proofJsonPath).then((res) => res.toString())) as Groth16Proof;
  const publicSignals = JSON.parse(
    await fs.promises.readFile(publicJsonPath).then((res) => res.toString()),
  ) as PublicSignals;

  // remove all artifacts
  await Promise.all([proofJsonPath, publicJsonPath, inputJsonPath, outputWtnsPath].map(unlinkFile));

  // remove tmp directory
  await fs.promises.rmdir(tmpPath);

  return { proof, publicSignals };
};

/**
 * Verify a zk-SNARK proof using snarkjs
 * @param publicInputs - the public inputs to the circuit
 * @param proof - the proof
 * @param vk - the verification key
 * @param cleanup - whether to cleanup the threads or not
 * @returns whether the proof is valid or not
 */
export const verifyProof = async (
  publicInputs: PublicSignals,
  proof: Groth16Proof,
  vk: ISnarkJSVerificationKey,
  cleanup = true,
): Promise<boolean> => {
  const isValid = await groth16.verify(vk, publicInputs, proof);
  if (cleanup) {
    await cleanThreads();
  }
  return isValid;
};

/**
 * Extract the Verification Key from a zKey
 * @param zkeyPath - the path to the zKey
 * @param cleanup - whether to cleanup the threads or not
 * @returns the verification key
 */
export const extractVk = async (zkeyPath: string, cleanup = true): Promise<IVkObjectParams> =>
  zKey
    .exportVerificationKey(zkeyPath)
    .then((vk) => vk as IVkObjectParams)
    .finally(() => {
      if (cleanup) {
        cleanThreads();
      }
    });

/**
 * Interface that represents read proofs arguments
 */
interface IReadProofsArgs {
  files: string[];
  folder: string;
  type: "tally" | "process";
}

/**
 * Read and parse proofs
 *
 * @param args - read proofs arguments
 * @returns proofs
 */
export async function readProofs({ files, folder, type }: IReadProofsArgs): Promise<Proof[]> {
  return Promise.all(
    files
      .filter((f) => f.startsWith(`${type}_`) && f.endsWith(".json"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
        const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
        return numA - numB;
      })
      .map(async (file) =>
        fs.promises.readFile(`${folder}/${file}`, "utf8").then((result) => JSON.parse(result) as Proof),
      ),
  );
}
