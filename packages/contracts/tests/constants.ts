import { type ITreeDepths, STATE_TREE_ARITY } from "@maci-protocol/core";
import { G1Point, G2Point } from "@maci-protocol/crypto";
import { VerifyingKey } from "@maci-protocol/domainobjs";
import { type AddressLike } from "ethers";

export interface ExtContractsStruct {
  maci: AddressLike;
  verifier: AddressLike;
  verifyingKeysRegistry: AddressLike;
  policy: AddressLike;
  initialVoiceCreditProxy: AddressLike;
}

export const duration = 2_000_000;

export const STATE_TREE_DEPTH = 10;
export const MESSAGE_TREE_DEPTH = 2;
export const MESSAGE_TREE_SUBDEPTH = 1;
export const messageBatchSize = 20;

export const testPollJoiningVerifyingKey = new VerifyingKey(
  new G1Point(BigInt(0), BigInt(1)),
  new G2Point([BigInt(2), BigInt(3)], [BigInt(4), BigInt(5)]),
  new G2Point([BigInt(6), BigInt(7)], [BigInt(8), BigInt(9)]),
  new G2Point([BigInt(10), BigInt(11)], [BigInt(12), BigInt(13)]),
  [new G1Point(BigInt(14), BigInt(15)), new G1Point(BigInt(16), BigInt(17))],
);

export const testPollJoinedVerifyingKey = new VerifyingKey(
  new G1Point(BigInt(0), BigInt(1)),
  new G2Point([BigInt(2), BigInt(3)], [BigInt(4), BigInt(5)]),
  new G2Point([BigInt(6), BigInt(7)], [BigInt(8), BigInt(9)]),
  new G2Point([BigInt(10), BigInt(11)], [BigInt(12), BigInt(13)]),
  [new G1Point(BigInt(14), BigInt(15)), new G1Point(BigInt(16), BigInt(17))],
);

export const testProcessVerifyingKey = new VerifyingKey(
  new G1Point(BigInt(0), BigInt(1)),
  new G2Point([BigInt(2), BigInt(3)], [BigInt(4), BigInt(5)]),
  new G2Point([BigInt(6), BigInt(7)], [BigInt(8), BigInt(9)]),
  new G2Point([BigInt(10), BigInt(11)], [BigInt(12), BigInt(13)]),
  [new G1Point(BigInt(14), BigInt(15)), new G1Point(BigInt(16), BigInt(17))],
);

export const testTallyVerifyingKey = new VerifyingKey(
  new G1Point(BigInt(0), BigInt(1)),
  new G2Point([BigInt(2), BigInt(3)], [BigInt(4), BigInt(5)]),
  new G2Point([BigInt(6), BigInt(7)], [BigInt(8), BigInt(9)]),
  new G2Point([BigInt(10), BigInt(11)], [BigInt(12), BigInt(13)]),
  [new G1Point(BigInt(14), BigInt(15)), new G1Point(BigInt(16), BigInt(17))],
);

export const testProcessVerifyingKeyNonQv = new VerifyingKey(
  new G1Point(BigInt(1), BigInt(1)),
  new G2Point([BigInt(2), BigInt(3)], [BigInt(4), BigInt(5)]),
  new G2Point([BigInt(6), BigInt(7)], [BigInt(8), BigInt(9)]),
  new G2Point([BigInt(10), BigInt(11)], [BigInt(12), BigInt(13)]),
  [new G1Point(BigInt(14), BigInt(15)), new G1Point(BigInt(16), BigInt(17))],
);

export const testTallyVerifyingKeyNonQv = new VerifyingKey(
  new G1Point(BigInt(1), BigInt(1)),
  new G2Point([BigInt(2), BigInt(3)], [BigInt(4), BigInt(5)]),
  new G2Point([BigInt(6), BigInt(7)], [BigInt(8), BigInt(9)]),
  new G2Point([BigInt(10), BigInt(11)], [BigInt(12), BigInt(13)]),
  [new G1Point(BigInt(14), BigInt(15)), new G1Point(BigInt(16), BigInt(17))],
);

export const initialVoiceCreditBalance = 100;
export const maxVoteOptions = 25;

export const treeDepths: ITreeDepths = {
  tallyProcessingStateTreeDepth: 1,
  voteOptionTreeDepth: 2,
  stateTreeDepth: 10,
};

export const tallyBatchSize = STATE_TREE_ARITY ** treeDepths.tallyProcessingStateTreeDepth;
