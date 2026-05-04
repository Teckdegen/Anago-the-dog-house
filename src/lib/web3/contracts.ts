/**
 * Deployed contract addresses per chain.
 * Fill in after running the deploy scripts in /contracts.
 */
export const CONTRACTS: Record<
  number,
  { vestingFactory: `0x${string}`; tokenLock: `0x${string}` }
> = {
  // Monad testnet (chainId 10143)
  10143: {
    vestingFactory: "0x83Cfd62A53210139f52DB6451bD0aaBDC71De283",
    tokenLock:      "0x2167d1c0713bcDD77f6932c355EF7A7b983B0299",
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
  {
    type: "function",
    name: "createLock",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "unlockAt", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "extendLock",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "newUnlockAt", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transferLockOwnership",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "newOwner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getLock",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "owner", type: "address" },
          { name: "amount", type: "uint128" },
          { name: "unlockAt", type: "uint64" },
          { name: "createdAt", type: "uint64" },
          { name: "withdrawn", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "totalLocked",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalLockedBy",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
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
  {
    type: "function",
    name: "tokenLeaderboard",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "tokens_", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "userLeaderboard",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "users", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "locksOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
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
    name: "locksLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isUnlocked",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "LockCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "unlockAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LockWithdrawn",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LockExtended",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "oldUnlockAt", type: "uint64", indexed: false },
      { name: "newUnlockAt", type: "uint64", indexed: false },
    ],
  },
] as const;
