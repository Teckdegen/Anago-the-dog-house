import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying YieldFarmNFT...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // Deploy YieldFarmNFT
  const YieldFarmNFT = await ethers.getContractFactory("YieldFarmNFT");
  const farmNFT = await YieldFarmNFT.deploy();
  await farmNFT.waitForDeployment();

  const farmAddress = await farmNFT.getAddress();
  console.log("✅ YieldFarmNFT deployed to:", farmAddress);
  console.log("   Name:", await farmNFT.name());
  console.log("   Symbol:", await farmNFT.symbol());
  console.log("   Owner:", await farmNFT.owner());

  console.log("\n📝 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract: YieldFarmNFT");
  console.log("Address:", farmAddress);
  console.log("Network: Monad Testnet");
  console.log("Explorer:", `https://testnet.monadexplorer.com/address/${farmAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎯 Next Steps:");
  console.log("1. Add pools: farmNFT.addPool(stakeTokenAddress)");
  console.log("2. Add rewards: farmNFT.addReward(poolId, rewardToken, rate, duration, supply)");
  console.log("3. Users can stake and get NFTs!");
  console.log("4. NFTs are transferable - positions can be traded!\n");

  // Save deployment info
  const fs = require("fs");
  const deployments = JSON.parse(fs.readFileSync("./deployments.json", "utf8"));
  deployments["10143"] = deployments["10143"] || {};
  deployments["10143"].YieldFarmNFT = farmAddress;
  fs.writeFileSync("./deployments.json", JSON.stringify(deployments, null, 2));
  console.log("💾 Deployment address saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
