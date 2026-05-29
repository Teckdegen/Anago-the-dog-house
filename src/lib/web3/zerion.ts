/**
 * Zerion API — wallet balances, portfolio, token metadata & charts (Monad supported).
 * @see https://developers.zerion.io/api-reference
 */

import type { TokenBalance } from "./tokenBalances";

const MONAD_CHAIN = "monad";
const NATIVE = "0x0000000000000000000000000000000000000000";

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

// ── Wallet portfolio & positions ───────────────────────────────────────────

type ZerionPortfolioResponse = {
  data?: {
    attributes?: {
      total?: { positions?: number | null };
      changes?: { percent_1d?: number | null; absolute_1d?: number | null };
      positions_distribution_by_type?: Record<string, number | null>;
    };
  };
};

type ZerionPositionQuantity = {
  float?: number;
  decimals?: number;
  int?: string;
};

type ZerionPositionItem = {
  attributes?: {
    position_type?: string;
    quantity?: ZerionPositionQuantity;
    value?: number | null;
    price?: number | null;
    fungible_info?: {
      symbol?: string;
      name?: string;
      icon?: { url?: string | null };
      implementations?: { chain_id?: string; address?: string | null }[];
    };
  };
};

type ZerionPositionsResponse = {
  data?: ZerionPositionItem[];
  links?: { next?: string | null };
};

export type ZerionWalletSnapshot = {
  totalUsd: number;
  change24hPct: number | null;
  balances: TokenBalance[];
  /** lowercased token address → USD price */
  priceByToken: Map<string, number>;
  /** lowercased token address → decimals */
  decimalsByToken: Map<string, number>;
};

function formatBalanceFromFloat(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  if (amount >= 1) return amount.toFixed(Math.min(6, decimals)).replace(/\.?0+$/, "");
  return amount.toPrecision(4).replace(/\.?0+$/, "");
}

function quantityToBalance(qty: ZerionPositionQuantity | undefined, decimals: number): bigint {
  if (qty?.int) {
    try {
      return BigInt(qty.int);
    } catch {
      /* fall through */
    }
  }
  const f = qty?.float;
  if (f == null || !Number.isFinite(f) || f <= 0) return 0n;
  const scaled = Math.round(f * 10 ** decimals);
  return BigInt(scaled);
}

function tokenAddressFromPosition(item: ZerionPositionItem): string {
  const impls = item.attributes?.fungible_info?.implementations ?? [];
  const monad = impls.find((i) => i.chain_id === MONAD_CHAIN) ?? impls[0];
  const addr = monad?.address?.trim().toLowerCase();
  if (!addr) return NATIVE;
  return addr;
}

function mapZerionPosition(item: ZerionPositionItem): TokenBalance | null {
  const attrs = item.attributes;
  if (!attrs) return null;

  const decimals = attrs.quantity?.decimals ?? 18;
  const floatQty = attrs.quantity?.float ?? 0;
  if (floatQty <= 0 && !attrs.quantity?.int) return null;

  const address = tokenAddressFromPosition(item) as `0x${string}`;
  const balance = quantityToBalance(attrs.quantity, decimals);
  if (balance <= 0n) return null;

  const fi = attrs.fungible_info;
  const usdValue =
    attrs.value != null && Number.isFinite(attrs.value) && attrs.value > 0 ? attrs.value : null;
  const priceUsd =
    attrs.price != null && attrs.price > 0
      ? attrs.price
      : usdValue != null && floatQty > 0
        ? usdValue / floatQty
        : null;

  return {
    address,
    symbol: fi?.symbol?.trim() || (address === NATIVE ? "MON" : address.slice(2, 6).toUpperCase()),
    name: fi?.name?.trim() || fi?.symbol || "Token",
    decimals,
    logoURI: fi?.icon?.url ?? undefined,
    balance,
    balanceFormatted: formatBalanceFromFloat(floatQty, decimals),
    usdValue,
  };
}

async function fetchZerionPositionsPage(
  address: string,
  extraParams?: Record<string, string>,
): Promise<ZerionPositionsResponse | null> {
  return fetchZerionJson<ZerionPositionsResponse>(
    `/v1/wallets/${address.toLowerCase()}/positions/`,
    {
      currency: "usd",
      "filter[positions]": "no_filter",
      "filter[chain_ids]": MONAD_CHAIN,
      "filter[trash]": "only_non_trash",
      sort: "-value",
      ...extraParams,
    },
  );
}

/** All Monad wallet + DeFi positions with balances and USD values. */
export async function fetchZerionWalletPositions(
  address: string,
): Promise<TokenBalance[]> {
  const items: ZerionPositionItem[] = [];
  let json = await fetchZerionPositionsPage(address);
  let guard = 0;

  while (json?.data?.length && guard < 10) {
    items.push(...json.data);
    const next = json.links?.next;
    if (!next) break;
    try {
      const nextUrl = new URL(next);
      const after = nextUrl.searchParams.get("page[after]");
      if (!after) break;
      json = await fetchZerionPositionsPage(address, { "page[after]": after });
    } catch {
      break;
    }
    guard++;
  }

  const balances: TokenBalance[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const mapped = mapZerionPosition(item);
    if (!mapped) continue;
    const key = mapped.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    balances.push(mapped);
  }

  return balances.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));
}

/** Portfolio total USD + 24h change from Zerion. */
export async function fetchZerionWalletPortfolio(
  address: string,
): Promise<{ totalUsd: number; change24hPct: number | null } | null> {
  const json = await fetchZerionJson<ZerionPortfolioResponse>(
    `/v1/wallets/${address.toLowerCase()}/portfolio`,
    {
      currency: "usd",
      "filter[positions]": "no_filter",
    },
  );
  const attrs = json?.data?.attributes;
  const total = attrs?.total?.positions;
  if (total == null || !Number.isFinite(total)) return null;
  const pct = attrs?.changes?.percent_1d;
  return {
    totalUsd: total,
    change24hPct:
      pct != null && Number.isFinite(pct) ? pct : null,
  };
}

/** Balances + price map + portfolio total for dashboard / pickers. */
export async function fetchZerionWalletSnapshot(
  address: string,
): Promise<ZerionWalletSnapshot | null> {
  const [balances, portfolio] = await Promise.all([
    fetchZerionWalletPositions(address),
    fetchZerionWalletPortfolio(address),
  ]);

  if (balances.length === 0 && !portfolio) return null;

  const priceByToken = new Map<string, number>();
  const decimalsByToken = new Map<string, number>();

  for (const t of balances) {
    const key = t.address.toLowerCase();
    decimalsByToken.set(key, t.decimals);
    if (t.usdValue != null && t.balance > 0n) {
      const human = Number(t.balance) / 10 ** t.decimals;
      if (human > 0) priceByToken.set(key, t.usdValue / human);
    }
  }

  const summed = balances.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  const totalUsd = portfolio?.totalUsd ?? summed;

  return {
    totalUsd,
    change24hPct: portfolio?.change24hPct ?? null,
    balances,
    priceByToken,
    decimalsByToken,
  };
}

/** USD price for a token via Zerion fungibles (used when not in wallet positions). */
export async function fetchZerionTokenPriceUsd(address: string): Promise<number | null> {
  const meta = await fetchZerionTokenMeta(address);
  return meta?.priceUsd ?? null;
}

/** Batch Zerion prices for lock/vest valuation. */
export async function fetchZerionTokenPrices(
  addresses: string[],
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];

  await Promise.all(
    unique.map(async (addr) => {
      const p = await fetchZerionTokenPriceUsd(addr);
      if (p != null && p > 0) prices.set(addr, p);
    }),
  );

  return prices;
}
