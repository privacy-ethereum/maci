import { jest } from "@jest/globals";
import { type Model } from "mongoose";

import { MessageBatchRepository } from "../messageBatch.repository.js";
import { type MessageBatch } from "../messageBatch.schema.js";

import { defaultMessageBatches } from "./utils.js";

describe("MessageBatchRepository", () => {
  const mockMessageBatchModel = {
    find: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockImplementation(() => Promise.resolve([defaultMessageBatches])) }),
      }),
    }),
    insertMany: jest.fn().mockImplementation(() => Promise.resolve(defaultMessageBatches)),
  };

  beforeEach(() => {
    mockMessageBatchModel.find = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockImplementation(() => Promise.resolve([defaultMessageBatches])) }),
      }),
    });
    mockMessageBatchModel.insertMany = jest.fn().mockImplementation(() => Promise.resolve(defaultMessageBatches));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should create message batch properly", async () => {
    const repository = new MessageBatchRepository(mockMessageBatchModel as unknown as Model<MessageBatch>);

    const result = await repository.create(defaultMessageBatches);

    expect(result).toStrictEqual(defaultMessageBatches);
  });

  test("should throw an error if creation is failed", async () => {
    const error = new Error("error");

    (mockMessageBatchModel.insertMany as jest.Mock).mockImplementation(() => Promise.reject(error));

    const repository = new MessageBatchRepository(mockMessageBatchModel as unknown as Model<MessageBatch>);

    await expect(repository.create(defaultMessageBatches)).rejects.toThrow(error);
  });

  test("should find message batches properly", async () => {
    const repository = new MessageBatchRepository(mockMessageBatchModel as unknown as Model<MessageBatch>);

    const result = await repository.find({});

    expect(result).toStrictEqual([defaultMessageBatches]);
  });

  test("should throw an error if find is failed", async () => {
    const error = new Error("error");

    (mockMessageBatchModel.find as jest.Mock).mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({ exec: jest.fn().mockImplementation(() => Promise.reject(error)) }),
      }),
    });

    const repository = new MessageBatchRepository(mockMessageBatchModel as unknown as Model<MessageBatch>);

    await expect(repository.find({})).rejects.toThrow(error);
  });
});
