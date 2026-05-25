/**
 * Zerion API — token metadata & charts (Monad supported).
 * @see https://developers.zerion.io/api-reference
 */

const MONAD_CHAIN = "monad";

export type ZerionTokenMeta = {
  address: string;
  name: string;
  symbol: string;
  logoURI: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  volume24hUsd: number | null;
};

type ZerionFungibleResponse = {
  data?: {
    attributes?: {
      name?: string;
      symbol?: string;
      icon?: { url?: string | null };
      market_data?: {
        price?: number | null;
        changes?: { percent_1d?: number | null };
        trading_volumes?: { volume_1d?: number | null };
      };
    };
  };
};

type ZerionChartResponse = {
  data?: {
    attributes?: {
      points?: [number, number][];
    };
  };
};

function resolveZerionUrl(path: string, params?: Record<string, string>): string {
  const qs = new URLSearchParams({ path });
  if (params) {
    for (const [k, v] of Object.entries(params)) qs.set(k, v);
  }
  return `/api/zerion?${qs.toString()}`;
}

async function fetchZerionJson<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(resolveZerionUrl(path, params), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function zerionImplementation(address: string): string {
  const a = address.toLowerCase();
  if (!a || a === "0x0000000000000000000000000000000000000000") return MONAD_CHAIN;
  return `${MONAD_CHAIN}:${a}`;
}

/** Token name, symbol, icon, price, 24h change from Zerion fungibles API. */
export async function fetchZerionTokenMeta(address: string): Promise<ZerionTokenMeta | null> {
  const impl = zerionImplementation(address);
  const json = await fetchZerionJson<ZerionFungibleResponse>("/v1/fungibles/by-implementation", {
    implementation: impl,
    currency: "usd",
  });
  const attrs = json?.data?.attributes;
  if (!attrs?.symbol) return null;

  const key = address.toLowerCase();
  const md = attrs.market_data;
  return {
    address: key,
    name: attrs.name?.trim() || attrs.symbol,
    symbol: attrs.symbol,
    logoURI: attrs.icon?.url ?? null,
    priceUsd: md?.price != null && md.price > 0 ? md.price : null,
    priceChange24h:
      md?.changes?.percent_1d != null && Number.isFinite(md.changes.percent_1d)
        ? md.changes.percent_1d
        : null,
    volume24hUsd:
      md?.trading_volumes?.volume_1d != null && md.trading_volumes.volume_1d > 0
        ? md.trading_volumes.volume_1d
        : null,
  };
}

/** Price/volume chart points for a token (hour = ~24 points, day = longer). */
export async function fetchZerionTokenChart(
  address: string,
  period: "hour" | "day" | "week" = "hour",
): Promise<number[]> {
  const impl = zerionImplementation(address);
  const json = await fetchZerionJson<ZerionChartResponse>(
    `/v1/fungibles/by-implementation/charts/${period}`,
    { implementation: impl, currency: "usd" },
  );
  const points = json?.data?.attributes?.points ?? [];
  return points.map((p) => p[1]).filter((v) => Number.isFinite(v) && v > 0);
}

export type PoolSwapRow = {
  txHash: string;
  sender: string;
  recipient: string;
  type: string;
  timestamp: number;
  amount0: string;
  amount1: string;
};

export async function fetchPoolSwapsFromApi(
  poolAddress: string,
  opts?: { limit?: number; decimals0?: number; decimals1?: number },
): Promise<PoolSwapRow[]> {
  const params = new URLSearchParams({ pool: poolAddress.toLowerCase() });
  params.set("limit", String(opts?.limit ?? 40));
  if (opts?.decimals0 != null) params.set("decimals0", String(opts.decimals0));
  if (opts?.decimals1 != null) params.set("decimals1", String(opts.decimals1));

  const res = await fetch(`/api/clmm/swaps?${params}`, { signal: AbortSignal.timeout(30_000) });
  const json = (await res.json()) as { swaps?: PoolSwapRow[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Swaps API ${res.status}`);
  return json.swaps ?? [];
}
