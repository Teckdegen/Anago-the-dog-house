import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking YieldFarm Contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON\n");

  // YieldFarm contract address
  const yieldFarmAddress = "0x330b72ea1A45b392BfccE383d1876F5e3d7bb74d";
  
  // Check if contract exists
  const code = await ethers.provider.getCode(yieldFarmAddress);
  console.log("Contract code length:", code.length);
  
  if (code === "0x") {
    console.log("❌ Contract not deployed at this address!");
    return;
  }

  // Get contract
  const YieldFarmNFT = await ethers.getContractFactory("YieldFarmNFT");
  const yieldFarm = YieldFarmNFT.attach(yieldFarmAddress);

  try {
    // Check basic contract info
    const poolLength = await yieldFarm.poolLength();
    console.log("Current pool count:", poolLength.toString());

    const owner = await yieldFarm.owner();
    console.log("Contract owner:", owner);
    console.log("Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase());

    // Check if we can call createPool with a test token
    const testToken = "0x39171AC03b8e14EeE61791E06a492b98a7ec7983"; // DOG token
    
    // Check if token exists
    const tokenCode = await ethers.provider.getCode(testToken);
    console.log("Token code length:", tokenCode.length);

    if (tokenCode === "0x") {
      console.log("❌ Token not deployed!");
      return;
    }

    // Try to estimate gas for createPool
    console.log("\n🧮 Estimating gas for createPool...");
    try {
      const gasEstimate = await yieldFarm.createPool.estimateGas(testToken);
      console.log("✅ Gas estimate:", gasEstimate.toString());
      
      // Try to create the pool
      console.log("\n🏊 Creating pool...");
      const tx = await yieldFarm.createPool(testToken, {
        gasLimit: gasEstimate + 50000n, // Add buffer
      });
      
      console.log("Transaction hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Pool created successfully!");
      console.log("Gas used:", receipt?.gasUsed.toString());
      
    } catch (gasError: any) {
      console.log("❌ Gas estimation failed:", gasError.message);
      
      // Try to get more details about the error
      if (gasError.data) {
        console.log("Error data:", gasError.data);
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});