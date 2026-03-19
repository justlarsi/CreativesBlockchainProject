import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "solidity-coverage";
import type { HardhatUserConfig } from "hardhat/config";

const privateKey = process.env.PRIVATE_KEY?.trim() || "";
const amoyAccounts = /^(0x)?[a-fA-F0-9]{64}$/.test(privateKey) ? [privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    amoy: {
      url:
        process.env.POLYGON_AMOY_RPC_URL ||
        process.env.POLYGON_MUMBAI_RPC_URL ||
        "http://127.0.0.1:8545",
      accounts: amoyAccounts,
      chainId: 80002,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
  mocha: {
    timeout: 20_000,
  },
  // Explicitly keep a coverage config section in Hardhat config for Step 6.
  solidityCoverage: {
    measureStatementCoverage: true,
    measureFunctionCoverage: true,
    measureBranchCoverage: true,
    measureLineCoverage: true,
  },
};

export default config;

