import { poseidon } from "@maci-protocol/crypto";
import { Keypair, type Message, PrivateKey, type PublicKey, VoteCommand } from "@maci-protocol/domainobjs";
import { expect } from "chai";
import { AbiCoder, type Signer, type TransactionReceipt } from "ethers";
import hardhat from "hardhat";

import type { EthereumProvider } from "hardhat/types";

import { EDeploySteps } from "../tasks/helpers/constants";
import { ContractStorage } from "../tasks/helpers/ContractStorage";
import { Deployment } from "../tasks/helpers/Deployment";
import { EContracts } from "../tasks/helpers/types";
import { timeTravel } from "../tests/utils";
import { logMagenta, logRed } from "../ts/logger";
import { sleep } from "../ts/utils";
import { type Poll, type MACI } from "../typechain-types";

describe("E2E hardhat tasks", function test() {
  this.timeout(900000);

  let startBlock: number;
  let initialBalance: bigint;
  const blocksPerBatch = 50;

  const contractStorage = ContractStorage.getInstance();
  const deployment = Deployment.getInstance({ contractNames: EContracts, hre: hardhat });

  const testPrivateKey = PrivateKey.deserialize(
    "macisk.4999e86e8fcda7d75c1c8ffa4bab775b28c22ea00b36cd42cad85e344c9dc11a",
  );
  const testCoordinatorPrivateKey = PrivateKey.deserialize(
    "macisk.9ebb49559ceec9acb15ba2d817892ccfbcbfe9470e24285bdaf5b8129037b7cf",
  );
  const user = new Keypair(testPrivateKey);
  const coordinator = new Keypair(testCoordinatorPrivateKey);

  const mockProof = [
    "6149416995690965343550882735312573822145610878030694463927605897650681911976",
    "21679078702273228234006833354833752010140695168528105083176932016137274482949",
    "3326875560512011915415961911884949653581986457937323894097643059822918175268",
    "6076995367109336694679952267702292052547711891028823000470411763364060354524",
    "17292292445664382989515917689757834881601016370810952777813270601469686951013",
    "780891443390065397541654084315677370649129757266270909445375867594538070865",
    "9966265682265386834452940000869313513891906112041401722732683576592904723879",
    "12205177532055774505538100985022406409017227789856807396646127774570982970497",
  ];
  const pollDuration = 300;

  const args = { incremental: hardhat.network.name !== "hardhat" };

  const getPollContract = async (): Promise<{ pollContract: Poll; pollId: bigint }> => {
    const maciAddress = contractStorage.mustGetAddress(EContracts.MACI, hardhat.network.name);
    const maciContract = await deployment.getContract<MACI>({ name: EContracts.MACI, address: maciAddress });
    const nextPollId = await maciContract.nextPollId();
    const pollAddresses = await maciContract.getPoll(nextPollId - 1n);

    const pollContract = await deployment.getContract<Poll>({ name: EContracts.Poll, address: pollAddresses.poll });
    const pollId = nextPollId - 1n;

    return { pollContract, pollId };
  };

  const withLog = async (
    operation: string,
    signer: Signer,
    handleTransaction: (caller: Signer) => Promise<TransactionReceipt | null>,
  ): Promise<TransactionReceipt | null> => {
    logMagenta({ text: `*** ${operation} ***` });

    const startBalance = await signer.provider!.getBalance(signer);

    logMagenta({ text: `Start balance: ${Number(startBalance / 10n ** 12n) / 1e6}` });

    const receipt = await handleTransaction(signer);

    const { gasPrice } = hardhat.network.config;
    const endBalance = await signer.provider!.getBalance(signer);

    logMagenta({ text: `End balance: ${Number(endBalance / 10n ** 12n) / 1e6}` });
    logMagenta({ text: `Cost: ${Number((startBalance - endBalance) / 10n ** 12n) / 1e6}` });

    if (!receipt) {
      logRed({ text: "Transaction receipt is undefined" });
      return null;
    }

    if (gasPrice !== "auto") {
      logMagenta({ text: `Gas used: ${(receipt.gasUsed.toString(), "@", gasPrice / 1e9)} gwei` });
    } else {
      logMagenta({ text: `Gas used: ${receipt.gasUsed.toString()}` });
    }

    logMagenta({ text: "******" });

    return receipt;
  };

  before(() => {
    if (!args.incremental) {
      contractStorage.cleanup(hardhat.network.name);
    }
  });

  after(async () => {
    await deployment.finish(initialBalance, true);
  });

  it("should deploy policy contracts properly", async () => {
    deployment.setHre(hardhat);
    const deployer = await deployment.getDeployer();

    initialBalance = await deployer.provider!.getBalance(deployer);
    startBlock = await deployer.provider!.getBlockNumber();

    await hardhat.run(EDeploySteps.Policies, args);
  });

  it("should deploy verifier contract properly", async () => {
    await hardhat.run(EDeploySteps.Verifier, args);
  });

  it("should deploy poseidon contracts properly", async () => {
    await hardhat.run(EDeploySteps.Poseidon, args);
  });

  it("should deploy poll factory contract properly", async () => {
    await hardhat.run(EDeploySteps.PollFactory, args);
  });

  it("should deploy message processor factory contract properly", async () => {
    await hardhat.run(EDeploySteps.MessageProcessorFactory, args);
  });

  it("should deploy tally factory contract properly", async () => {
    await hardhat.run(EDeploySteps.TallyFactory, args);
  });

  it("should deploy maci contract properly", async () => {
    await hardhat.run(EDeploySteps.Maci, args);
  });

  it("should deploy verifying keys registry contract properly", async () => {
    await hardhat.run(EDeploySteps.VerifyingKeysRegistry, args);
  });

  it("should deploy voice credit proxy factory contract properly", async () => {
    await hardhat.run(EDeploySteps.InitialVoiceCreditProxyFactory, args);
  });

  it("should deploy voice credit proxy contract properly", async () => {
    await hardhat.run(EDeploySteps.InitialVoiceCreditProxy, args);
  });

  it("should deploy poll policy contract properly", async () => {
    await hardhat.run(EDeploySteps.PollPolicy, args);
  });

  it("should deploy poll contract properly", async () => {
    const now = Math.floor(Date.now() / 1000);

    deployment.updateDeployConfig(EContracts.Poll, "pollStartDate", now - pollDuration);
    deployment.updateDeployConfig(EContracts.Poll, "pollEndDate", now + pollDuration);

    await hardhat.run(EDeploySteps.Poll, args);
  });

  it("should signup one user properly", async () => {
    const maciAddress = contractStorage.mustGetAddress(EContracts.MACI, hardhat.network.name);
    const maciContract = await deployment.getContract<MACI>({ name: EContracts.MACI, address: maciAddress });
    const signer = await deployment.getDeployer();

    const receipt = await withLog("Signup", signer, (caller: Signer) =>
      maciContract
        .connect(caller)
        .signUp(user.publicKey.asContractParam(), AbiCoder.defaultAbiCoder().encode(["uint256"], [1]))
        .then((tx) => tx.wait()),
    );

    const [event] = await maciContract.queryFilter(
      maciContract.filters.SignUp,
      receipt?.blockNumber,
      receipt?.blockNumber,
    );

    // eslint-disable-next-line no-underscore-dangle
    expect(event.args._stateIndex.toString()).to.eq("1");
  });

  it("should join one user to poll properly", async () => {
    const { pollContract, pollId } = await getPollContract();
    const signer = await deployment.getDeployer();

    const stateIndex = 1;
    const nullifier = poseidon([BigInt(user.privateKey.asCircuitInputs()), pollId]);
    const signUpPolicyData = AbiCoder.defaultAbiCoder().encode(["uint256"], [stateIndex]);
    const initialVoiceCreditProxyData = AbiCoder.defaultAbiCoder().encode(["uint256"], [stateIndex]);

    const receipt = await withLog("Join poll", signer, (caller: Signer) =>
      pollContract
        .connect(caller)
        .joinPoll(
          nullifier,
          user.publicKey.asContractParam(),
          stateIndex,
          mockProof,
          signUpPolicyData,
          initialVoiceCreditProxyData,
        )
        .then((tx) => tx.wait()),
    );

    expect(receipt?.status).to.eq(1);
  });

  it("should publish one message properly", async () => {
    const { pollContract, pollId } = await getPollContract();
    const signer = await deployment.getDeployer();

    const command = new VoteCommand(1n, user.publicKey, 0n, 9n, 1n, pollId, 0n);
    const signature = command.sign(user.privateKey);
    const sharedKey = Keypair.generateEcdhSharedKey(user.privateKey, coordinator.publicKey);
    const message = command.encrypt(signature, sharedKey);

    const receipt = await withLog("Publish message", signer, (caller: Signer) =>
      pollContract
        .connect(caller)
        .publishMessage(message.asContractParam(), user.publicKey.asContractParam())
        .then((tx) => tx.wait()),
    );

    expect(receipt?.status).to.eq(1);
  });

  it("should publish messages batch properly", async () => {
    const { pollContract, pollId } = await getPollContract();
    const signer = await deployment.getDeployer();

    const messages: [Message, PublicKey][] = [];

    for (let i = 0; i < 2; i += 1) {
      const command = new VoteCommand(1n, user.publicKey, 0n, 9n, 1n, pollId, BigInt(i));
      const signature = command.sign(user.privateKey);
      const sharedKey = Keypair.generateEcdhSharedKey(user.privateKey, coordinator.publicKey);
      const message = command.encrypt(signature, sharedKey);
      messages.push([message, user.publicKey]);
    }

    const receipt = await withLog("Publish message batch", signer, (caller: Signer) =>
      pollContract
        .connect(caller)
        .publishMessageBatch(
          messages.map(([m]) => m.asContractParam()),
          messages.map(([, k]) => k.asContractParam()),
        )
        .then((tx) => tx.wait()),
    );

    expect(receipt?.status).to.eq(1);
  });

  it("should merge signups properly", async () => {
    const { pollContract, pollId } = await getPollContract();

    if (hardhat.network.name !== "hardhat") {
      await sleep(pollDuration * 1000 + 1);
    } else {
      const deployer = await deployment.getDeployer();
      await timeTravel(deployer.provider as unknown as EthereumProvider, pollDuration + 1);
    }

    await hardhat.run("merge", { poll: pollId.toString() });

    const isStateMerged = await pollContract.stateMerged();

    expect(isStateMerged).to.eq(true);
  });

  it("should generate proofs properly", async () => {
    const { pollId } = await getPollContract();

    const start = performance.now();

    await hardhat.run("prove", {
      poll: pollId.toString(),
      coordinatorPrivateKey: testCoordinatorPrivateKey.serialize(),
      startBlock,
      blocksPerBatch,
      tallyFile: "./tally.json",
      outputDir: "./proofs",
    });

    const end = performance.now();

    logMagenta({ text: `Prove operation took ${(end - start).toFixed(2)} ms` });
  });

  it("should submit onchain properly", async () => {
    const { pollId } = await getPollContract();

    const start = performance.now();

    await hardhat.run("submitOnChain", {
      poll: pollId.toString(),
      tallyFile: "./tally.json",
      outputDir: "./proofs",
    });

    const end = performance.now();

    logMagenta({ text: `Submit onchain operation took ${(end - start).toFixed(2)} ms` });
  });
});
