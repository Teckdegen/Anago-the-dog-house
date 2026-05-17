/**
 * Deployed contract addresses per chain.
 * Fill in after running the deploy scripts in /contracts.
 */
export const CONTRACTS: Record<
  number,
  { vestingFactory: `0x${string}`; tokenLock: `0x${string}`; streamFarm: `0x${string}`; vestingNFT: `0x${string}`; otcMarket: `0x${string}` }
> = {
  // Monad testnet (chainId 10143)
  10143: {
    vestingFactory: "0x83Cfd62A53210139f52DB6451bD0aaBDC71De283", // legacy — kept for reference
    tokenLock:      "0xe6A045525C053259e096d2c48973856D9f06143f", // TokenLockNFT
    vestingNFT:     "0x2f0326D9eDDB98da0d05CfD7e7C94cbAEdacB206", // VestingNFT
    streamFarm:     "0x8cdaB2A0c70B27E0f6B4eE0540bBC50395978EC1", // StreamFarm
    otcMarket:      "0x2B9242272eebF49ca0c2f3fC8Bb2eCf054B14Ef6", // OTCMarket
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
  // alias — older deployments expose totalLocks() instead of locksLength()
  {
    type: "function",
    name: "totalLocks",
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

// ── STREAM_FARM_ABI ────────────────────────────────────────────────────────
export const STREAM_FARM_ABI = [
  // ── Read ───────────────────────────────────────────────────────────────
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
  {
    type: "function", name: "getPosition", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "farmId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "depositTime", type: "uint256" },
      { name: "lockExpiry", type: "uint256" },
      { name: "boostMultiplier", type: "uint256" },
    ],
  },
  {
    type: "function", name: "pendingRewards", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "tokens", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
  },
  {
    type: "function", name: "positionsOf", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function", name: "getBoostTiers", stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "durations", type: "uint256[]" },
      { name: "multipliers", type: "uint256[]" },
    ],
  },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  // ── Write ──────────────────────────────────────────────────────────────
  {
    type: "function", name: "createFarm", stateMutability: "nonpayable",
    inputs: [
      { name: "stakeToken", type: "address" },
      { name: "lockDuration", type: "uint256" },
      { name: "earlyWithdrawBps", type: "uint256" },
    ],
    outputs: [{ name: "farmId", type: "uint256" }],
  },
  {
    type: "function", name: "addRewardStream", stateMutability: "nonpayable",
    inputs: [
      { name: "farmId", type: "uint256" },
      { name: "rewardToken", type: "address" },
      { name: "totalBudget", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "deposit", stateMutability: "nonpayable",
    inputs: [
      { name: "farmId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "lockTier", type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "setFarmActive", stateMutability: "nonpayable", inputs: [{ name: "farmId", type: "uint256" }, { name: "active", type: "bool" }], outputs: [] },
  { type: "function", name: "addAdmin", stateMutability: "nonpayable", inputs: [{ name: "admin", type: "address" }], outputs: [] },
  { type: "function", name: "removeAdmin", stateMutability: "nonpayable", inputs: [{ name: "admin", type: "address" }], outputs: [] },
  { type: "function", name: "setBoostTiers", stateMutability: "nonpayable", inputs: [{ name: "durations", type: "uint256[]" }, { name: "multipliers", type: "uint256[]" }], outputs: [] },
  { type: "function", name: "recoverTokens", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  // ── Events ─────────────────────────────────────────────────────────────
  { type: "event", name: "FarmCreated", inputs: [{ name: "farmId", type: "uint256", indexed: true }, { name: "creator", type: "address", indexed: true }, { name: "stakeToken", type: "address", indexed: false }] },
  { type: "event", name: "RewardStreamAdded", inputs: [{ name: "farmId", type: "uint256", indexed: true }, { name: "rewardIdx", type: "uint256", indexed: false }, { name: "token", type: "address", indexed: false }, { name: "rewardRate", type: "uint256", indexed: false }, { name: "startTime", type: "uint256", indexed: false }, { name: "endTime", type: "uint256", indexed: false }] },
  { type: "event", name: "Deposited", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "farmId", type: "uint256", indexed: true }, { name: "user", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "shares", type: "uint256", indexed: false }] },
  { type: "event", name: "Withdrawn", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "farmId", type: "uint256", indexed: true }, { name: "user", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "penalty", type: "uint256", indexed: false }] },
  { type: "event", name: "RewardsClaimed", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "user", type: "address", indexed: true }, { name: "rewardToken", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }] },
] as const;


// ── OTC_MARKET_ABI ────────────────────────────────────────────────────────
export const OTC_MARKET_ABI = [
  { type: "function", name: "listingCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "platformFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "getListing", stateMutability: "view",
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
    type: "function", name: "getActiveListings", stateMutability: "view",
    inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }],
    outputs: [{ name: "ids", type: "uint256[]" }],
  },
  {
    type: "function", name: "getSellerListings", stateMutability: "view",
    inputs: [{ name: "seller", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function", name: "list", stateMutability: "nonpayable",
    inputs: [{ name: "nftContract", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "paymentToken", type: "address" }, { name: "price", type: "uint256" }],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "unlist", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "event", name: "Listed", inputs: [{ name: "listingId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "nftContract", type: "address", indexed: false }, { name: "tokenId", type: "uint256", indexed: false }, { name: "paymentToken", type: "address", indexed: false }, { name: "price", type: "uint256", indexed: false }] },
  { type: "event", name: "Sold", inputs: [{ name: "listingId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "price", type: "uint256", indexed: false }, { name: "fee", type: "uint256", indexed: false }] },
  { type: "event", name: "Unlisted", inputs: [{ name: "listingId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }] },
] as const;

// ERC721 approve/setApprovalForAll for OTC listings
export const ERC721_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "getApproved", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;
