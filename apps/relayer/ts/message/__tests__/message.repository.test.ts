import { jest } from "@jest/globals";
import { Keypair } from "@maci-protocol/domainobjs";
import { ZeroAddress } from "ethers";
import { type Model } from "mongoose";

import { MessageRepository } from "../message.repository.js";
import { type Message } from "../message.schema.js";

import { defaultSaveMessagesArgs } from "./utils.js";

describe("MessageRepository", () => {
  const defaultMessages: Message[] = [
    {
      publicKey: new Keypair().publicKey.serialize(),
      data: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      hash: "hash",
      maciContractAddress: ZeroAddress,
      poll: 0,
    },
  ];

  const mockMessageModel = {
    find: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({ exec: jest.fn().mockImplementation(() => Promise.resolve(defaultMessages)) }),
      }),
    }),
    insertMany: jest.fn().mockImplementation(() => Promise.resolve(defaultMessages)),
  };

  beforeEach(() => {
    mockMessageModel.find = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({ exec: jest.fn().mockImplementation(() => Promise.resolve(defaultMessages)) }),
      }),
    });
    mockMessageModel.insertMany = jest.fn().mockImplementation(() => Promise.resolve(defaultMessages));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should create messages properly", async () => {
    const repository = new MessageRepository(mockMessageModel as unknown as Model<Message>);

    const result = await repository.create(defaultSaveMessagesArgs);

    expect(result).toStrictEqual(defaultMessages);
  });

  test("should throw an error if creation is failed", async () => {
    const error = new Error("error");

    (mockMessageModel.insertMany as jest.Mock).mockImplementation(() => Promise.reject(error));

    const repository = new MessageRepository(mockMessageModel as unknown as Model<Message>);

    await expect(repository.create(defaultSaveMessagesArgs)).rejects.toThrow(error);
  });

  test("should find messages properly", async () => {
    const repository = new MessageRepository(mockMessageModel as unknown as Model<Message>);

    const result = await repository.find({});

    expect(result).toStrictEqual(defaultMessages);
  });

  test("should throw an error if find is failed", async () => {
    const error = new Error("error");

    (mockMessageModel.find as jest.Mock).mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({ exec: jest.fn().mockImplementation(() => Promise.reject(error)) }),
      }),
    });

    const repository = new MessageRepository(mockMessageModel as unknown as Model<Message>);

    await expect(repository.find({})).rejects.toThrow(error);
  });
});
