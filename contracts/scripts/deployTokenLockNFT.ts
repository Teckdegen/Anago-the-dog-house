import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying TokenLockNFT...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // Deploy TokenLockNFT
  const TokenLockNFT = await ethers.getContractFactory("TokenLockNFT");
  const lockNFT = await TokenLockNFT.deploy();
  await lockNFT.waitForDeployment();

  const lockAddress = await lockNFT.getAddress();
  console.log("✅ TokenLockNFT deployed to:", lockAddress);
  console.log("   Name:", await lockNFT.name());
  console.log("   Symbol:", await lockNFT.symbol());
  console.log("   Owner:", await lockNFT.owner());

  console.log("\n📝 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract: TokenLockNFT");
  console.log("Address:", lockAddress);
  console.log("Network: Monad Testnet");
  console.log("Explorer:", `https://testnet.monadexplorer.com/address/${lockAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎯 Next Steps:");
  console.log("1. Verify contract on explorer");
  console.log("2. Update frontend with new address");
  console.log("3. Test creating a lock");
  console.log("4. Test transferring lock NFT");
  console.log("5. Test withdrawing locked tokens\n");

  // Save deployment info
  const fs = require("fs");
  const deployments = JSON.parse(fs.readFileSync("./deployments.json", "utf8"));
  deployments["10143"] = deployments["10143"] || {};
  deployments["10143"].TokenLockNFT = lockAddress;
  fs.writeFileSync("./deployments.json", JSON.stringify(deployments, null, 2));
  console.log("💾 Deployment address saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
