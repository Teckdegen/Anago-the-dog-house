import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying ALL NFT Contracts...\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  const deployments: Record<string, string> = {};

  // ═══════════════════════════════════════════════════════════════════════
  //                          1. TOKEN LOCK NFT
  // ═══════════════════════════════════════════════════════════════════════

  console.log("📦 [1/3] Deploying TokenLockNFT...");
  const TokenLockNFT = await ethers.getContractFactory("TokenLockNFT");
  const lockNFT = await TokenLockNFT.deploy();
  await lockNFT.waitForDeployment();
  const lockAddress = await lockNFT.getAddress();
  deployments.TokenLockNFT = lockAddress;
  console.log("✅ TokenLockNFT deployed:", lockAddress);
  console.log("   Name:", await lockNFT.name());
  console.log("   Symbol:", await lockNFT.symbol());
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          2. VESTING NFT
  // ═══════════════════════════════════════════════════════════════════════

  console.log("📦 [2/3] Deploying VestingNFT...");
  const VestingNFT = await ethers.getContractFactory("VestingNFT");
  const vestingNFT = await VestingNFT.deploy();
  await vestingNFT.waitForDeployment();
  const vestingAddress = await vestingNFT.getAddress();
  deployments.VestingNFT = vestingAddress;
  console.log("✅ VestingNFT deployed:", vestingAddress);
  console.log("   Name:", await vestingNFT.name());
  console.log("   Symbol:", await vestingNFT.symbol());
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          3. YIELD FARM NFT
  // ═══════════════════════════════════════════════════════════════════════

  console.log("📦 [3/3] Deploying YieldFarmNFT...");
  
  // Platform token address - UPDATE THIS with your actual platform token!
  // For now using a placeholder - you can update this later
  const platformTokenAddress = "0x0000000000000000000000000000000000000001";
  console.log("   Platform Token:", platformTokenAddress);
  console.log("   ⚠️  NOTE: Update this with your actual platform token address!");
  
  const YieldFarmNFT = await ethers.getContractFactory("YieldFarmNFT");
  const farmNFT = await YieldFarmNFT.deploy(platformTokenAddress);
  await farmNFT.waitForDeployment();
  const farmAddress = await farmNFT.getAddress();
  deployments.YieldFarmNFT = farmAddress;
  console.log("✅ YieldFarmNFT deployed:", farmAddress);
  console.log("   Name:", await farmNFT.name());
  console.log("   Symbol:", await farmNFT.symbol());
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          DEPLOYMENT SUMMARY
  // ═══════════════════════════════════════════════════════════════════════

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY!");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📝 Deployment Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TokenLockNFT:  ", lockAddress);
  console.log("VestingNFT:    ", vestingAddress);
  console.log("YieldFarmNFT:  ", farmAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔗 Explorer Links:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TokenLockNFT:  ", `https://testnet.monadexplorer.com/address/${lockAddress}`);
  console.log("VestingNFT:    ", `https://testnet.monadexplorer.com/address/${vestingAddress}`);
  console.log("YieldFarmNFT:  ", `https://testnet.monadexplorer.com/address/${farmAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎯 Next Steps:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Update src/lib/web3/contracts.ts with these addresses");
  console.log("2. Verify contracts on Monad Explorer");
  console.log("3. Test creating locks, vestings, and farm positions");
  console.log("4. Test transferring NFTs");
  console.log("5. Deploy to production!\n");

  console.log("💡 Key Features:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ All positions are NFTs");
  console.log("✅ Fully transferable");
  console.log("✅ Tradeable on marketplaces");
  console.log("✅ Can be used as collateral");
  console.log("✅ No user address mappings");
  console.log("✅ Pure NFT ownership\n");

  // Save to deployments.json
  const fs = require("fs");
  let deploymentsFile: any = {};
  try {
    deploymentsFile = JSON.parse(fs.readFileSync("./deployments.json", "utf8"));
  } catch {
    // File doesn't exist, create new
  }
  
  deploymentsFile["10143"] = {
    ...deploymentsFile["10143"],
    ...deployments,
  };
  
  fs.writeFileSync("./deployments.json", JSON.stringify(deploymentsFile, null, 2));
  console.log("💾 Deployment addresses saved to deployments.json\n");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔥 NFT-BASED DEFI SUITE READY!");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
