import type { PublicClient } from "viem";
import { parseAbiItem } from "viem";
import { UNISWAP_V3 } from "./addresses";
import { FACTORY_ABI, NPM_ABI } from "./abis";
import { fetchTokenMeta } from "./poolState";

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const LOOKBACK = 400_000n;
const CHUNK = 50_000n;

export type LpPosition = {
  tokenId: bigint;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  poolAddress: `0x${string}`;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
};

function positionCacheKey(user: string) {
  return `uniswap_v3_position_ids_${user.toLowerCase()}`;
}

export function loadCachedPositionIds(user: `0x${string}`): bigint[] {
  try {
    const raw = localStorage.getItem(positionCacheKey(user));
    if (!raw) return [];
    return (JSON.parse(raw) as string[]).map((id) => BigInt(id));
  } catch {
    return [];
  }
}

export function saveCachedPositionIds(user: `0x${string}`, ids: bigint[]) {
  localStorage.setItem(
    positionCacheKey(user),
    JSON.stringify(ids.map((id) => id.toString())),
  );
}

export async function discoverPositionTokenIds(
  client: PublicClient,
  user: `0x${string}`,
  onProgress?: (msg: string) => void,
): Promise<bigint[]> {
  const latest = await client.getBlockNumber();
  const from = latest > LOOKBACK ? latest - LOOKBACK : 0n;
  const npm = UNISWAP_V3.positionManager;

  const received = new Set<string>();
  const sent = new Set<string>();

  for (let start = from; start <= latest; start += CHUNK + 1n) {
    const end = start + CHUNK > latest ? latest : start + CHUNK;
    onProgress?.(`Scanning LP NFTs ${start.toString()}–${end.toString()}…`);

    const [toLogs, fromLogs] = await Promise.all([
      client.getLogs({
        address: npm,
        event: TRANSFER,
        args: { to: user },
        fromBlock: start,
        toBlock: end,
      }),
      client.getLogs({
        address: npm,
        event: TRANSFER,
        args: { from: user },
        fromBlock: start,
        toBlock: end,
      }),
    ]);

    for (const log of toLogs) {
      if (log.args.tokenId != null) received.add(log.args.tokenId.toString());
    }
    for (const log of fromLogs) {
      if (log.args.tokenId != null) sent.add(log.args.tokenId.toString());
    }
  }

  const candidateIds = [...received].filter((id) => !sent.has(id)).map((id) => BigInt(id));
  const cached = loadCachedPositionIds(user).map((id) => id.toString());
  const merged = new Set([...candidateIds.map((id) => id.toString()), ...cached]);

  const owned: bigint[] = [];
  for (const idStr of merged) {
    const tokenId = BigInt(idStr);
    try {
      const owner = (await client.readContract({
        address: npm,
        abi: NPM_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      })) as `0x${string}`;
      if (owner.toLowerCase() === user.toLowerCase()) owned.push(tokenId);
    } catch {
      /* burned or invalid */
    }
  }

  saveCachedPositionIds(user, owned);
  return owned;
}

export async function fetchLpPosition(
  client: PublicClient,
  tokenId: bigint,
): Promise<LpPosition | null> {
  try {
    const pos = await client.readContract({
      address: UNISWAP_V3.positionManager,
      abi: NPM_ABI,
      functionName: "positions",
      args: [tokenId],
    });

    const token0 = pos[2] as `0x${string}`;
    const token1 = pos[3] as `0x${string}`;
    const fee = Number(pos[4]);
    const poolAddress = (await client.readContract({
      address: UNISWAP_V3.factory,
      abi: FACTORY_ABI,
      functionName: "getPool",
      args: [token0, token1, fee],
    })) as `0x${string}`;

    if (poolAddress === "0x0000000000000000000000000000000000000000") return null;

    const [meta0, meta1] = await Promise.all([
      fetchTokenMeta(client, token0),
      fetchTokenMeta(client, token1),
    ]);

    return {
      tokenId,
      token0,
      token1,
      fee,
      tickLower: Number(pos[5]),
      tickUpper: Number(pos[6]),
      liquidity: pos[7] as bigint,
      tokensOwed0: pos[10] as bigint,
      tokensOwed1: pos[11] as bigint,
      poolAddress,
      token0Symbol: meta0.symbol,
      token1Symbol: meta1.symbol,
      token0Decimals: meta0.decimals,
      token1Decimals: meta1.decimals,
    };
  } catch {
    return null;
  }
}

export async function fetchUserPositions(
  client: PublicClient,
  user: `0x${string}`,
  onProgress?: (msg: string) => void,
): Promise<LpPosition[]> {
  const ids = await discoverPositionTokenIds(client, user, onProgress);
  const positions: LpPosition[] = [];
  for (const id of ids) {
    const p = await fetchLpPosition(client, id);
    if (p && (p.liquidity > 0n || p.tokensOwed0 > 0n || p.tokensOwed1 > 0n)) positions.push(p);
  }
  return positions;
}

export function positionMatchesPool(
  pos: LpPosition,
  poolAddress: `0x${string}`,
): boolean {
  return pos.poolAddress.toLowerCase() === poolAddress.toLowerCase();
}
