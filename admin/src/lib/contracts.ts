export {
  STREAM_FARM_ADDRESS,
  TOKEN_LOCK_ADDRESS,
  VESTING_NFT_ADDRESS,
  OTC_MARKET_ADDRESS,
} from "./deployments";

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
  {
    type: "function",
    name: "getFarm",
    stateMutability: "view",
    inputs: [{ name: "farmId", type: "uint256" }],
    outputs: [
      { name: "stakeToken", type: "address" },
      { name: "totalShares", type: "uint256" },
      { name: "totalStaked", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "lockDuration", type: "uint256" },
      { name: "earlyWithdrawBps", type: "uint256" },
      { name: "rewardStreamCount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getRewardStream",
    stateMutability: "view",
    inputs: [{ name: "farmId", type: "uint256" }, { name: "rewardIdx", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "rewardRate", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "totalBudget", type: "uint256" },
      { name: "totalDistributed", type: "uint256" },
      { name: "totalClaimed", type: "uint256" },
      { name: "accRewardPerShare", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "recoverableBalance",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "recoverTokens",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

export const TOKEN_LOCK_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "locksLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalLocks", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokensLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "allTokens",
    stateMutability: "view",
    inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "totalEscrowed",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "emergencyRecoverToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

export const VESTING_NFT_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalVestings", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "totalEscrowed",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "emergencyRecoverToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

export const OTC_MARKET_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "listingCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "price", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "createdAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "pendingNativePayments",
    stateMutability: "view",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawNativePayments",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "pendingTokenPayments",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }, { name: "recipient", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawTokenPayments",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;
