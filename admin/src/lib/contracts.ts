export { STREAM_FARM_ADDRESS, TOKEN_LOCK_ADDRESS, VESTING_NFT_ADDRESS } from "./deployments";

/** Minimal StreamFarm ABI for protocol admin (whitelist operators, manage admins). */
export const STREAM_FARM_ABI = [
  { type: "function", name: "farmCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "isAdmin", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "setFarmOperator",
    stateMutability: "nonpayable",
    inputs: [{ name: "operator", type: "address" }, { name: "allowed", type: "bool" }],
    outputs: [],
  },
  { type: "function", name: "farmOperators", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "addAdmin", stateMutability: "nonpayable", inputs: [{ name: "admin", type: "address" }], outputs: [] },
  { type: "function", name: "removeAdmin", stateMutability: "nonpayable", inputs: [{ name: "admin", type: "address" }], outputs: [] },
] as const;

export const TOKEN_LOCK_ABI = [
  { type: "function", name: "locksLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalLocks", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const VESTING_NFT_ABI = [
  { type: "function", name: "totalVestings", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
