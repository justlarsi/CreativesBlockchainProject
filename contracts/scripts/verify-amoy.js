const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");

const ADDRESSES_PATH = path.resolve(
  process.cwd(),
  "..",
  "packages",
  "contract-artifacts",
  "addresses",
  "amoy.json",
);

async function main() {
  const { network, run } = hre;

  if (network.name !== "amoy") {
    throw new Error(`Use --network amoy for verification. Received: ${network.name}`);
  }

  const payload = JSON.parse(await fs.readFile(ADDRESSES_PATH, "utf-8"));
  if (payload.chainId !== 80002) {
    throw new Error(`Expected chainId 80002 in ${ADDRESSES_PATH}, received ${payload.chainId}`);
  }

  const contracts = payload.contracts || {};

  for (const [name, address] of Object.entries(contracts)) {
    if (!address) {
      throw new Error(`Missing deployed address for ${name} in ${ADDRESSES_PATH}`);
    }

    console.log(`Verifying ${name} at ${address} on Polygon Amoy...`);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [],
      });
    } catch (error) {
      const message = error?.message || String(error);
      if (message.toLowerCase().includes("already verified")) {
        console.log(`${name} is already verified, continuing.`);
        continue;
      }
      throw error;
    }
  }

  console.log("Polygonscan verification completed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

