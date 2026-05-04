export const VESTING_WALLET_ABI = [
  { type: "function", name: "owner",     stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "start",     stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "duration",  stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "end",       stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "released",  stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "released",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "releasable", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "releasable",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  // optional cliff (only present on VestingCliff)
  { type: "function", name: "cliff", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
