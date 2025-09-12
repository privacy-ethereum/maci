import { Keypair } from "@maci-protocol/domainobjs";
import { isArm, joinPoll, signup, sleepUntil, ESupportedChains, ContractStorage } from "@maci-protocol/sdk";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import dotenv from "dotenv";
import { type Signer } from "ethers";
import { type Socket, io } from "socket.io-client";
import { type Hex, zeroAddress } from "viem";

import path from "path";

import type { IGenerateData } from "../ts/proof/types";

import { AppModule } from "../ts/app.module";
import { getSigner } from "../ts/common";
import {
  pollDuration,
  pollStartDateExtraSeconds,
  testMaciDeploymentConfig,
  testPollDeploymentConfig,
} from "../ts/deployer/__tests__/utils";
import { DeployerModule } from "../ts/deployer/deployer.module";
import { FileModule } from "../ts/file/file.module";
import { type IGetPublicKeyData } from "../ts/file/types";
import { type IHealthCheckResponse } from "../ts/health/types";
import { ProofModule } from "../ts/proof/proof.module";
import { SessionKeysModule } from "../ts/sessionKeys/sessionKeys.module";
import { type IGenerateSessionKeyReturn } from "../ts/sessionKeys/types";

import {
  pollJoiningTestZkeyPath,
  testPollJoiningWasmPath,
  testPollJoiningWitnessPath,
  testRapidsnarkPath,
  zeroUint256Encoded,
} from "./constants";
import { getAuthorizationHeader } from "./utils";

dotenv.config();

jest.setTimeout(700000); // Sets timeout to 700 seconds

const PORT = process.env.COORDINATOR_PORT || 3000;
const TEST_URL = `http://localhost:${PORT}/v1`;
const CHAIN = ESupportedChains.Localhost;

const REGEX_SUBGRAPH = /^https:\/\/api\.studio\.thegraph\.com\/query\/\d+\/maci-subgraph\/v0\.0\.\d+$/;

const NUM_USERS = 1;
const VOTE_OPTIONS: Record<string, number> = {
  "0": 0,
  "1": 0,
};

const useWasm = isArm();

