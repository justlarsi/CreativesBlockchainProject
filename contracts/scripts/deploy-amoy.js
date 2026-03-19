const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");

const CONTRACTS = ["IPRegistry", "LicenseAgreement", "CollaborativeWork"];
const SHARED_ADDRESSES_PATH = path.resolve(
  process.cwd(),
  "..",
  "packages",
  "contract-artifacts",
  "addresses",
  "amoy.json",
);

async function main() {
  const { ethers, network } = hre;

  if (network.name !== "amoy") {
    throw new Error(`Use --network amoy for deployment. Received: ${network.name}`);
  }

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      "No deployer account configured. Set PRIVATE_KEY to a valid 0x-prefixed 32-byte key in your contracts env before running deploy:amoy.",
    );
  }

  const addresses = {
    chainId: 80002,
    network: "amoy",
    deployedAt: new Date().toISOString(),
    contracts: {},
  };

  for (const contractName of CONTRACTS) {
    const factory = await ethers.getContractFactory(contractName);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    addresses.contracts[contractName] = address;
    console.log(`${contractName} deployed at ${address}`);
  }

  await fs.mkdir(path.dirname(SHARED_ADDRESSES_PATH), { recursive: true });
  await fs.writeFile(SHARED_ADDRESSES_PATH, JSON.stringify(addresses, null, 2) + "\n", "utf-8");

  console.log(`Wrote deployment addresses to ${SHARED_ADDRESSES_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

