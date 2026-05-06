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
    // Platform token for pool creation fees
    {
      address: "0xa1D67bD149d47d17421c0A558e88E1cf3f8cf541", // HOUSE - Dog House Token
      symbol: "HOUSE",
      name: "Dog House Token",
      decimals: 18,
    },
    // Mock tokens for farm testing - real deployed addresses
    {
      address: "0x39171AC03b8e14EeE61791E06a492b98a7ec7983", // DOG - Dog Coin
      symbol: "DOG",
      name: "Dog Coin",
      decimals: 18,
    },
    {
      address: "0xAA4162ED4120990695a6eb9A6F936F43B36b3727", // BONE - Bone Token
      symbol: "BONE", 
      name: "Bone Token",
      decimals: 18,
    },
    {
      address: "0xBCF1D8725a3887443367653C11D1325d3CE6cCd2", // TREAT - Treat Token
      symbol: "TREAT",
      name: "Treat Token", 
      decimals: 6,
    },
    {
      address: "0x1ef349548eb2b6dA9Feef726F76629177205480d", // PAW - Paw Points
      symbol: "PAW",
      name: "Paw Points",
      decimals: 18,
    },
    {
      address: "0xa7378E467bf4B3d789e9f3509474D4A33390127e", // WOOF - Woof Rewards
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
