export const STREAM_FARM_ADDRESS = "0x8cdaB2A0c70B27E0f6B4eE0540bBC50395978EC1" as const;

export const STREAM_FARM_ABI = [
  { type: "function", name: "farmCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "admins", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "isAdmin", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  {
    type: "function", name: "getFarm", stateMutability: "view",
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
    type: "function", name: "getRewardStream", stateMutability: "view",
    inputs: [{ name: "farmId", type: "uint256" }, { name: "rewardIdx", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "rewardRate", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "totalBudget", type: "uint256" },
      { name: "totalDistributed", type: "uint256" },
      { name: "accRewardPerShare", type: "uint256" },
    ],
  },
  { type: "function", name: "getBoostTiers", stateMutability: "view", inputs: [], outputs: [{ name: "durations", type: "uint256[]" }, { name: "multipliers", type: "uint256[]" }] },
  { type: "function", name: "createFarm", stateMutability: "nonpayable", inputs: [{ name: "stakeToken", type: "address" }, { name: "lockDuration", type: "uint256" }, { name: "earlyWithdrawBps", type: "uint256" }], outputs: [{ name: "farmId", type: "uint256" }] },
  { type: "function", name: "addRewardStream", stateMutability: "nonpayable", inputs: [{ name: "farmId", type: "uint256" }, { name: "rewardToken", type: "address" }, { name: "totalBudget", type: "uint256" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }], outputs: [] },
  { type: "function", name: "setFarmActive", stateMutability: "nonpayable", inputs: [{ name: "farmId", type: "uint256" }, { name: "active", type: "bool" }], outputs: [] },
  { type: "function", name: "setBoostTiers", stateMutability: "nonpayable", inputs: [{ name: "durations", type: "uint256[]" }, { name: "multipliers", type: "uint256[]" }], outputs: [] },
  { type: "function", name: "recoverTokens", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "addAdmin", stateMutability: "nonpayable", inputs: [{ name: "admin", type: "address" }], outputs: [] },
  { type: "function", name: "removeAdmin", stateMutability: "nonpayable", inputs: [{ name: "admin", type: "address" }], outputs: [] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
