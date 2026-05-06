import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Debugging Farm Contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);

  // YieldFarm contract address
  const yieldFarmAddress = "0x330b72ea1A45b392BfccE383d1876F5e3d7bb74d";
  
  // Get contract
  const YieldFarmNFT = await ethers.getContractFactory("YieldFarmNFT");
  const yieldFarm = YieldFarmNFT.attach(yieldFarmAddress);

  try {
    // Check if contract exists
    const code = await ethers.provider.getCode(yieldFarmAddress);
    console.log("Contract code length:", code.length);
    
    if (code === "0x") {
      console.log("❌ Contract not deployed at this address!");
      return;
    }

    // Try to get pool length
    const poolLength = await yieldFarm.poolLength();
    console.log("Current pool count:", poolLength.toString());

    // Try to get owner
    const owner = await yieldFarm.owner();
    console.log("Contract owner:", owner);
    console.log("Deployer address:", deployer.address);
    console.log("Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase());

    // Test token address
    const testToken = "0x39171AC03b8e14EeE61791E06a492b98a7ec7983"; // DOG token
    
    // Check if token exists
    const tokenCode = await ethers.provider.getCode(testToken);
    console.log("Token code length:", tokenCode.length);

    if (tokenCode === "0x") {
      console.log("❌ Token not deployed!");
      return;
    }

    // Try to create a pool with more gas
    console.log("\n🏊 Attempting to create pool...");
    const tx = await yieldFarm.createPool(testToken, {
      gasLimit: 500000, // Explicit gas limit
    });
    
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Pool created successfully!");
    console.log("Gas used:", receipt.gasUsed.toString());

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});