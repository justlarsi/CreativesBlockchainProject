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

function parseContractsToDeploy() {
  const raw = (process.env.CONTRACTS_TO_DEPLOY || "").trim();
  if (!raw) {
    return CONTRACTS;
  }

  const requested = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const invalid = requested.filter((name) => !CONTRACTS.includes(name));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid contract names in CONTRACTS_TO_DEPLOY: ${invalid.join(", ")}. Allowed values: ${CONTRACTS.join(", ")}`,
    );
  }
  return requested;
}

async function loadExistingAddresses() {
  try {
    const raw = await fs.readFile(SHARED_ADDRESSES_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      chainId: 80002,
      network: "amoy",
      deployedAt: parsed.deployedAt || null,
      contracts: {
        IPRegistry: parsed.contracts?.IPRegistry || "",
        LicenseAgreement: parsed.contracts?.LicenseAgreement || "",
        CollaborativeWork: parsed.contracts?.CollaborativeWork || "",
      },
    };
  } catch {
    return {
      chainId: 80002,
      network: "amoy",
      deployedAt: null,
      contracts: {
        IPRegistry: "",
        LicenseAgreement: "",
        CollaborativeWork: "",
      },
    };
  }
}

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

  const addresses = await loadExistingAddresses();
  const targetContracts = parseContractsToDeploy();
  let deployedAny = false;

  for (const contractName of targetContracts) {
    if (addresses.contracts[contractName]) {
      console.log(`${contractName} already deployed at ${addresses.contracts[contractName]} (skipping)`);
      continue;
    }

    const factory = await ethers.getContractFactory(contractName);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    addresses.contracts[contractName] = address;
    deployedAny = true;
    console.log(`${contractName} deployed at ${address}`);
  }

  if (deployedAny) {
    addresses.deployedAt = new Date().toISOString();
  }

  await fs.mkdir(path.dirname(SHARED_ADDRESSES_PATH), { recursive: true });
  await fs.writeFile(SHARED_ADDRESSES_PATH, JSON.stringify(addresses, null, 2) + "\n", "utf-8");

  console.log(`Wrote deployment addresses to ${SHARED_ADDRESSES_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

