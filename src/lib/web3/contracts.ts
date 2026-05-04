/**
 * Deployed contract addresses per chain.
 * Fill in after running the deploy scripts in /contracts.
 */
export const CONTRACTS: Record<
  number,
  { vestingFactory: `0x${string}`; tokenLock: `0x${string}`; yieldFarmNFT: `0x${string}`; vestingNFT: `0x${string}` }
> = {
  // Monad testnet (chainId 10143)
  10143: {
    vestingFactory: "0x83Cfd62A53210139f52DB6451bD0aaBDC71De283", // legacy — kept for reference
    tokenLock:      "0xe6A045525C053259e096d2c48973856D9f06143f", // TokenLockNFT
    vestingNFT:     "0x2f0326D9eDDB98da0d05CfD7e7C94cbAEdacB206", // VestingNFT
    yieldFarmNFT:   "0x330b72ea1A45b392BfccE383d1876F5e3d7bb74d", // YieldFarmNFT
  },
};

// ── Per-wallet ABI (each deployed VestingWallet / VestingCliff instance) ──
export const VESTING_WALLET_ABI = [
  { type: "function", name: "owner",      stateMutability: "view",        inputs: [],                                    outputs: [{ type: "address" }] },
  { type: "function", name: "start",      stateMutability: "view",        inputs: [],                                    outputs: [{ type: "uint256" }] },
  { type: "function", name: "end",        stateMutability: "view",        inputs: [],                                    outputs: [{ type: "uint256" }] },
  { type: "function", name: "duration",   stateMutability: "view",        inputs: [],                                    outputs: [{ type: "uint256" }] },
  { type: "function", name: "releasable", stateMutability: "view",        inputs: [],                                    outputs: [{ type: "uint256" }] },
  { type: "function", name: "releasable", stateMutability: "view",        inputs: [{ name: "token", type: "address" }],  outputs: [{ type: "uint256" }] },
  { type: "function", name: "released",   stateMutability: "view",        inputs: [],                                    outputs: [{ type: "uint256" }] },
  { type: "function", name: "release",    stateMutability: "nonpayable",  inputs: [],                                    outputs: [] },
  { type: "function", name: "release",    stateMutability: "nonpayable",  inputs: [{ name: "token", type: "address" }],  outputs: [] },
] as const;

export const VESTING_FACTORY_ABI = [
  {
    type: "function",
    name: "createVesting",
    stateMutability: "nonpayable",
    inputs: [
      { name: "beneficiary",      type: "address" },
      { name: "token",            type: "address" },
      { name: "amount",           type: "uint256" },
      { name: "startTimestamp",   type: "uint64"  },
      { name: "durationSeconds",  type: "uint64"  },
    ],
    outputs: [{ name: "wallet", type: "address" }],
  },
  {
    type: "function",
    name: "createVestingWithCliff",
    stateMutability: "nonpayable",
    inputs: [
      { name: "beneficiary",      type: "address" },
      { name: "token",            type: "address" },
      { name: "amount",           type: "uint256" },
      { name: "startTimestamp",   type: "uint64"  },
      { name: "durationSeconds",  type: "uint64"  },
      { name: "cliffSeconds",     type: "uint64"  },
    ],
    outputs: [{ name: "wallet", type: "address" }],
  },
  {
    type: "function",
    name: "walletsOfBeneficiary",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "walletsOfCreator",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "tokenOf",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "allWalletsLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "VestingCreated",
    inputs: [
      { name: "creator",     type: "address", indexed: true  },
      { name: "beneficiary", type: "address", indexed: true  },
      { name: "wallet",      type: "address", indexed: true  },
      { name: "token",       type: "address", indexed: false },
      { name: "amount",      type: "uint256", indexed: false },
      { name: "start",       type: "uint64",  indexed: false },
      { name: "duration",    type: "uint64",  indexed: false },
      { name: "cliff",       type: "uint64",  indexed: false },
      { name: "kind",        type: "uint8",   indexed: false },
    ],
  },
] as const;

