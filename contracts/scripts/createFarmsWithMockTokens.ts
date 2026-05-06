import { ethers } from "hardhat";
import path from "path";
import fs from "fs";

async function main() {
  console.log("🚜 Creating Farms with Mock Tokens...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Creating farms with account:", deployer.address);

  // Load mock tokens
  const mockTokensPath = path.resolve(__dirname, "..", "mock-tokens.json");
  if (!fs.existsSync(mockTokensPath)) {
    console.error("❌ Mock tokens not found. Run deployMockTokens.ts first!");
    process.exit(1);
  }

  const mockTokensData = JSON.parse(fs.readFileSync(mockTokensPath, "utf8"));
  const tokens = mockTokensData.tokens;

  // Load main deployments
  const deploymentsPath = path.resolve(__dirname, "..", "deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ Main deployments not found. Run deployAll.ts first!");
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const yieldFarmAddress = deployments["10143"]?.YieldFarmNFT;

  console.log("YieldFarm contract:", yieldFarmAddress);
  console.log("Available tokens:", tokens.length, "\n");

  // Get YieldFarm contract
  const YieldFarmNFT = await ethers.getContractFactory("YieldFarmNFT");
  const yieldFarm = YieldFarmNFT.attach(yieldFarmAddress);

  const createdPools: any[] = [];

  // Create pools for each token
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    console.log(`🏊 Creating pool ${i + 1}/${tokens.length} for ${token.symbol}...`);

    try {
      const tx = await yieldFarm.createPool(token.address);
      const receipt = await tx.wait();
      
      // Get pool ID from events
      const poolCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = yieldFarm.interface.parseLog(log);
          return parsed?.name === "PoolCreated";
        } catch {
          return false;
        }
      });

      let poolId = i; // fallback
      if (poolCreatedEvent) {
        const parsed = yieldFarm.interface.parseLog(poolCreatedEvent);
        poolId = Number(parsed?.args?.poolId || i);
      }

      console.log(`✅ Pool created for ${token.symbol}`);
      console.log(`   Pool ID: ${poolId}`);
      console.log(`   Stake Token: ${token.address}`);
      console.log(`   Transaction: ${tx.hash}\n`);

      createdPools.push({
        poolId,
        stakeToken: token.address,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        tokenDecimals: token.decimals,
        transactionHash: tx.hash,
      });

    } catch (error) {
      console.error(`❌ Failed to create pool for ${token.symbol}:`, error);
    }
  }

  // Now add rewards to some pools
  console.log("🎁 Adding rewards to pools...\n");

  const rewardConfigs = [
    {
      poolId: 0, // DOG pool
      rewardToken: tokens[1].address, // BONE as reward
      rewardSymbol: tokens[1].symbol,
      rewardPerSecond: "1", // 1 BONE per second
      duration: 30, // 30 days
      totalSupply: "2592000", // 30 days * 24 hours * 60 minutes * 60 seconds = 2,592,000 BONE
    },
    {
      poolId: 1, // BONE pool  
      rewardToken: tokens[3].address, // PAW as reward
      rewardSymbol: tokens[3].symbol,
      rewardPerSecond: "5", // 5 PAW per second
      duration: 14, // 14 days
      totalSupply: "6048000", // 14 days * 24 * 60 * 60 * 5 = 6,048,000 PAW
    },
    {
      poolId: 2, // TREAT pool
      rewardToken: tokens[4].address, // WOOF as reward
      rewardSymbol: tokens[4].symbol,
      rewardPerSecond: "0.5", // 0.5 WOOF per second
      duration: 7, // 7 days
      totalSupply: "302400", // 7 days * 24 * 60 * 60 * 0.5 = 302,400 WOOF
    }
  ];

  for (const config of rewardConfigs) {
    console.log(`🎁 Adding ${config.rewardSymbol} rewards to pool ${config.poolId}...`);

    try {
      // First approve the reward tokens
      const rewardToken = await ethers.getContractAt("MockToken", config.rewardToken);
      const rewardDecimals = await rewardToken.decimals();
      
      const rewardPerSecondWei = ethers.parseUnits(config.rewardPerSecond, rewardDecimals);
      const totalSupplyWei = ethers.parseUnits(config.totalSupply, rewardDecimals);
      const durationSeconds = config.duration * 24 * 60 * 60;

      // Approve tokens
      console.log(`   Approving ${config.totalSupply} ${config.rewardSymbol}...`);
      const approveTx = await rewardToken.approve(yieldFarmAddress, totalSupplyWei);
      await approveTx.wait();

      // Add reward
      console.log(`   Adding reward: ${config.rewardPerSecond} ${config.rewardSymbol}/sec for ${config.duration} days...`);
      const addRewardTx = await yieldFarm.addReward(
        config.poolId,
        config.rewardToken,
        rewardPerSecondWei,
        durationSeconds,
        totalSupplyWei
      );
      await addRewardTx.wait();

      console.log(`✅ Reward added to pool ${config.poolId}`);
      console.log(`   Transaction: ${addRewardTx.hash}\n`);

    } catch (error) {
      console.error(`❌ Failed to add reward to pool ${config.poolId}:`, error);
    }
  }

  // Save farm data
  const farmData = {
    network: "Monad Testnet",
    chainId: 10143,
    yieldFarmAddress,
    createdAt: new Date().toISOString(),
    pools: createdPools,
    rewards: rewardConfigs,
  };

  const farmDataPath = path.resolve(__dirname, "..", "farm-data.json");
  fs.writeFileSync(farmDataPath, JSON.stringify(farmData, null, 2));

  console.log("📝 Farm Creation Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Total pools created: ${createdPools.length}`);
  console.log(`Rewards added: ${rewardConfigs.length}`);
  
  createdPools.forEach((pool) => {
    console.log(`\nPool ${pool.poolId}: ${pool.tokenName} (${pool.tokenSymbol})`);
    console.log(`  Stake Token: ${pool.stakeToken}`);
  });

  console.log(`\n💾 Farm data saved to: ${farmDataPath}`);
  console.log("\n🎯 Ready for UI testing!");
  console.log("Users can now stake tokens and earn rewards in the farms.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});