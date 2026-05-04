import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network:  ${network.name}`);

  const Lock = await ethers.getContractFactory("TokenLock");
  const lock = await Lock.deploy();
  await lock.waitForDeployment();
  const address = await lock.getAddress();

  console.log(`TokenLock deployed → ${address}`);

  const out = path.resolve(__dirname, "..", "deployments.json");
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
  prev[network.name] = { ...(prev[network.name] ?? {}), TokenLock: address };
  fs.writeFileSync(out, JSON.stringify(prev, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
