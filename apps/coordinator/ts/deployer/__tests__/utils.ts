import { Keypair, PrivKey } from "@maci-protocol/domainobjs";
import { EPolicies, EInitialVoiceCreditProxies } from "@maci-protocol/sdk";
import { zeroHash } from "viem";

import {
  IDeployMaciConfig,
  IDeployPollConfig,
  IEASPolicyArgs,
  IGitcoinPassportPolicyArgs,
  IHatsPolicyArgs,
  IMerkleProofPolicyArgs,
  ISemaphorePolicyArgs,
  ISignUpPolicyArgs,
  IZupassPolicyArgs,
} from "../types";

export const MSG_BATCH_SIZE = 20;

/**
 * Coordinator MACI Keypair
 */
export const coordinatorMACIKeyPair = new Keypair(
  PrivKey.deserialize("macisk.bdd73f1757f75261a0c9997def6cd47519cad2856347cdc6fd30718999576860"),
);

/**
 * MACI deployment configuration for testing
 */
export const testMaciDeploymentConfig: IDeployMaciConfig = {
  policy: {
    type: EPolicies.FreeForAll,
  },
  MACI: {
    policy: EPolicies.FreeForAll,
    stateTreeDepth: 10,
  },
  VkRegistry: {
    args: {
      stateTreeDepth: 10n,
      messageBatchSize: MSG_BATCH_SIZE,
      voteOptionTreeDepth: 2n,
      intStateTreeDepth: 1n,
    },
  },
  Poseidon: {
    // poseidon contracts on optimism sepolia
    poseidonT3: "0x07490eba00dc4ACA6721D052Fa4C5002Aa077233",
    poseidonT4: "0xbb0e724CE02e5E7eDd31e632dc6e59F229a1126d",
    poseidonT5: "0xE0398F7DFAC494c530F6404AfEaC8669ABeD2679",
    poseidonT6: "0xfD77833F10a29c76A6a0ede235Eb651D744d0E2F",
  },
};

/**
 * Start date for the poll (it cannot be in the past)
 * n seconds are added to give it time until it is deployed
 */
export const startDate = Math.floor(Date.now() / 1000) + 100;

/**
 * Poll duration in seconds
 * n seconds are added to the poll start date
 */
export const pollDuration = 60;

/**
 * Poll start date extra seconds
 * n seconds are added to the poll start date
 * to give it time until it the previous poll contracts are deployed
 */
export const pollStartDateExtraSeconds = 100;

/**
 * Poll deployment configuration for testing
 */
export const testPollDeploymentConfig: IDeployPollConfig = {
  startDate,
  endDate: startDate + pollDuration,
  useQuadraticVoting: false,
  coordinatorPubkey: coordinatorMACIKeyPair.pubKey.serialize(),
  intStateTreeDepth: 1,
  messageBatchSize: MSG_BATCH_SIZE,
  voteOptionTreeDepth: 2,
  policy: {
    type: EPolicies.FreeForAll,
  },
  initialVoiceCreditsProxy: {
    type: EInitialVoiceCreditProxies.Constant,
    args: {
      amount: 100,
    },
  },
  voteOptions: 2n,
};

/**
 *
 * Policies
 *
 */
/**
 * EAS Policy deployment configuration for testing
 */
export const EASPolicyDeploymentConfig: IEASPolicyArgs = {
  easAddress: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
  attester: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  schema: "0xe2636f31239f7948afdd9a9c477048b7fc2a089c347af60e3aa1251e5bf63e5c",
};

/**
 * Zupass Policy deployment configuration for testing
 */
export const ZupassPolicyDeploymentConfig: IZupassPolicyArgs = {
  signer1: "13908133709081944902758389525983124100292637002438232157513257158004852609027",
  signer2: "7654374482676219729919246464135900991450848628968334062174564799457623790084",
  eventId: "0",
  zupassVerifier: "0x2272cdb3596617886d0F48524DA486044E0376d6",
};

/**
 * Semaphore Policy deployment configuration for testing
 */
export const SemaphorePolicyDeploymentConfig: ISemaphorePolicyArgs = {
  semaphoreContract: "0x0A09FB3f63c13F1C54F2fA41AFB1e7a98cffc774",
  groupId: "0",
};

/**
 * HatsPolicy deployment configuration for testing
 */
export const HatsPolicyDeploymentConfig: IHatsPolicyArgs = {
  hatsProtocolAddress: "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137",
  critrionHats: ["26960358043289970096177553829315270011263390106506980876069447401472"],
};

/**
 * MerkleProofPolicy deployment configuration for testing
 */
export const MerkleProofPolicyDeploymentConfig: IMerkleProofPolicyArgs = {
  root: zeroHash,
};

/**
 * SignUpPolicy deployment configuration for testing
 */
export const SignUpPolicyDeploymentConfig: ISignUpPolicyArgs = {
  token: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7", // OP Sepolia USDC
};

/**
 * GitcoinPassportPolicy deployment configuration for testing
 */
export const GitcoinPassportPolicyDeploymentConfig: IGitcoinPassportPolicyArgs = {
  decoderAddress: "0xe53C60F8069C2f0c3a84F9B3DB5cf56f3100ba56",
  passingScore: "5",
};
