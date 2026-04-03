import "@nomicfoundation/hardhat-toolbox";

import type { HardhatUserConfig } from "hardhat/types";

const WALLET_MNEMONIC = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
const GAS_LIMIT = 30_000_000;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      gas: GAS_LIMIT,
      blockGasLimit: GAS_LIMIT,
      accounts: { count: 101, mnemonic: WALLET_MNEMONIC },
      mining: {
        auto: true,
        interval: 100,
      },
    },
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
        },
      },
    },
  },
  paths: {
    sources: "./node_modules/@maci-protocol/sdk/node_modules/@maci-protocol/contracts/contracts",
    artifacts: "./node_modules/@maci-protocol/sdk/node_modules/@maci-protocol/contracts/artifacts",
  },
};

export default config;
