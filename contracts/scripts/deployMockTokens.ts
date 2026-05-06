import { ethers } from "hardhat";
import path from "path";
import fs from "fs";

async function main() {
  console.log("🚀 Deploying Mock Tokens for Farm Testing...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MON\n");

  // Token configurations
  const tokens = [
    {
      name: "Dog Coin",
      symbol: "DOG",
      decimals: 18,
      initialSupply: 1000000, // 1M tokens
    },
    {
      name: "Bone Token",
      symbol: "BONE",
      decimals: 18,
      initialSupply: 500000, // 500K tokens
    },
    {
      name: "Treat Token",
      symbol: "TREAT",
      decimals: 6,
      initialSupply: 2000000, // 2M tokens (6 decimals)
    },
    {
      name: "Paw Points",
      symbol: "PAW",
      decimals: 18,
      initialSupply: 10000000, // 10M tokens
    },
    {
      name: "Woof Rewards",
      symbol: "WOOF",
      decimals: 18,
      initialSupply: 750000, // 750K tokens
    }
  ];

  const deployedTokens: any[] = [];

  // Deploy all tokens
  for (const tokenConfig of tokens) {
    console.log(`📦 Deploying ${tokenConfig.name} (${tokenConfig.symbol})...`);
    
    const MockToken = await ethers.getContractFactory("MockToken");
    const token = await MockToken.deploy(
      tokenConfig.name,
      tokenConfig.symbol,
      tokenConfig.decimals,
      tokenConfig.initialSupply
    );
    
    await token.waitForDeployment();
    const address = await token.getAddress();
    
    console.log(`✅ ${tokenConfig.symbol} deployed to:`, address);
    console.log(`   Initial supply: ${tokenConfig.initialSupply.toLocaleString()} ${tokenConfig.symbol}`);
    
    // Mint additional tokens for testing
    const additionalMint = tokenConfig.initialSupply * 2; // 2x more for testing
    console.log(`🪙 Minting additional ${additionalMint.toLocaleString()} ${tokenConfig.symbol}...`);
    
    await token.mintWithDecimals(deployer.address, additionalMint);
    
    const totalSupply = await token.totalSupply();
    console.log(`   Total supply: ${ethers.formatUnits(totalSupply, tokenConfig.decimals)} ${tokenConfig.symbol}\n`);
    
    deployedTokens.push({
      name: tokenConfig.name,
      symbol: tokenConfig.symbol,
      address,
      decimals: tokenConfig.decimals,
      totalSupply: totalSupply.toString(),
    });
  }

  // Save deployment info
  const deploymentData = {
    network: "Monad Testnet",
    chainId: 10143,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    tokens: deployedTokens,
  };

  const deploymentsPath = path.resolve(__dirname, "..", "mock-tokens.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2));

  console.log("📝 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  deployedTokens.forEach((token, i) => {
    console.log(`${i + 1}. ${token.name} (${token.symbol})`);
    console.log(`   Address: ${token.address}`);
    console.log(`   Decimals: ${token.decimals}`);
    console.log(`   Supply: ${ethers.formatUnits(token.totalSupply, token.decimals)}`);
  });

  console.log("\n🔗 Explorer Links:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  deployedTokens.forEach((token) => {
    console.log(`${token.symbol}: https://testnet.monadexplorer.com/address/${token.address}`);
  });

  console.log(`\n💾 Deployment data saved to: ${deploymentsPath}`);
  console.log("\n🎯 Next Steps:");
  console.log("1. Update src/lib/web3/tokens.ts with these addresses");
  console.log("2. Run the farm creation script");
  console.log("3. Test staking in the UI");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});