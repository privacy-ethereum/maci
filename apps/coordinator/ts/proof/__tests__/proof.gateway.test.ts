import { type ITallyData, type IGenerateProofsOptions, EMode, ESupportedChains } from "@maci-protocol/sdk";
import { Test } from "@nestjs/testing";
import { type Server } from "socket.io";

import type { IGenerateArgs, IGenerateData } from "../types";

import { ProofGateway } from "../proof.gateway";
import { ProofGeneratorService } from "../proof.service";
import { EProofGenerationEvents } from "../types";

describe("ProofGateway", () => {
  let gateway: ProofGateway;

  const defaultProofGeneratorArgs: IGenerateArgs = {
    poll: 0,
    maciContractAddress: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    mode: EMode.NON_QV,
    sessionKeyAddress: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    approval: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    chain: ESupportedChains.Localhost,
  };

  const defaultProofGeneratorData: IGenerateData = {
    tallyProofs: [],
    processProofs: [],
    tallyData: {} as ITallyData,
  };

  const mockGeneratorService = {
    generate: jest.fn(),
  };

  const mockEmit = jest.fn();

  beforeEach(async () => {
    const testModule = await Test.createTestingModule({ providers: [ProofGateway] })
      .useMocker((token) => {
        if (token === ProofGeneratorService) {
          mockGeneratorService.generate.mockImplementation((_, options?: IGenerateProofsOptions) => {
            options?.onBatchComplete?.({ current: 1, total: 2, proofs: defaultProofGeneratorData.processProofs });
            options?.onComplete?.(
              defaultProofGeneratorData.processProofs.concat(defaultProofGeneratorData.tallyProofs),
              defaultProofGeneratorData.tallyData,
            );
            options?.onFail?.(new Error("error"));
          });

          return mockGeneratorService;
        }

        return jest.fn();
      })
      .compile();

    gateway = testModule.get<ProofGateway>(ProofGateway);

    gateway.server = { emit: mockEmit } as unknown as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should be defined", () => {
    expect(gateway).toBeDefined();
  });

  test("should start proof generation properly", async () => {
    await gateway.generate(defaultProofGeneratorArgs);

    expect(mockEmit).toHaveBeenCalledTimes(3);
    expect(mockEmit).toHaveBeenNthCalledWith(1, EProofGenerationEvents.PROGRESS, {
      current: 1,
      total: 2,
      proofs: defaultProofGeneratorData.processProofs,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(2, EProofGenerationEvents.FINISH, {
      proofs: defaultProofGeneratorData.processProofs.concat(defaultProofGeneratorData.tallyProofs),
      tallyData: defaultProofGeneratorData.tallyData,
    });
    expect(mockEmit).toHaveBeenNthCalledWith(3, EProofGenerationEvents.ERROR, { message: "error" });
  });
});
