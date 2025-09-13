import { mulPointEscalar } from "@zk-kit/baby-jubjub";
import {
  derivePublicKey,
  deriveSecretScalar,
  packPublicKey as packPublicKeyZkkit,
  unpackPublicKey as unpackPublicKeyZkkit,
} from "@zk-kit/eddsa-poseidon";

import { randomBytes } from "crypto";

import { generateRandomBabyJubValue } from "./babyjub";
import { type EcdhSharedKey, type Keypair, type Point, type PrivateKey, type PublicKey } from "./types";

/**
 * Generate a private key
 * @returns A random seed for a private key.
 */
export const generatePrivateKey = (): bigint => BigInt(`0x${randomBytes(32).toString("hex")}`);

/**
 * Generate a random value
 * @returns A BabyJub-compatible salt.
 */
export const generateRandomSalt = (): bigint => generateRandomBabyJubValue();

/**
 * An internal function which formats a random private key to be compatible
 * with the BabyJub curve. This is the format which should be passed into the
 * PublicKey and other circuits.
 * @param privateKey A private key generated using generatePrivateKey()
 * @returns A BabyJub-compatible private key.
 */
export const formatPrivateKeyForBabyJub = (privateKey: PrivateKey): bigint =>
  BigInt(deriveSecretScalar(privateKey.toString()));

/**
 * Losslessly reduces the size of the representation of a public key
 * @param publicKey The public key to pack
 * @returns A packed public key
 */
export const packPublicKey = (publicKey: PublicKey): bigint => BigInt(packPublicKeyZkkit(publicKey));

/**
 * Restores the original PublicKey from its packed representation
 * @param packed The value to unpack
 * @returns The unpacked public key
 */
export const unpackPublicKey = (packed: bigint): PublicKey => {
  const publicKey = unpackPublicKeyZkkit(packed);
  return publicKey.map((x) => BigInt(x)) as PublicKey;
};

/**
 * @param privateKey A private key generated using generatePrivateKey()
 * @returns A public key associated with the private key
 */
export const generatePublicKey = (privateKey: PrivateKey): PublicKey => {
  const key = derivePublicKey(privateKey.toString());
  return [BigInt(key[0]), BigInt(key[1])];
};

/**
 * Generates a keypair.
 * @returns a keypair
 */
export const generateKeypair = (): Keypair => {
  const privateKey = generatePrivateKey();
  const publicKey = generatePublicKey(privateKey);

  const keypair: Keypair = { privateKey, publicKey };

  return keypair;
};

/**
 * Generates an Elliptic-Curve Diffie–Hellman (ECDH) shared key given a private
 * key and a public key.
 * @param privateKey A private key generated using generatePrivateKey()
 * @param publicKey A public key generated using generatePublicKey()
 * @returns The ECDH shared key.
 */
export const generateEcdhSharedKey = (privateKey: PrivateKey, publicKey: PublicKey): EcdhSharedKey =>
  mulPointEscalar(publicKey as Point<bigint>, formatPrivateKeyForBabyJub(privateKey));
