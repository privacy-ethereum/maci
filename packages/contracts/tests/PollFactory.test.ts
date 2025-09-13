import { Keypair } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { type BaseContract, type Signer, ZeroAddress } from "ethers";

import { deployPollFactory, generateEmptyBallotRoots, getDefaultSigner } from "../ts";
import { type MACI, type PollFactory, type Verifier, type VerifyingKeysRegistry } from "../typechain-types";

import {
  messageBatchSize,
  initialVoiceCreditBalance,
  STATE_TREE_DEPTH,
  treeDepths,
  type ExtContractsStruct,
  maxVoteOptions,
} from "./constants";
import { deployTestContracts } from "./utils";

describe("pollFactory", () => {
  let maciContract: MACI;
  let verifierContract: Verifier;
  let verifyingKeysRegistryContract: VerifyingKeysRegistry;
  let extContracts: ExtContractsStruct;
  let pollFactory: PollFactory;
  let signer: Signer;

  const { publicKey: coordinatorPublicKey } = new Keypair();

  const emptyBallotRoots = generateEmptyBallotRoots(STATE_TREE_DEPTH);
  const emptyBallotRoot = emptyBallotRoots[treeDepths.voteOptionTreeDepth];

  before(async () => {
    signer = await getDefaultSigner();
    const r = await deployTestContracts({ initialVoiceCreditBalance, stateTreeDepth: STATE_TREE_DEPTH, signer });
    maciContract = r.maciContract;
    verifierContract = r.mockVerifierContract as Verifier;
    verifyingKeysRegistryContract = r.verifyingKeysRegistryContract;
    extContracts = {
      maci: maciContract,
      verifier: verifierContract,
      verifyingKeysRegistry: verifyingKeysRegistryContract,
      policy: r.policyContract,
      initialVoiceCreditProxy: r.constantInitialVoiceCreditProxyContract,
    };

    pollFactory = (await deployPollFactory(signer, undefined, true)) as BaseContract as PollFactory;
  });

  describe("deployment", () => {
    it("should allow anyone to deploy a new poll", async () => {
      const tx = await pollFactory.deploy({
        startDate: new Date().getTime(),
        endDate: new Date().getTime() + 100,
        treeDepths,
        messageBatchSize,
        coordinatorPublicKey: coordinatorPublicKey.asContractParam(),
        extContracts,
        emptyBallotRoot,
        pollId: 0n,
        relayers: [ZeroAddress],
        voteOptions: maxVoteOptions,
      });
      const receipt = await tx.wait();
      expect(receipt?.status).to.eq(1);
    });
  });
});
