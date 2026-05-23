import type { PublicClient } from "viem";
import { CAPRICORN_CL } from "./addresses";
import { FACTORY_ABI, NPM_ABI } from "./abis";
import { fetchTokenMeta } from "./poolState";
import type { CachedPool } from "./types";
import type { LpPosition } from "./types-positions";

export type { LpPosition } from "./types-positions";

const NPM = CAPRICORN_CL.positionManager as `0x${string}`;
const FACTORY = CAPRICORN_CL.factory as `0x${string}`;

async function resolvePoolAddress(
  client: PublicClient,
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee: number,
): Promise<`0x${string}`> {
  try {
    const pool = (await client.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "getPool",
      args: [token0, token1, fee],
    })) as `0x${string}`;
    if (pool && pool !== "0x0000000000000000000000000000000000000000") {
      return pool.toLowerCase() as `0x${string}`;
    }
  } catch {
    /* ignore */
  }
  return token0;
}

export async function fetchLpPosition(
  client: PublicClient,
  tokenId: bigint,
): Promise<LpPosition | null> {
  try {
    const pos = await client.readContract({
      address: NPM,
      abi: NPM_ABI,
      functionName: "positions",
      args: [tokenId],
    });

    const token0 = pos[2] as `0x${string}`;
    const token1 = pos[3] as `0x${string}`;
    const fee = Number(pos[4]);

    const [meta0, meta1, poolAddress] = await Promise.all([
      fetchTokenMeta(client, token0),
      fetchTokenMeta(client, token1),
      resolvePoolAddress(client, token0, token1, fee),
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
  const balance = (await client.readContract({
    address: NPM,
    abi: NPM_ABI,
    functionName: "balanceOf",
    args: [user],
  })) as bigint;

  const count = Number(balance);
  if (count === 0) return [];

  onProgress?.(`Loading ${count} position(s)…`);

  const ids: bigint[] = [];
  for (let i = 0; i < count; i++) {
    const tokenId = (await client.readContract({
      address: NPM,
      abi: NPM_ABI,
      functionName: "tokenOfOwnerByIndex",
      args: [user, BigInt(i)],
    })) as bigint;
    ids.push(tokenId);
  }

  const positions: LpPosition[] = [];
  for (const id of ids) {
    const p = await fetchLpPosition(client, id);
    if (p && (p.liquidity > 0n || p.tokensOwed0 > 0n || p.tokensOwed1 > 0n)) {
      positions.push(p);
    }
  }
  return positions;
}

export function positionMatchesPool(
  pos: LpPosition,
  poolAddress: `0x${string}`,
  pool?: CachedPool | null,
): boolean {
  if (pos.poolAddress.toLowerCase() === poolAddress.toLowerCase()) return true;
  if (!pool) return false;

  const t0 = pos.token0.toLowerCase();
  const t1 = pos.token1.toLowerCase();
  const c0 = pool.token0.toLowerCase();
  const c1 = pool.token1.toLowerCase();
  const tokensMatch = (t0 === c0 && t1 === c1) || (t0 === c1 && t1 === c0);
  return tokensMatch && pos.fee === pool.fee;
}
