import { type Reflector } from "@nestjs/core";
import dotenv from "dotenv";
import { getBytes, hashMessage } from "ethers";
import hardhat from "hardhat";

import type { ExecutionContext } from "@nestjs/common";

import { type CryptoService } from "../../crypto/crypto.service";
import { AccountSignatureGuard, PUBLIC_METADATA_KEY, Public } from "../AccountSignatureGuard.service";

dotenv.config();

jest.mock("../../crypto/crypto.service", (): unknown => ({
  CryptoService: {
    getInstance: jest.fn(),
  },
}));

describe("AccountSignatureGuard", () => {
  const mockRequest = {
    headers: { authorization: "data" },
  };

  const mockContext = {
    getHandler: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(() => mockRequest),
    }),
    switchToWs: jest.fn().mockReturnValue({
      getClient: jest.fn(() => ({ handshake: mockRequest })),
    }),
  } as unknown as ExecutionContext;

  const mockSignature =
    "0xc0436b6fbd5ff883fe88367f081d0780706b5c29fbfde8db2c1d607510f9095a73b3bc9b94a1588d561eaf49d195b134e3f92c36449c017ecf92c5e4d84a32131c";
  const mockDigest = "7f6c0e5c497ded52462ec18daeb1c94cefa11cd6949ebdb7074b2a32cac13fba";

  const mockCryptoService = {
    decrypt: jest.fn(),
  } as unknown as CryptoService;

  const reflector = {
    get: jest.fn(),
  } as Reflector & { get: jest.Mock };

  beforeEach(() => {
    mockCryptoService.decrypt = jest.fn(() => `${mockSignature}:${mockDigest}`);
    reflector.get.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should create public decorator properly", () => {
    const decorator = Public();

    expect(decorator.KEY).toBe(PUBLIC_METADATA_KEY);
  });

  test("should return false if there is no Authorization header", async () => {
    const ctx = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(() => ({
          headers: { authorization: "" },
        })),
      }),
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn(() => ({ handshake: { headers: { authorization: "" } } })),
      }),
    } as unknown as ExecutionContext;

    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  test("should return false if there is no signature", async () => {
    (mockCryptoService.decrypt as jest.Mock).mockReturnValue(`:${mockDigest}`);

    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  test("should return false if there is no digest", async () => {
    (mockCryptoService.decrypt as jest.Mock).mockReturnValue(mockSignature);

    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  test("should return false if signature or digest are invalid", async () => {
    (mockCryptoService.decrypt as jest.Mock).mockReturnValue(`signature:digest`);

    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  test("should return false if signer is different", async () => {
    const [, signer] = await hardhat.ethers.getSigners();
    const signature = await signer.signMessage("message");
    const digest = Buffer.from(getBytes(hashMessage("message"))).toString("hex");

    (mockCryptoService.decrypt as jest.Mock).mockReturnValue(`${signature}:${digest}`);

    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  test("should return true if authorization is passed properly", async () => {
    const [signer] = await hardhat.ethers.getSigners();
    process.env.COORDINATOR_ADDRESSES = await signer.getAddress();
    const signature = await signer.signMessage("message");
    const digest = Buffer.from(getBytes(hashMessage("message"))).toString("hex");

    (mockCryptoService.decrypt as jest.Mock).mockReturnValue(`${signature}:${digest}`);

    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  test("should return false if there is no COORDINATOR_ADDRESSES env", async () => {
    const [signer] = await hardhat.ethers.getSigners();
    process.env.COORDINATOR_ADDRESSES = undefined;
    const signature = await signer.signMessage("message");
    const digest = Buffer.from(getBytes(hashMessage("message"))).toString("hex");

    (mockCryptoService.decrypt as jest.Mock).mockReturnValue(`${signature}:${digest}`);

    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  test("should return true if can skip authorization", async () => {
    reflector.get.mockReturnValue(true);
    const guard = new AccountSignatureGuard(mockCryptoService, reflector);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
  });
});