describe("E2E Deployment Tests", () => {
  let signer: Signer;
  let encryptedHeader: string;

  let app: INestApplication;
  let socket: Socket;

  let maciAddress: Hex;
  let maciCreatedAt: bigint;
  let pollId: bigint;

  // set up coordinator address
  beforeAll(async () => {
    signer = await getSigner(CHAIN);

    encryptedHeader = await getAuthorizationHeader(signer);
    process.env.COORDINATOR_ADDRESSES = await signer.getAddress();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, FileModule, DeployerModule, ProofModule, SessionKeysModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    await app.listen(PORT);
  });

  afterAll(async () => {
    await app.close();
    const storageInstance = ContractStorage.getInstance(path.join(process.cwd(), "deployed-contracts.json"));
    storageInstance.cleanup(CHAIN);
  });

  // set up auth header in WS connection
  beforeEach(async () => {
    const authorization = await getAuthorizationHeader(signer);

    await new Promise((resolve) => {
      app.getUrl().then((url) => {
        socket = io(url, {
          extraHeaders: {
            authorization,
          },
        });
        socket.on("connect", () => {
          resolve(true);
        });
      });
    });
  });

  afterEach(() => {
    socket.disconnect();
  });

  test("should return true in the health check", async () => {
    const response = await fetch(`${TEST_URL}/health/check`, { method: "GET" });
    const body = (await response.json()) as IHealthCheckResponse;

    expect(response.status).toBe(200);
    expect(body.rapidsnark.rapidsnarkIsExecutable).toBe(true);
    expect(body.zkeysDirectory.zkeysDirectoryExists).toBe(true);
    expect(body.coordinatorWalletFunds.fundsInNetworks[0].address).not.toBe(zeroAddress);
  });

  test("should retrieve RSA public key", async () => {
    const response = await fetch(`${TEST_URL}/proof/publicKey`, {
      method: "GET",
    });
    const body = (await response.json()) as IGetPublicKeyData;

    expect(response.status).toBe(200);
    expect(body.publicKey).toBeDefined();
  });

  test("should retrieve the session key address", async () => {
    const response = await fetch(`${TEST_URL}/session-keys/generate`, {
      method: "GET",
      headers: {
        Authorization: encryptedHeader,
      },
    });
    const body = (await response.json()) as IGenerateSessionKeyReturn;
    expect(response.status).toBe(200);
    expect(body.sessionKeyAddress).not.toBe(zeroAddress);
  });

  test("should deploy MACI correctly", async () => {
    const response = await fetch(`${TEST_URL}/deploy/maci`, {
      method: "POST",
      headers: {
        Authorization: encryptedHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain: CHAIN,
        config: testMaciDeploymentConfig,
      }),
    });

    const body = (await response.json()) as { address: string };

    expect(response.status).toBe(201);
    expect(body.address).not.toBe(zeroAddress);

    // save them for next tests
    const blockNumber = await signer.provider!.getBlockNumber();
    maciCreatedAt = BigInt(blockNumber);
    maciAddress = body.address as Hex;
  });

  test("should deploy a poll correctly", async () => {
    testPollDeploymentConfig.voteOptions = testPollDeploymentConfig.voteOptions.toString();

    const startDate = Math.floor(Date.now() / 1000) + pollStartDateExtraSeconds;
    testPollDeploymentConfig.startDate = startDate;
    testPollDeploymentConfig.endDate = startDate + pollDuration;

    const response = await fetch(`${TEST_URL}/deploy/poll`, {
      method: "POST",
      headers: {
        Authorization: encryptedHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain: CHAIN,
        config: testPollDeploymentConfig,
      }),
    });
    const body = (await response.json()) as { pollId: string };

    expect(response.status).toBe(201);
    expect(body.pollId).toBeDefined();

    // save them for next tests
    pollId = BigInt(body.pollId);
  });

  test("should allow voting on a poll", async () => {
    await sleepUntil(testPollDeploymentConfig.startDate * 1000);

    for (let i = 0; i < NUM_USERS; i += 1) {
      const keypairUser = new Keypair();
      const userPublicKey = keypairUser.publicKey.serialize();
      const userPrivateKey = keypairUser.privateKey.serialize();
      const vote = i % 2;
      VOTE_OPTIONS[String(vote)] += 1;

      // user signs up to MACI
      // eslint-disable-next-line no-await-in-loop
      await signup({
        maciAddress,
        maciPublicKey: userPublicKey,
        sgData: zeroUint256Encoded,
        signer,
      });

      // user joins the poll
      // eslint-disable-next-line no-await-in-loop
      await joinPoll({
        maciAddress,
        privateKey: userPrivateKey,
        pollId: BigInt(pollId),
        pollJoiningZkey: pollJoiningTestZkeyPath,
        useWasm,
        pollWasm: testPollJoiningWasmPath,
        pollWitnessGenerator: testPollJoiningWitnessPath,
        rapidsnark: testRapidsnarkPath,
        sgDataArg: zeroUint256Encoded,
        ivcpDataArg: zeroUint256Encoded,
        signer,
      });
    }
  });

  test("should deploy a subgraph correctly", async () => {
    const response = await fetch(`${TEST_URL}/subgraph/deploy`, {
      method: "POST",
      headers: {
        Authorization: encryptedHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maciContractAddress: maciAddress,
        startBlock: Number(maciCreatedAt),
        network: ESupportedChains.OptimismSepolia,
        name: process.env.SUBGRAPH_NAME,
        tag: `v0.0.${+new Date()}`, // different versions per test using timestamp
      }),
    });

    const body = await response.json();

    if (response.status === 400) {
      const errorMessage = (body as { message: string }).message;

      if (errorMessage.includes("api.thegraph.com | 502: Bad gateway")) {
        // eslint-disable-next-line no-console
        console.info("It looks like there was a problem with The Graph endpoint. We are passing this test.");
        return;
      }
    }

    const { url } = body as { url: string };

    expect(response.status).toBe(201);
    expect(url).toBeDefined();
    expect(REGEX_SUBGRAPH.test(url)).toBe(true);
  });

  test("should merge correctly", async () => {
    await sleepUntil((testPollDeploymentConfig.endDate + 5) * 1000); // 5 seconds of grace time after the poll end date

    const response = await fetch(`${TEST_URL}/proof/merge`, {
      method: "POST",
      headers: {
        Authorization: encryptedHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maciContractAddress: maciAddress,
        pollId: Number(pollId),
        chain: CHAIN,
      }),
    });

    expect(response.status).toBe(201);
  });

  test("should generate proofs correctly", async () => {
    const response = await fetch(`${TEST_URL}/proof/generate`, {
      method: "POST",
      headers: {
        Authorization: encryptedHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        poll: Number(pollId),
        maciContractAddress: maciAddress,
        mode: testPollDeploymentConfig.mode,
        startBlock: Number(maciCreatedAt),
        blocksPerBatch: 500,
        chain: CHAIN,
        useWasm,
      }),
    });
    const body = (await response.json()) as IGenerateData;

    expect(response.status).toBe(201);
    expect(body.processProofs).toBeDefined();
    expect(body.processProofs.length).toBeGreaterThan(0);
    expect(body.tallyProofs).toBeDefined();
    expect(body.tallyProofs.length).toBeGreaterThan(0);
    expect(body.tallyData).toBeDefined();
    expect(body.tallyData.results).toBeDefined();
  });

  test("should submit results on-chain correctly", async () => {
    const response = await fetch(`${TEST_URL}/proof/submit`, {
      method: "POST",
      headers: {
        Authorization: encryptedHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pollId: Number(pollId),
        maciContractAddress: maciAddress,
        chain: CHAIN,
      }),
    });

    expect(response.status).toBe(201);
  });
});
