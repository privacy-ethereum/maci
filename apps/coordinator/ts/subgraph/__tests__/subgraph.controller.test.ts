import { ESupportedChains } from "@maci-protocol/sdk";
import { HttpException, HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import type { IDeploySubgraphArgs, IDeploySubgraphReturn } from "../types";

import { SubgraphController } from "../subgraph.controller";
import { SubgraphService } from "../subgraph.service";

describe("SubgraphController", () => {
  let subgraphController: SubgraphController;

  const defaultSubgraphDeployArgs: IDeploySubgraphArgs = {
    maciContractAddress: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    startBlock: 0,
    network: ESupportedChains.OptimismSepolia,
    name: "subgraph",
    tag: "v0.0.1",
  };

  const defaultSubgraphDeployData: IDeploySubgraphReturn = {
    url: "url",
  };

  const mockSubgraphService = {
    deploy: jest.fn(),
  };

  beforeEach(async () => {
    const app = await Test.createTestingModule({
      controllers: [SubgraphController],
    })
      .useMocker((token) => {
        if (token === SubgraphService) {
          mockSubgraphService.deploy.mockResolvedValue(defaultSubgraphDeployData);

          return mockSubgraphService;
        }

        return jest.fn();
      })
      .compile();

    subgraphController = app.get<SubgraphController>(SubgraphController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("v1/subgraph/deploy", () => {
    test("should return deployed subgraph url properly", async () => {
      const data = await subgraphController.deploy(defaultSubgraphDeployArgs);
      expect(data).toStrictEqual(defaultSubgraphDeployData);
    });

    test("should throw an error if proof generation is failed", async () => {
      const error = new Error("error");
      mockSubgraphService.deploy.mockRejectedValue(error);

      await expect(subgraphController.deploy(defaultSubgraphDeployArgs)).rejects.toThrow(
        new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });
});
