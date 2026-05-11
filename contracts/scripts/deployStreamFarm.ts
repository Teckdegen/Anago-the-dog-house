import { ethers } from "hardhat";
import path from "path";
import fs from "fs";

async function main() {
  console.log("🚀 Deploying StreamFarm...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  const StreamFarm = await ethers.getContractFactory("StreamFarm");
  const farm = await StreamFarm.deploy();
  await farm.waitForDeployment();
  const farmAddress = await farm.getAddress();

  console.log("✅ StreamFarm deployed:", farmAddress);
  console.log("   Name:", await farm.name());
  console.log("   Symbol:", await farm.symbol());
  console.log("   Owner:", await farm.owner());
  console.log();

  // Update deployments.json
  const deploymentsPath = path.resolve(__dirname, "..", "deployments.json");
  let deployments: any = {};
  try {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  } catch {}

  if (!deployments["10143"]) deployments["10143"] = {};
  deployments["10143"].StreamFarm = farmAddress;

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🎉 STREAM FARM DEPLOYED!");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log("StreamFarm:", farmAddress);
  console.log("Explorer:", `https://testnet.monadexplorer.com/address/${farmAddress}`);
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