export const TOKEN_LOCK_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "createLock",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token",      type: "address" },
      { name: "amount",     type: "uint256" },
      { name: "unlockTime", type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  // ── Lock reads ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "getLock",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "token",      type: "address" },
          { name: "amount",     type: "uint256" },
          { name: "unlockTime", type: "uint256" },
          { name: "createdAt",  type: "uint256" },
          { name: "withdrawn",  type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "isUnlocked",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  // ── ERC-721 owner lookup ───────────────────────────────────────────────
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  // ── Counts ─────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "locksLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tokensLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "lockersLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  // ── Index reads (for off-chain leaderboard computation) ────────────────
  {
    type: "function",
    name: "locksOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "locksOfToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "locksOfCreator",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "allTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "allLockers",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  // ── Events ─────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "LockCreated",
    inputs: [
      { name: "tokenId",    type: "uint256", indexed: true  },
      { name: "creator",    type: "address", indexed: true  },
      { name: "token",      type: "address", indexed: true  },
      { name: "amount",     type: "uint256", indexed: false },
      { name: "unlockTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensWithdrawn",
    inputs: [
      { name: "tokenId",   type: "uint256", indexed: true  },
      { name: "recipient", type: "address", indexed: true  },
      { name: "token",     type: "address", indexed: true  },
      { name: "amount",    type: "uint256", indexed: false },
    ],
  },
] as const;

// ── TOKEN_LOCK_NFT_ABI — used by transfer.tsx ─────────────────────────────
// Alias of TOKEN_LOCK_ABI with the ERC-721 transfer functions included.
export const TOKEN_LOCK_NFT_ABI = [
  ...TOKEN_LOCK_ABI,
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",    type: "address" },
      { name: "to",      type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",    type: "address" },
      { name: "to",      type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// ── VESTING_NFT_ABI ────────────────────────────────────────────────────────
export const VESTING_NFT_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "createVesting",
    stateMutability: "nonpayable",
    inputs: [
      { name: "beneficiary",    type: "address" },
      { name: "token",          type: "address" },
      { name: "amount",         type: "uint256" },
      { name: "duration",       type: "uint256" },
      { name: "cliffDuration",  type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  // ── Read ───────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "getVesting",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "token",         type: "address" },
          { name: "totalAmount",   type: "uint256" },
          { name: "startTime",     type: "uint256" },
          { name: "duration",      type: "uint256" },
          { name: "cliffDuration", type: "uint256" },
          { name: "claimed",       type: "uint256" },
          { name: "revoked",       type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "claimableAmount",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "vestingsOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "totalVestings",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",    type: "address" },
      { name: "to",      type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",    type: "address" },
      { name: "to",      type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  // ── Events ─────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "VestingCreated",
    inputs: [
      { name: "tokenId",       type: "uint256", indexed: true  },
      { name: "creator",       type: "address", indexed: true  },
      { name: "beneficiary",   type: "address", indexed: true  },
      { name: "token",         type: "address", indexed: false },
      { name: "amount",        type: "uint256", indexed: false },
      { name: "duration",      type: "uint256", indexed: false },
      { name: "cliffDuration", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensClaimed",
    inputs: [
      { name: "tokenId",     type: "uint256", indexed: true  },
      { name: "beneficiary", type: "address", indexed: true  },
      { name: "amount",      type: "uint256", indexed: false },
    ],
  },
] as const;

// ── ERC20_ABI re-export — some routes import it from here ─────────────────
export { ERC20_ABI } from "./tokens";

// ── YIELD_FARM_NFT_ABI ────────────────────────────────────────────────────
export const YIELD_FARM_NFT_ABI = [
  // ── Read ───────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "poolLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getPoolInfo",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "stakeToken",   type: "address" },
          { name: "creator",      type: "address" },
          { name: "totalStaked",  type: "uint256" },
          { name: "createdAt",    type: "uint256" },
          { name: "verified",     type: "bool"    },
          { name: "active",       type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "poolRewardLength",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingAllRewards",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "tokens",   type: "address[]" },
      { name: "amounts",  type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getPosition",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "poolId",   type: "uint256" },
      { name: "amount",   type: "uint256" },
      { name: "stakedAt", type: "uint256" },
      { name: "boost",    type: "uint256" },
    ],
  },
  // ── Write ──────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "createPool",
    stateMutability: "nonpayable",
    inputs: [{ name: "stakeToken", type: "address" }],
    outputs: [{ name: "poolId", type: "uint256" }],
  },
  {
    type: "function",
    name: "addReward",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId",        type: "uint256" },
      { name: "rewardToken",   type: "address" },
      { name: "rewardPerSecond", type: "uint256" },
      { name: "duration",      type: "uint256" },
      { name: "totalSupply",   type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimAllRewards",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  // ── Events ─────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      { name: "poolId",     type: "uint256", indexed: true  },
      { name: "creator",    type: "address", indexed: true  },
      { name: "stakeToken", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardAdded",
    inputs: [
      { name: "poolId",      type: "uint256", indexed: true  },
      { name: "rewardId",    type: "uint256", indexed: true  },
      { name: "rewardToken", type: "address", indexed: false },
      { name: "totalSupply", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true  },
      { name: "user",    type: "address", indexed: true  },
      { name: "poolId",  type: "uint256", indexed: false },
      { name: "amount",  type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true  },
      { name: "user",    type: "address", indexed: true  },
      { name: "amount",  type: "uint256", indexed: false },
    ],
  },
] as const;
