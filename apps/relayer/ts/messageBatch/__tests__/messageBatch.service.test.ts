import { jest } from "@jest/globals";

import { type IpfsService } from "../../ipfs/ipfs.service.js";
import { MessageBatchDto } from "../messageBatch.dto.js";
import { type MessageBatchRepository } from "../messageBatch.repository.js";
import { MessageBatchService } from "../messageBatch.service.js";

import { defaultIpfsHash, defaultMessageBatches } from "./utils.js";

jest.mock("@maci-protocol/sdk", (): unknown => ({
  getDefaultSigner: jest.fn(),
  relayMessages: jest.fn(),
}));

describe("MessageBatchService", () => {
  const mockIpfsService = {
    init: jest.fn(),
    cidToBytes32: jest.fn().mockImplementation(() => Promise.resolve(defaultIpfsHash)),
    add: jest.fn().mockImplementation(() => Promise.resolve(defaultIpfsHash)),
  };

  const mockRepository = {
    create: jest.fn().mockImplementation(() => Promise.resolve(defaultMessageBatches)),
    find: jest.fn().mockImplementation(() => Promise.resolve(defaultMessageBatches)),
  };

  beforeEach(() => {
    mockRepository.create = jest.fn().mockImplementation(() => Promise.resolve(defaultMessageBatches));
    mockRepository.find = jest.fn().mockImplementation(() => Promise.resolve(defaultMessageBatches));
    mockIpfsService.add = jest.fn().mockImplementation(() => Promise.resolve(defaultIpfsHash));
    mockIpfsService.cidToBytes32 = jest.fn().mockImplementation(() => Promise.resolve(defaultIpfsHash));
    mockIpfsService.init = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should save and find message batches properly", async () => {
    const service = new MessageBatchService(
      mockIpfsService as unknown as IpfsService,
      mockRepository as unknown as MessageBatchRepository,
    );

    const result = await service.saveMessageBatches(defaultMessageBatches);
    const messageBatches = await service.findMessageBatches({});

    expect(result).toStrictEqual(defaultMessageBatches);
    expect(messageBatches).toStrictEqual(defaultMessageBatches);
  });

  test("should throw an error if can't find message batches", async () => {
    const error = new Error("error");

    (mockRepository.find as jest.Mock).mockImplementation(() => Promise.reject(error));

    const service = new MessageBatchService(
      mockIpfsService as unknown as IpfsService,
      mockRepository as unknown as MessageBatchRepository,
    );

    await expect(service.findMessageBatches({})).rejects.toThrow(error);
  });

  test("should throw an error if can't save message batches", async () => {
    const error = new Error("error");

    (mockRepository.create as jest.Mock).mockImplementation(() => Promise.reject(error));

    const service = new MessageBatchService(
      mockIpfsService as unknown as IpfsService,
      mockRepository as unknown as MessageBatchRepository,
    );

    await expect(service.saveMessageBatches(defaultMessageBatches)).rejects.toThrow(error);
  });

  test("should throw an error if can't update message batches to ipfs", async () => {
    const error = new Error("error");

    (mockIpfsService.add as jest.Mock).mockImplementation(() => Promise.reject(error));

    const service = new MessageBatchService(
      mockIpfsService as unknown as IpfsService,
      mockRepository as unknown as MessageBatchRepository,
    );

    await expect(service.saveMessageBatches(defaultMessageBatches)).rejects.toThrow(error);
  });

  test("should throw an error if validation is failed", async () => {
    const service = new MessageBatchService(
      mockIpfsService as unknown as IpfsService,
      mockRepository as unknown as MessageBatchRepository,
    );

    const invalidEmptyMessagesArgs = new MessageBatchDto();
    invalidEmptyMessagesArgs.messages = [];
    invalidEmptyMessagesArgs.ipfsHash = "invalid";

    const invalidMessageArgs = new MessageBatchDto();
    invalidMessageArgs.messages = [];
    invalidMessageArgs.ipfsHash = "invalid";

    await expect(service.saveMessageBatches([invalidEmptyMessagesArgs])).rejects.toThrow("Validation error");
    await expect(service.saveMessageBatches([invalidMessageArgs])).rejects.toThrow("Validation error");
  });
});
