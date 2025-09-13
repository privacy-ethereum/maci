import { ESupportedChains } from "@maci-protocol/sdk";
import { Test } from "@nestjs/testing";
import { type Server } from "socket.io";

import { SubgraphGateway } from "../subgraph.gateway";
import { SubgraphService } from "../subgraph.service";
import {
  EProgressStep,
  ESubgraphEvents,
  TOTAL_STEPS,
  type IDeploySubgraphArgs,
  type IDeploySubgraphReturn,
  type ISubgraphWsHooks,
} from "../types";

describe("SubgraphGateway", () => {
  let gateway: SubgraphGateway;

  const defaultSubgraphDeployArgs: IDeploySubgraphArgs = {
    maciContractAddress: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    startBlock: 0,
    network: ESupportedChains.OptimismSepolia,
    name: "subgraph",
    tag: "v0.0.1",
  };

  const defaultSubgraphDeployData: IDeploySubgraphReturn = {
    url: "https://localhost:3000",
  };

  const mockSubgraphService = {
    deploy: jest.fn(),
  };

  const mockEmit = jest.fn();

  beforeEach(async () => {
    const testModule = await Test.createTestingModule({ providers: [SubgraphGateway] })
      .useMocker((token) => {
        if (token === SubgraphService) {
          mockSubgraphService.deploy.mockImplementation((_, options?: ISubgraphWsHooks) => {
            options?.onProgress({ current: EProgressStep.SCHEMA, total: TOTAL_STEPS });
            options?.onProgress({ current: EProgressStep.NETWORK, total: TOTAL_STEPS });
            options?.onProgress({ current: EProgressStep.TEMPLATE, total: TOTAL_STEPS });
            options?.onProgress({ current: EProgressStep.CODEGEN, total: TOTAL_STEPS });
            options?.onProgress({ current: EProgressStep.BUILD, total: TOTAL_STEPS });
            options?.onProgress({ current: EProgressStep.DEPLOY, total: TOTAL_STEPS });

            options?.onSuccess(defaultSubgraphDeployData.url);
            options?.onFail(new Error("error"));
          });

          return mockSubgraphService;
        }

        return jest.fn();
      })
      .compile();

    gateway = testModule.get<SubgraphGateway>(SubgraphGateway);

    gateway.server = { emit: mockEmit } as unknown as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should be defined", () => {
    expect(gateway).toBeDefined();
  });

  test("should start subgraph deployment properly", async () => {
    await gateway.deploy(defaultSubgraphDeployArgs);

    expect(mockEmit).toHaveBeenCalledTimes(8);
    expect(mockEmit).toHaveBeenNthCalledWith(1, ESubgraphEvents.PROGRESS, {
      current: EProgressStep.SCHEMA,
      total: TOTAL_STEPS,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(2, ESubgraphEvents.PROGRESS, {
      current: EProgressStep.NETWORK,
      total: TOTAL_STEPS,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(3, ESubgraphEvents.PROGRESS, {
      current: EProgressStep.TEMPLATE,
      total: TOTAL_STEPS,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(4, ESubgraphEvents.PROGRESS, {
      current: EProgressStep.CODEGEN,
      total: TOTAL_STEPS,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(5, ESubgraphEvents.PROGRESS, {
      current: EProgressStep.BUILD,
      total: TOTAL_STEPS,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(6, ESubgraphEvents.PROGRESS, {
      current: EProgressStep.DEPLOY,
      total: TOTAL_STEPS,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(7, ESubgraphEvents.FINISH, {
      url: defaultSubgraphDeployData.url,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(8, ESubgraphEvents.ERROR, { message: "error" });
  });
});
