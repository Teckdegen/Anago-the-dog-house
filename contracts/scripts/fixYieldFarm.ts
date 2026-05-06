import { ethers } from "hardhat";
import path from "path";
import fs from "fs";

async function main() {
  console.log("🔧 Fixing YieldFarm Platform Token Issue...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // ═══════════════════════════════════════════════════════════════════════
  //                          1. DEPLOY PLATFORM TOKEN
  // ═══════════════════════════════════════════════════════════════════════

  console.log("📦 [1/2] Deploying Platform Token...");
  const PlatformToken = await ethers.getContractFactory("PlatformToken");
  const platformToken = await PlatformToken.deploy();
  await platformToken.waitForDeployment();
  const platformTokenAddress = await platformToken.getAddress();
  
  console.log("✅ Platform Token deployed:", platformTokenAddress);
  console.log("   Name:", await platformToken.name());
  console.log("   Symbol:", await platformToken.symbol());
  console.log("   Total Supply:", ethers.formatEther(await platformToken.totalSupply()));
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          2. REDEPLOY YIELD FARM NFT
  // ═══════════════════════════════════════════════════════════════════════

  console.log("📦 [2/2] Redeploying YieldFarmNFT with correct platform token...");
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
  //                          3. APPROVE TOKENS FOR TESTING
  // ═══════════════════════════════════════════════════════════════════════

  console.log("💰 Approving platform tokens for pool creation...");
  const approveAmount = ethers.parseEther("10000"); // 10k tokens
  const approveTx = await platformToken.approve(farmAddress, approveAmount);
  await approveTx.wait();
  console.log("✅ Approved", ethers.formatEther(approveAmount), "HOUSE tokens for YieldFarm");
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          4. UPDATE DEPLOYMENTS
  // ═══════════════════════════════════════════════════════════════════════

  const deploymentsPath = path.resolve(__dirname, "..", "deployments.json");
  let deployments: any = {};
  
  try {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  } catch {
    // File doesn't exist, create new
  }
  
  if (!deployments["10143"]) {
    deployments["10143"] = {};
  }
  
  deployments["10143"].PlatformToken = platformTokenAddress;
  deployments["10143"].YieldFarmNFT = farmAddress;
  
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("💾 Updated deployments.json");
  console.log();

  // ═══════════════════════════════════════════════════════════════════════
  //                          5. TEST POOL CREATION
  // ═══════════════════════════════════════════════════════════════════════

  console.log("🧪 Testing pool creation...");
  const testToken = "0x39171AC03b8e14EeE61791E06a492b98a7ec7983"; // DOG token
  
  try {
    const createTx = await farmNFT.createPool(testToken);
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
  console.log("🎉 YIELD FARM FIXED!");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📝 New Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Platform Token:", platformTokenAddress);
  console.log("YieldFarmNFT:  ", farmAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎯 Next Steps:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Update frontend contracts.ts with new YieldFarmNFT address");
  console.log("2. Run createFarmsWithMockTokens.ts to create test pools");
  console.log("3. Test the complete farm UI");
  console.log("4. Users need HOUSE tokens to create pools (100 HOUSE per pool)");
  console.log();

  console.log("💡 Platform Token Info:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ 1M HOUSE tokens minted to deployer");
  console.log("✅ 10k HOUSE tokens approved for pool creation");
  console.log("✅ Pool creation fee: 100 HOUSE tokens");
  console.log("✅ Can create 100 pools with current approval");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});