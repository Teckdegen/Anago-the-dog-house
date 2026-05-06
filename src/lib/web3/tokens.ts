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
  // Monad testnet — native token + some popular testnet tokens
  10143: [
    NATIVE,
    // Add some common testnet tokens here - you can update these addresses
    // with actual deployed token contracts on Monad testnet
    {
      address: "0x1234567890123456789012345678901234567890", // Example USDC
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    {
      address: "0x2345678901234567890123456789012345678901", // Example USDT  
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
    {
      address: "0x3456789012345678901234567890123456789012", // Example WETH
      symbol: "WETH",
      name: "Wrapped Ether",
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
