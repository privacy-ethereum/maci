import { jest } from "@jest/globals";
import { Keypair } from "@maci-protocol/domainobjs";
import { formatProofForVerifierContract, generateProofSnarkjs } from "@maci-protocol/sdk";
import { TestingClass, type User } from "@maci-protocol/testing";
import { HttpStatus, ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../ts/app.module.js";

import {
  pollJoinedWasm,
  pollJoinedZkey,
  pollJoiningZkey,
  pollJoiningWasm,
  pollWitnessGenerator,
  messageProcessorZkeyPathNonQv,
  rapidsnark,
  voteTallyZkeyPathNonQv,
  type TApp,
} from "./constants.js";

jest.unmock("@maci-protocol/sdk");

describe("Integration message batches", () => {
  let app: INestApplication<TApp>;
  let maciContractAddress: string;
  let user: User;

  beforeAll(async () => {
    await TestingClass.sleep(1_000);
    const testDeploy = await TestingClass.getInstance({
      pollJoiningZkeyPath: pollJoiningZkey,
      pollJoinedZkeyPath: pollJoinedZkey,
      messageProcessorZkeyPath: messageProcessorZkeyPathNonQv,
      voteTallyZkeyPath: voteTallyZkeyPathNonQv,
      pollJoiningWasm,
      pollWitnessGenerator,
      rapidsnark,
    });
    const poll = testDeploy.contractsData.maciState!.polls.get(0n);

    poll!.updatePoll(BigInt(testDeploy.contractsData.maciState!.publicKeys.length));

    maciContractAddress = testDeploy.contractsData.maciContractAddress!;
    [user] = testDeploy.contractsData.users!;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(3001);

    const circuitInputs = poll!.joinedCircuitInputs({
      maciPrivateKey: user.keypair.privateKey,
      stateLeafIndex: user.stateLeafIndex!,
      voiceCreditsBalance: user.voiceCreditBalance,
    });

    const { proof } = await generateProofSnarkjs({
      inputs: circuitInputs as unknown as Record<string, bigint>,
      zkeyPath: pollJoinedZkey,
      wasmPath: pollJoinedWasm,
    });

    const keypair = new Keypair();

    await request(app.getHttpServer())
      .post("/v1/messages/publish")
      .send({
        messages: [
          {
            data: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            publicKey: keypair.publicKey.serialize(),
          },
        ],
        poll: 0,
        maciContractAddress,
        stateLeafIndex: Number(user.stateLeafIndex!),
        proof: formatProofForVerifierContract(proof),
      })
      .expect(HttpStatus.CREATED);
  });

  afterAll(async () => {
    TestingClass.clean();
    await app.close();
  });

  describe("/v1/messageBatches/get", () => {
    test("should throw an error if dto is invalid", async () => {
      const result = await request(app.getHttpServer())
        .get("/v1/messageBatches/get")
        .send({
          limit: 0,
          skip: -1,
          poll: -1,
          maciContractAddress: "invalid",
          publicKeys: ["invalid"],
          ipfsHashes: ["invalid1", "invalid2"],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(result.body).toStrictEqual({
        error: "Bad Request",
        statusCode: HttpStatus.BAD_REQUEST,
        message: [
          "limit must be a positive number",
          "skip must not be less than 0",
          "poll must not be less than 0",
          "maciContractAddress must be an Ethereum address",
          "IPFS hash is invalid",
          "Public key is invalid",
        ],
      });
    });

    test("should get message batches properly", async () => {
      const result = await request(app.getHttpServer())
        .get("/v1/messageBatches/get")
        .send({
          limit: 10,
          skip: 0,
          poll: 0,
          maciContractAddress,
          publicKeys: [user!.keypair.publicKey.serialize()],
        })
        .expect(HttpStatus.OK);

      expect(result.status).toBe(HttpStatus.OK);
    });
  });
});
