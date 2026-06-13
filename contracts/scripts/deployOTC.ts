import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Deploying OTCMarket...\n");
  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  const OTCMarket = await ethers.getContractFactory("OTCMarket");
  const otc = await OTCMarket.deploy();
  await otc.waitForDeployment();
  const addr = await otc.getAddress();

  console.log("✅ OTCMarket deployed:", addr);
  console.log("   Fee:", (await otc.platformFeeBps()).toString(), "bps (0.75%)");

  // Update deployments
  const deploymentsPath = path.resolve(__dirname, "..", "deployments.json");
  let deployments: any = {};
  try { deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8")); } catch {}
  if (!deployments["10143"]) deployments["10143"] = {};
  deployments["10143"].OTCMarket = addr;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("💾 Saved to deployments.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
