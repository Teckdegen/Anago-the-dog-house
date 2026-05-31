/**
 * Redeploy StreamFarm only on Monad mainnet — keeps other suite addresses unchanged.
 *
 *   cd contracts && npm run deploy:stream-farm
 */
import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

const CHAIN_ID = 143;

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  console.log("Deployer:", deployer.address);
  console.log("Network: ", network.name, `(chainId ${chainId})`);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "MON\n",
  );

  if (chainId !== CHAIN_ID) {
    throw new Error(`Expected chainId ${CHAIN_ID}, got ${chainId}. Use --network monad`);
  }

  const StreamFarm = await ethers.getContractFactory("StreamFarm");
  const farm = await StreamFarm.deploy();
  await farm.waitForDeployment();
  const streamFarm = await farm.getAddress();

  console.log("StreamFarm deployed:", streamFarm);
  console.log("Owner:", await farm.owner());
  console.log("Explorer: https://monadscan.com/address/" + streamFarm);

  const deploymentsPath = path.resolve(__dirname, "..", "deployments.json");
  let deployments: Record<string, Record<string, string>> = {};
  try {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  } catch {
    /* new file */
  }

  const prev = deployments[String(CHAIN_ID)] ?? {};
  deployments[String(CHAIN_ID)] = {
    ...prev,
    StreamFarm: streamFarm,
    streamFarmDeployedAt: new Date().toISOString(),
    network: "monad",
  };
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Updated", deploymentsPath);

  const generatedPath = path.resolve(__dirname, "../../src/lib/web3/deployments.generated.ts");
  let generated = fs.readFileSync(generatedPath, "utf8");
  generated = generated.replace(
    /streamFarm: "0x[a-fA-F0-9]{40}"/,
    `streamFarm: "${streamFarm}"`,
  );
  fs.writeFileSync(generatedPath, generated);
  console.log("Updated", generatedPath);
  console.log("\nNo .env change needed — main app reads deployments.generated.ts via contracts.ts");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
