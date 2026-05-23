/**
 * Capricorn CL on-chain helpers (Node indexer).
 */

import { ethers } from "ethers";

export const CHAIN_ID = Number(process.env.CHAIN_ID ?? 143);
export const FACTORY_ADDRESS = "0x6B5F564339DbAD6b780249827f2198a841FEB7F3";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function tickSpacing() view returns (int24)",
  "function liquidity() view returns (uint128)",
];

const FACTORY_ABI = [
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
];

const tokenCache = new Map();

export function getProvider() {
  const url = process.env.RPC_URL ?? process.env.VITE_MONAD_RPC_URL;
  if (!url) throw new Error("RPC_URL not configured");
  return new ethers.JsonRpcProvider(url);
}

export async function getToken(provider, address) {
  const addr = address.toLowerCase();
  if (tokenCache.has(addr)) return tokenCache.get(addr);
  const erc20 = new ethers.Contract(addr, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([erc20.symbol(), erc20.decimals()]);
  const meta = { address: addr, symbol, decimals: Number(decimals) };
  tokenCache.set(addr, meta);
  return meta;
}

export async function fetchPoolRow(provider, poolAddress) {
  const addr = poolAddress.toLowerCase();
  const pool = new ethers.Contract(addr, POOL_ABI, provider);
  const [t0, t1, fee, tickSpacing, liquidity] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.fee(),
    pool.tickSpacing(),
    pool.liquidity(),
  ]);
  const [tok0, tok1] = await Promise.all([getToken(provider, t0), getToken(provider, t1)]);
  return {
    address: addr,
    token0: t0.toLowerCase(),
    token1: t1.toLowerCase(),
    symbol0: tok0.symbol,
    symbol1: tok1.symbol,
    fee: Number(fee),
    tick_spacing: Number(tickSpacing),
    liquidity: liquidity.toString(),
  };
}

export async function discoverPoolsFromFactory(provider, fromBlock, toBlock) {
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const logs = await factory.queryFilter(factory.filters.PoolCreated(), fromBlock, toBlock);
  const addresses = new Set();
  for (const log of logs) {
    const pool = log.args?.pool ?? log.args?.[4];
    if (pool) addresses.add(pool.toLowerCase());
  }
  return [...addresses];
}
