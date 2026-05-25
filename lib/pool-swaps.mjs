/**
 * Fetch Uniswap V3-style Swap events for a Capricorn CL pool (server / API).
 */

import { createPublicClient, decodeEventLog, formatUnits, http, parseAbiItem } from "viem";

const MONAD_CHAIN = {
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
};

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);

const ERC20_DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
];

const POOL_TOKENS_ABI = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];

function absBigint(n) {
  return n < 0n ? -n : n;
}

function formatAmount(raw, decimals) {
  const human = formatUnits(absBigint(raw), decimals);
  const n = parseFloat(human);
  if (!Number.isFinite(n)) return human;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

/**
 * @param {`0x${string}`} poolAddress
 * @param {{ rpcUrl?: string; limit?: number; decimals0?: number; decimals1?: number }} opts
 */
export async function fetchPoolSwaps(poolAddress, opts = {}) {
  const rpc = opts.rpcUrl ?? process.env.RPC_URL ?? process.env.VITE_MONAD_RPC_URL ?? "https://rpc.monad.xyz";
  const limit = Math.min(60, Math.max(1, opts.limit ?? 40));
  const pool = poolAddress.toLowerCase();

  const client = createPublicClient({
    chain: MONAD_CHAIN,
    transport: http(rpc, { retryCount: 2, timeout: 20_000 }),
  });

  let decimals0 = opts.decimals0;
  let decimals1 = opts.decimals1;
  let token0 = opts.token0;
  let token1 = opts.token1;

  if (token0 == null || token1 == null || decimals0 == null || decimals1 == null) {
    const [t0, t1] = await Promise.all([
      client.readContract({ address: pool, abi: POOL_TOKENS_ABI, functionName: "token0" }),
      client.readContract({ address: pool, abi: POOL_TOKENS_ABI, functionName: "token1" }),
    ]);
    token0 = t0;
    token1 = t1;
    if (decimals0 == null) {
      decimals0 = Number(
        await client.readContract({ address: t0, abi: ERC20_DECIMALS_ABI, functionName: "decimals" }),
      );
    }
    if (decimals1 == null) {
      decimals1 = Number(
        await client.readContract({ address: t1, abi: ERC20_DECIMALS_ABI, functionName: "decimals" }),
      );
    }
  }

  const latest = await client.getBlockNumber();
  const window = 120_000n;
  const chunk = 20_000n;
  const from = latest > window ? latest - window : 0n;

  const rawLogs = [];
  for (let start = from; start <= latest; start += chunk) {
    const end = start + chunk - 1n > latest ? latest : start + chunk - 1n;
    try {
      const batch = await client.getLogs({
        address: pool,
        event: SWAP_EVENT,
        fromBlock: start,
        toBlock: end,
      });
      rawLogs.push(...batch);
    } catch {
      /* skip chunk on RPC limit */
    }
  }

  const byKey = new Map();
  for (const log of rawLogs) {
    const key = `${log.transactionHash}-${log.logIndex}`;
    if (!byKey.has(key)) byKey.set(key, log);
  }

  const sorted = [...byKey.values()].sort((a, b) => {
    const bn = Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n));
    if (bn !== 0) return bn;
    return Number((b.logIndex ?? 0) - (a.logIndex ?? 0));
  });

  const blocksNeeded = new Set(sorted.slice(0, limit).map((l) => l.blockNumber));
  const blockTimes = new Map();
  await Promise.all(
    [...blocksNeeded].map(async (bn) => {
      try {
        const block = await client.getBlock({ blockNumber: bn });
        blockTimes.set(bn, Number(block.timestamp));
      } catch {
        blockTimes.set(bn, 0);
      }
    }),
  );

  const swaps = [];
  for (const log of sorted.slice(0, limit)) {
    try {
      const { args } = decodeEventLog({ abi: [SWAP_EVENT], data: log.data, topics: log.topics });
      const amount0 = args.amount0;
      const amount1 = args.amount1;
      const type =
        amount0 > 0n && amount1 < 0n ? "buy" : amount0 < 0n && amount1 > 0n ? "sell" : "swap";

      swaps.push({
        txHash: log.transactionHash,
        sender: args.sender,
        recipient: args.recipient,
        type,
        timestamp: blockTimes.get(log.blockNumber) ?? 0,
        amount0: formatAmount(amount0, decimals0),
        amount1: formatAmount(amount1, decimals1),
        amount0Raw: amount0.toString(),
        amount1Raw: amount1.toString(),
        blockNumber: Number(log.blockNumber),
      });
    } catch {
      /* skip bad log */
    }
  }

  return { swaps, token0, token1, decimals0, decimals1 };
}
