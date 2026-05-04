import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying VestingNFT...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // Deploy VestingNFT
  const VestingNFT = await ethers.getContractFactory("VestingNFT");
  const vestingNFT = await VestingNFT.deploy();
  await vestingNFT.waitForDeployment();

  const vestingAddress = await vestingNFT.getAddress();
  console.log("✅ VestingNFT deployed to:", vestingAddress);
  console.log("   Name:", await vestingNFT.name());
  console.log("   Symbol:", await vestingNFT.symbol());
  console.log("   Owner:", await vestingNFT.owner());

  console.log("\n📝 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract: VestingNFT");
  console.log("Address:", vestingAddress);
  console.log("Network: Monad Testnet");
  console.log("Explorer:", `https://testnet.monadexplorer.com/address/${vestingAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Save deployment info
  const fs = require("fs");
  const deployments = JSON.parse(fs.readFileSync("./deployments.json", "utf8"));
  deployments["10143"] = deployments["10143"] || {};
  deployments["10143"].VestingNFT = vestingAddress;
  fs.writeFileSync("./deployments.json", JSON.stringify(deployments, null, 2));
  console.log("💾 Deployment address saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
