/**
 * Curated fallback token list per chain.
 * Used as a seed — the live hook discovers tokens from on-chain transfer
 * history via the block explorer API and merges them with this list.
 */
export type TokenInfo = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
};

const NATIVE: TokenInfo = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "MON",
  name: "Monad",
  decimals: 18,
};

export const TOKEN_LISTS: Record<number, TokenInfo[]> = {
  // Monad testnet — native token + mock tokens for testing
  10143: [
    NATIVE,
    // Mock tokens for farm testing - update these addresses after deployment
    {
      address: "0x1111111111111111111111111111111111111111", // DOG - Dog Coin
      symbol: "DOG",
      name: "Dog Coin",
      decimals: 18,
    },
    {
      address: "0x2222222222222222222222222222222222222222", // BONE - Bone Token
      symbol: "BONE", 
      name: "Bone Token",
      decimals: 18,
    },
    {
      address: "0x3333333333333333333333333333333333333333", // TREAT - Treat Token
      symbol: "TREAT",
      name: "Treat Token", 
      decimals: 6,
    },
    {
      address: "0x4444444444444444444444444444444444444444", // PAW - Paw Points
      symbol: "PAW",
      name: "Paw Points",
      decimals: 18,
    },
    {
      address: "0x5555555555555555555555555555555555555555", // WOOF - Woof Rewards
      symbol: "WOOF",
      name: "Woof Rewards", 
      decimals: 18,
    },
  ],
};

export function getTokenList(chainId: number): TokenInfo[] {
  return TOKEN_LISTS[chainId] ?? [];
}

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;
