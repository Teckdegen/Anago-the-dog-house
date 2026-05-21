import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Redeploying TokenLockNFT + VestingNFT with SVG NFTs...\n");
  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // Deploy TokenLockNFT
  console.log("📦 Deploying TokenLockNFT...");
  const TokenLockNFT = await ethers.getContractFactory("TokenLockNFT");
  const lock = await TokenLockNFT.deploy();
  await lock.waitForDeployment();
  const lockAddr = await lock.getAddress();
  console.log("✅ TokenLockNFT:", lockAddr);

  // Deploy VestingNFT
  console.log("📦 Deploying VestingNFT...");
  const VestingNFT = await ethers.getContractFactory("VestingNFT");
  const vesting = await VestingNFT.deploy();
  await vesting.waitForDeployment();
  const vestingAddr = await vesting.getAddress();
  console.log("✅ VestingNFT:", vestingAddr);

  // Update deployments.json
  const deploymentsPath = path.resolve(__dirname, "..", "deployments.json");
  let deployments: any = {};
  try { deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8")); } catch {}
  if (!deployments["10143"]) deployments["10143"] = {};
  deployments["10143"].TokenLockNFT = lockAddr;
  deployments["10143"].VestingNFT = vestingAddr;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🎉 ALL DEPLOYED WITH SVG NFTs!");
  console.log("TokenLockNFT:", lockAddr);
  console.log("VestingNFT:  ", vestingAddr);
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
