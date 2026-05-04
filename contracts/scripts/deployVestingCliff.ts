import { ethers, network } from "hardhat";

/**
 * Deploys a single VestingCliff (vesting + cliff) directly (no factory).
 * Env vars: BENEFICIARY, START, DURATION, CLIFF (cliff seconds, must be <= duration).
 */
async function main() {
  const beneficiary = process.env.BENEFICIARY;
  const start = process.env.START;
  const duration = process.env.DURATION;
  const cliff = process.env.CLIFF;
  if (!beneficiary || !start || !duration || !cliff) {
    throw new Error("Set BENEFICIARY, START, DURATION, CLIFF env vars");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address} (${network.name})`);

  const Wallet = await ethers.getContractFactory("VestingCliff");
  const wallet = await Wallet.deploy(
    beneficiary,
    BigInt(start),
    BigInt(duration),
    BigInt(cliff),
  );
  await wallet.waitForDeployment();
  console.log(`VestingCliff → ${await wallet.getAddress()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
