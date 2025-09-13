import { jest } from "@jest/globals";
import { Keypair } from "@maci-protocol/domainobjs";
import { MACI__factory as MACIFactory, Poll__factory as PollFactory } from "@maci-protocol/sdk";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import dotenv from "dotenv";
import { ZeroAddress } from "ethers";

import { MessageGuard, PUBLIC_METADATA_KEY, Public } from "../message.guard.js";

dotenv.config();

jest.mock("@maci-protocol/contracts/typechain-types", (): unknown => ({
  MACI__factory: {
    connect: jest.fn(),
  },
  Poll__factory: {
    connect: jest.fn(),
  },
}));

describe("MessageGuard", () => {
  const mockRequest = {
    body: {
      stateLeafIndex: 0,
      proof: ["0", "0", "0", "0", "0", "0", "0", "0"],
      poll: 0,
      maciContractAddress: ZeroAddress,
      messages: [
        {
          data: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
          publicKey: new Keypair().publicKey.serialize(),
        },
      ],
    },
  };

  const mockContext = {
    getHandler: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(() => mockRequest),
    }),
  } as unknown as ExecutionContext;

  const reflector = {
    get: jest.fn(),
  } as Reflector & { get: jest.Mock };

  const mockMaciContract = {
    polls: jest.fn().mockImplementation(() => Promise.resolve({ poll: ZeroAddress })),
  };

  const mockPollContract = {
    verifyJoinedPollProof: jest.fn().mockImplementation(() => Promise.resolve(true)),
  };

  beforeEach(() => {
    reflector.get.mockReturnValue(false);

    mockMaciContract.polls = jest.fn().mockImplementation(() => Promise.resolve({ poll: ZeroAddress }));
    mockPollContract.verifyJoinedPollProof = jest.fn().mockImplementation(() => Promise.resolve(true));

    MACIFactory.connect = jest.fn().mockImplementation(() => mockMaciContract) as typeof MACIFactory.connect;
    PollFactory.connect = jest.fn().mockImplementation(() => mockPollContract) as typeof PollFactory.connect;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should create public decorator properly", () => {
    const decorator = Public();

    expect(decorator.KEY).toBe(PUBLIC_METADATA_KEY);
  });

  test("should throw an error if there is empty body", async () => {
    const ctx = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(() => ({
          body: {},
        })),
      }),
    } as unknown as ExecutionContext;

    const guard = new MessageGuard(reflector);

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });

  test("should return false if proof is invalid", async () => {
    mockPollContract.verifyJoinedPollProof = jest.fn().mockImplementation(() => Promise.resolve(false));

    const guard = new MessageGuard(reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  test("should return false if validation is failed", async () => {
    const error = new Error("error");
    mockPollContract.verifyJoinedPollProof = jest.fn().mockImplementation(() => Promise.reject(error));

    const guard = new MessageGuard(reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  test("should return true if proof is valid", async () => {
    const guard = new MessageGuard(reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  test("should return true if can skip authorization", async () => {
    reflector.get.mockReturnValue(true);
    const guard = new MessageGuard(reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
  });
});
