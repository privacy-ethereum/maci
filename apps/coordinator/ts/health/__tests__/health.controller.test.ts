import { ESupportedChains } from "@maci-protocol/sdk";
import { zeroAddress } from "viem";

import { HealthController } from "../health.controller";
import { type HealthService } from "../health.service";

describe("HealthController", () => {
  const mockHealthService = {
    checkCoordinatorHealth: jest.fn(),
  } as unknown as HealthService;
  const healthController = new HealthController(mockHealthService);

  beforeEach(() => {
    mockHealthService.checkCoordinatorHealth = jest.fn().mockResolvedValue({
      rapidsnark: {
        rapidsnarkExecutablePath: process.env.COORDINATOR_RAPIDSNARK_EXE,
        rapidsnarkIsAccessible: true,
        rapidsnarkIsExecutable: true,
      },
      zkeysDirectory: {
        zkeysDirectoryExists: true,
        availableZkeys: [],
      },
      coordinatorWalletFunds: {
        fundsInNetworks: [
          {
            address: zeroAddress.replace("0x0", "0x1"),
            network: ESupportedChains.Mainnet,
            balance: "0",
            status: true,
          },
        ],
      },
      isRedisOpen: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("v1/health/check", () => {
    test("should return health check response", async () => {
      const { rapidsnark, zkeysDirectory, coordinatorWalletFunds, isRedisOpen } = await healthController.check();

      const { availableZkeys } = zkeysDirectory;

      const allZkeysAreSet = Object.values(availableZkeys).reduce((acc, zkey) => acc && typeof zkey === "object", true);

      expect(rapidsnark.rapidsnarkExecutablePath).toBe(process.env.COORDINATOR_RAPIDSNARK_EXE);
      expect(rapidsnark.rapidsnarkIsAccessible).toBe(true);
      expect(rapidsnark.rapidsnarkIsExecutable).toBe(true);

      expect(zkeysDirectory.zkeysDirectoryExists).toBe(true);
      expect(allZkeysAreSet).toBe(true);

      expect(coordinatorWalletFunds.fundsInNetworks[0].address).toBeDefined();
      expect(coordinatorWalletFunds.fundsInNetworks[0].address).not.toBe(zeroAddress);

      expect(isRedisOpen).toBe(true);
    });
  });
});
