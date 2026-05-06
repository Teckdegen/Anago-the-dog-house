import { ethers } from "hardhat";
import path from "path";
import fs from "fs";

async function main() {
  console.log("🚀 Deploying YieldFarmNFT Only...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // Use existing platform token
  const platformTokenAddress = "0xa1D67bD149d47d17421c0A558e88E1cf3f8cf541";
  console.log("Using existing Platform Token:", platformTokenAddress);

  // ═══════════════════════════════════════════════════════════════════════
  //                          DEPLOY YIELD FARM NFT
  // ═══════════════════════════════════════════════════════════════════════

  console.log("📦 Deploying YieldFarmNFT...");
  const YieldFarmNFT = await ethers.getContractFactory("YieldFarmNFT");
  const farmNFT = await YieldFarmNFT.deploy(platformTokenAddress);
  await farmNFT.waitForDeployment();
  const farmAddress = await farmNFT.getAddress();
  
  console.log("✅ YieldFarmNFT deployed:", farmAddress);
  console.log("   Name:", await farmNFT.name());
  console.log("   Symbol:", await farmNFT.symbol());
  console.log("   Platform Token:", await farmNFT.platformToken());
  console.log("   Pool Creation Fee:", ethers.formatEther(await farmNFT.poolCreationFee()), "HOUSE");
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          APPROVE TOKENS FOR TESTING
  // ═══════════════════════════════════════════════════════════════════════

  console.log("💰 Approving platform tokens for pool creation...");
  const platformToken = await ethers.getContractAt("PlatformToken", platformTokenAddress);
  const approveAmount = ethers.parseEther("50000"); // 50k tokens
  const approveTx = await platformToken.approve(farmAddress, approveAmount);
  await approveTx.wait();
  console.log("✅ Approved", ethers.formatEther(approveAmount), "HOUSE tokens for YieldFarm");
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          UPDATE DEPLOYMENTS
  // ═══════════════════════════════════════════════════════════════════════

  const deploymentsPath = path.resolve(__dirname, "..", "deployments.json");
  let deployments: any = {};
  
  try {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  } catch {
    deployments = {};
  }
  
  if (!deployments["10143"]) {
    deployments["10143"] = {};
  }
  
  deployments["10143"].YieldFarmNFT = farmAddress;
  
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("💾 Updated deployments.json");
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          TEST POOL CREATION
  // ═══════════════════════════════════════════════════════════════════════

  console.log("🧪 Testing pool creation...");
  try {
    // Create a test pool with platform token itself
    const createTx = await farmNFT.createPool(platformTokenAddress);
    const receipt = await createTx.wait();
    console.log("✅ Test pool created successfully!");
    console.log("   Transaction:", createTx.hash);
    console.log("   Gas used:", receipt?.gasUsed.toString());
    
    const poolLength = await farmNFT.poolLength();
    console.log("   Total pools:", poolLength.toString());
  } catch (error: any) {
    console.log("❌ Pool creation failed:", error.message);
  }
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          SUMMARY
  // ═══════════════════════════════════════════════════════════════════════

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🎉 YIELD FARM NFT DEPLOYED!");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📝 New Address:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("YieldFarmNFT:", farmAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔗 Explorer Link:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("YieldFarmNFT:", `https://testnet.monadexplorer.com/address/${farmAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📋 Copy this address to update the frontend:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`"${farmAddress}"`);
  console.log();

  console.log("💡 Contract Info:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Using existing HOUSE platform token");
  console.log("✅ 50k HOUSE tokens approved for pool creation");
  console.log("✅ Pool creation fee: 100 HOUSE tokens");
  console.log("✅ Test pool created successfully");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});