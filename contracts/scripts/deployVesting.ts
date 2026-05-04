import { ethers, network } from "hardhat";

/**
 * Deploys a single VestingWallet directly (no factory).
 * Usage: set BENEFICIARY, START, DURATION env vars, then `npm run deploy:vesting`.
 *
 *   BENEFICIARY=0x...   address that receives vested funds
 *   START=1735689600    unix start timestamp
 *   DURATION=31536000   vesting length in seconds (1y = 31536000)
 */
async function main() {
  const beneficiary = process.env.BENEFICIARY;
  const start = process.env.START;
  const duration = process.env.DURATION;
  if (!beneficiary || !start || !duration) {
    throw new Error("Set BENEFICIARY, START, DURATION env vars");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address} (${network.name})`);

  const Wallet = await ethers.getContractFactory("VestingWallet");
  const wallet = await Wallet.deploy(beneficiary, BigInt(start), BigInt(duration));
  await wallet.waitForDeployment();
  console.log(`VestingWallet → ${await wallet.getAddress()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
