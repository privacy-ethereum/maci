/* eslint-disable import/no-extraneous-dependencies */
import "@matterlabs/hardhat-zksync";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";
import "hardhat-artifactor";
import "hardhat-contract-sizer";
import "solidity-docgen";

import type { HardhatUserConfig } from "hardhat/config";

// Don't forget to import new tasks here
import "./tasks/deploy";
import { EChainId, ESupportedChains, getNetworkRpcUrls } from "./tasks/helpers/constants";
import "./tasks/runner/benchmarks";
import "./tasks/runner/deployFull";
import "./tasks/runner/deployPoll";
import "./tasks/runner/encodeErrors";
import "./tasks/runner/merge";
import "./tasks/runner/prove";
import "./tasks/runner/submitOnChain";
import "./tasks/runner/verifyFull";

dotenv.config();

const DEFAULT_BLOCK_GAS_LIMIT = 30_000_000;
const DEFAULT_GAS_MULTIPLIER = 2;
const TEST_MNEMONIC = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
const NETWORKS_RPC_URL = getNetworkRpcUrls();
const GAS_PRICE: number | "auto" = process.env.GAS_PRICE ? Number(process.env.GAS_PRICE) : "auto";

const getCommonNetworkConfig = (networkName: ESupportedChains, chainId: number, mnemonic?: string) => ({
  url: NETWORKS_RPC_URL[networkName],
  blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
  gasMultiplier: DEFAULT_GAS_MULTIPLIER,
  gasPrice: GAS_PRICE,
  saveDeployments: true,
  chainId,
  accounts: process.env.PRIVATE_KEY
    ? [process.env.PRIVATE_KEY]
    : {
        mnemonic: mnemonic || process.env.MNEMONIC || TEST_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: process.env.INITIAL_INDEX ? Number(process.env.INITIAL_INDEX) : 0,
        count: 20,
      },
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "localhost",
  networks: {
    mainnet: getCommonNetworkConfig(ESupportedChains.Mainnet, EChainId.Mainnet),
    sepolia: getCommonNetworkConfig(ESupportedChains.Sepolia, EChainId.Sepolia),
    optimism: getCommonNetworkConfig(ESupportedChains.Optimism, EChainId.Optimism),
    optimism_sepolia: getCommonNetworkConfig(ESupportedChains.OptimismSepolia, EChainId.OptimismSepolia),
    scroll: getCommonNetworkConfig(ESupportedChains.Scroll, EChainId.Scroll),
    scroll_sepolia: getCommonNetworkConfig(ESupportedChains.ScrollSepolia, EChainId.ScrollSepolia),
    arbitrum: getCommonNetworkConfig(ESupportedChains.Arbitrum, EChainId.Arbitrum),
    arbitrum_sepolia: getCommonNetworkConfig(ESupportedChains.ArbitrumSepolia, EChainId.ArbitrumSepolia),
    base: getCommonNetworkConfig(ESupportedChains.Base, EChainId.Base),
    base_sepolia: getCommonNetworkConfig(ESupportedChains.BaseSepolia, EChainId.BaseSepolia),
    gnosis: getCommonNetworkConfig(ESupportedChains.Gnosis, EChainId.Gnosis),
    gnosis_chiado: getCommonNetworkConfig(ESupportedChains.GnosisChiado, EChainId.GnosisChiado),
    polygon: getCommonNetworkConfig(ESupportedChains.Polygon, EChainId.Polygon),
    polygon_amoy: getCommonNetworkConfig(ESupportedChains.PolygonAmoy, EChainId.PolygonAmoy),
    linea: getCommonNetworkConfig(ESupportedChains.Linea, EChainId.Linea),
    linea_sepolia: getCommonNetworkConfig(ESupportedChains.LineaSepolia, EChainId.LineaSepolia),
    zksync_era: getCommonNetworkConfig(ESupportedChains.ZkSyncEra, EChainId.ZkSyncEra),
    zksync_sepolia: getCommonNetworkConfig(ESupportedChains.ZkSyncSepolia, EChainId.ZkSyncSepolia),
    polygon_zkevm: getCommonNetworkConfig(ESupportedChains.PolygonZkEvm, EChainId.PolygonZkEvm),
    polygon_cardona_zkevm: getCommonNetworkConfig(ESupportedChains.PolygonCardonaZkEvm, EChainId.PolygonCardonaZkEvm),
    coverage: getCommonNetworkConfig(ESupportedChains.Coverage, EChainId.Coverage, TEST_MNEMONIC),
    localhost: {
      url: "http://localhost:8545",
      loggingEnabled: false,
    },
    hardhat: {
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gasMultiplier: DEFAULT_GAS_MULTIPLIER,
      gasPrice: "auto",
      chainId: EChainId.Hardhat,
      zksync: Boolean(process.env.ZK_SYNC),
      accounts: {
        mnemonic: TEST_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 1025,
      },
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      loggingEnabled: process.env.HARDHAT_LOGGING === "true",
      allowUnlimitedContractSize: true,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      mining: {
        auto: true,
        interval: 100,
      },
      forking: process.env.FORKING_URL
        ? {
            url: process.env.FORKING_URL,
            blockNumber: process.env.FORKING_BLOCK_NUMBER ? parseInt(process.env.FORKING_BLOCK_NUMBER, 10) : 0,
          }
        : undefined,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  etherscan: {
    apiKey: process.env.ETH_ETHERSCAN_API_KEY,
    customChains: [
      {
        network: ESupportedChains.Sepolia,
        chainId: EChainId.Sepolia,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Sepolia}`,
          browserURL: "https://sepolia.etherscan.io",
        },
      },
      {
        network: ESupportedChains.Optimism,
        chainId: EChainId.Optimism,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Optimism}`,
          browserURL: "https://optimistic.etherscan.io",
        },
      },
      {
        network: ESupportedChains.OptimismSepolia,
        chainId: EChainId.OptimismSepolia,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.OptimismSepolia}`,
          browserURL: "https://sepolia-optimistic.etherscan.io",
        },
      },
      {
        network: ESupportedChains.Scroll,
        chainId: EChainId.Scroll,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Scroll}`,
          browserURL: "https://scrollscan.com/",
        },
      },
      {
        network: ESupportedChains.ScrollSepolia,
        chainId: EChainId.ScrollSepolia,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.ScrollSepolia}`,
          browserURL: "https://sepolia.scrollscan.com/",
        },
      },
      {
        network: ESupportedChains.Arbitrum,
        chainId: EChainId.Arbitrum,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Arbitrum}`,
          browserURL: "https://arbiscan.io/",
        },
      },
      {
        network: ESupportedChains.ArbitrumSepolia,
        chainId: EChainId.ArbitrumSepolia,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.ArbitrumSepolia}`,
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: ESupportedChains.Base,
        chainId: EChainId.Base,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Base}`,
          browserURL: "https://basescan.org/",
        },
      },
      {
        network: ESupportedChains.BaseSepolia,
        chainId: EChainId.BaseSepolia,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.BaseSepolia}`,
          browserURL: "https://sepolia.basescan.org/",
        },
      },
      {
        network: ESupportedChains.Gnosis,
        chainId: EChainId.Gnosis,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Gnosis}`,
          browserURL: "https://gnosisscan.io/",
        },
      },
      {
        network: ESupportedChains.GnosisChiado,
        chainId: EChainId.GnosisChiado,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.GnosisChiado}`,
          browserURL: "https://gnosis-chiado.blockscout.com/",
        },
      },
      {
        network: ESupportedChains.Polygon,
        chainId: EChainId.Polygon,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Polygon}`,
          browserURL: "https://polygonscan.com/",
        },
      },
      {
        network: ESupportedChains.PolygonAmoy,
        chainId: EChainId.PolygonAmoy,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.PolygonAmoy}`,
          browserURL: "https://amoy.polygonscan.com/",
        },
      },
      {
        network: ESupportedChains.Linea,
        chainId: EChainId.Linea,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.Linea}`,
          browserURL: "https://lineascan.build/",
        },
      },
      {
        network: ESupportedChains.LineaSepolia,
        chainId: EChainId.LineaSepolia,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.LineaSepolia}`,
          browserURL: "https://sepolia.lineascan.build/",
        },
      },
      {
        network: ESupportedChains.ZkSyncEra,
        chainId: EChainId.ZkSyncEra,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.ZkSyncEra}`,
          browserURL: "https://explorer.zksync.io",
        },
      },
      {
        network: ESupportedChains.ZkSyncSepolia,
        chainId: EChainId.ZkSyncSepolia,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.ZkSyncSepolia}`,
          browserURL: "https://sepolia.explorer.zksync.io",
        },
      },
      {
        network: ESupportedChains.PolygonZkEvm,
        chainId: EChainId.PolygonZkEvm,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.PolygonZkEvm}`,
          browserURL: "https://zkevm.polygonscan.com/",
        },
      },
      {
        network: ESupportedChains.PolygonCardonaZkEvm,
        chainId: EChainId.PolygonCardonaZkEvm,
        urls: {
          apiURL: `https://api.etherscan.io/v2/api?chainid=${EChainId.PolygonCardonaZkEvm}`,
          browserURL: "https://docs.polygonscan.com/cardona-polygon-zkevm",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
  paths: {
    tests: "./tests",
    artifacts: "./artifacts",
  },
  docgen: {
    outputDir: "./docs",
    pages: "files",
  },
  gasReporter: {
    currency: "USD",
    gasPrice: process.env.GAS_REPORTER_PRICE ? Number(process.env.GAS_REPORTER_PRICE) : undefined,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    enabled: true,
  },
};

export default config;
