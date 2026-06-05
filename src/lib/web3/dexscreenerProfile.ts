/**
 * DexScreener enhanced token info — bio, socials, website (no price data).
 * @see https://docs.dexscreener.com/api/reference
 */

const CHAIN_ID = "monad";
const TOKENS_V1 = "https://api.dexscreener.com/tokens/v1";
const PROFILE_LATEST = "https://api.dexscreener.com/token-profiles/latest/v1";
const PROFILE_RECENT = "https://api.dexscreener.com/token-profiles/recent-updates/v1";
const CACHE_TTL = 10 * 60 * 1000;
const PROFILE_INDEX_TTL = 10 * 60 * 1000;

export type DexTokenLink = {
  kind: "twitter" | "telegram" | "discord" | "website" | "other";
  label: string;
  url: string;
};

export type DexTokenProfile = {
  address: string;
  name: string | null;
  symbol: string | null;
  description: string | null;
  headerImage: string | null;
  icon: string | null;
  dexscreenerUrl: string | null;
  links: DexTokenLink[];
};

type ProfileIndexEntry = {
  description: string | null;
  links: DexTokenLink[];
  header: string | null;
  icon: string | null;
  dexscreenerUrl: string | null;
};

const profileCache = new Map<string, { data: DexTokenProfile | null; timestamp: number }>();
let profileIndex: Map<string, ProfileIndexEntry> | null = null;
let profileIndexLoadedAt = 0;

function profileKey(address: string): string {
  return `${CHAIN_ID}:${address.toLowerCase()}`;
}

function linkKind(type?: string | null, label?: string | null, url?: string): DexTokenLink["kind"] {
  const t = `${type ?? ""} ${label ?? ""} ${url ?? ""}`.toLowerCase();
  if (t.includes("twitter") || t.includes("x.com") || t === "x") return "twitter";
  if (t.includes("telegram") || t.includes("t.me")) return "telegram";
  if (t.includes("discord")) return "discord";
  if (t.includes("website") || t.includes("http")) return "website";
  return "other";
}

function linkLabel(kind: DexTokenLink["kind"], label?: string | null): string {
  if (label?.trim()) return label.trim();
  switch (kind) {
    case "twitter":
      return "X";
    case "telegram":
      return "Telegram";
    case "discord":
      return "Discord";
    case "website":
      return "Website";
    default:
      return "Link";
  }
}

function addLink(links: DexTokenLink[], seen: Set<string>, raw: { url?: string; type?: string | null; label?: string | null }) {
  const url = raw.url?.trim();
  if (!url || seen.has(url)) return;
  seen.add(url);
  const kind = linkKind(raw.type, raw.label, url);
  links.push({ kind, label: linkLabel(kind, raw.label), url });
}

function mergeLinks(...groups: DexTokenLink[][]): DexTokenLink[] {
  const seen = new Set<string>();
  const out: DexTokenLink[] = [];
  for (const group of groups) {
    for (const link of group) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      out.push(link);
    }
  }
  return out;
}

async function loadProfileIndex(): Promise<Map<string, ProfileIndexEntry>> {
  if (profileIndex && Date.now() - profileIndexLoadedAt < PROFILE_INDEX_TTL) {
    return profileIndex;
  }

  const index = new Map<string, ProfileIndexEntry>();

  try {
    const [latestRes, recentRes] = await Promise.all([
      fetch(PROFILE_LATEST, { signal: AbortSignal.timeout(8000) }),
      fetch(PROFILE_RECENT, { signal: AbortSignal.timeout(8000) }),
    ]);

    const batches: unknown[] = [];
    if (latestRes.ok) batches.push(await latestRes.json());
    if (recentRes.ok) batches.push(await recentRes.json());

    for (const batch of batches) {
      const rows = Array.isArray(batch) ? batch : [];
      for (const row of rows) {
        const chainId = String((row as { chainId?: string }).chainId ?? "");
        const tokenAddress = String((row as { tokenAddress?: string }).tokenAddress ?? "").toLowerCase();
        if (!tokenAddress) continue;
        if (chainId && chainId !== CHAIN_ID) continue;

        const links: DexTokenLink[] = [];
        const seen = new Set<string>();
        for (const l of (row as { links?: Array<{ type?: string; label?: string; url?: string }> }).links ?? []) {
          addLink(links, seen, l);
        }

        const key = profileKey(tokenAddress);
        const description = String((row as { description?: string }).description ?? "").trim() || null;

        index.set(key, {
          description,
          links,
          header: (row as { header?: string }).header?.trim() || null,
          icon: (row as { icon?: string }).icon?.trim() || null,
          dexscreenerUrl: (row as { url?: string }).url?.trim() || null,
        });
      }
    }
  } catch {
    /* index is best-effort for bio */
  }

  profileIndex = index;
  profileIndexLoadedAt = Date.now();
  return index;
}

type PairRow = {
  chainId?: string;
  url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  info?: {
    imageUrl?: string;
    header?: string;
    websites?: Array<{ url?: string; label?: string }>;
    socials?: Array<{ url?: string; type?: string }>;
  };
};

function pickMonadPair(pairs: PairRow[], address: string): { pair: PairRow; isBase: boolean } | null {
  const key = address.toLowerCase();
  const monadPairs = pairs.filter((p) => p.chainId === CHAIN_ID);
  const list = monadPairs.length ? monadPairs : pairs;

  for (const pair of list) {
    if (pair.baseToken?.address?.toLowerCase() === key) return { pair, isBase: true };
    if (pair.quoteToken?.address?.toLowerCase() === key) return { pair, isBase: false };
  }
  return list[0] ? { pair: list[0], isBase: list[0].baseToken?.address?.toLowerCase() === key } : null;
}

function linksFromPairInfo(info?: PairRow["info"]): DexTokenLink[] {
  const links: DexTokenLink[] = [];
  const seen = new Set<string>();
  for (const w of info?.websites ?? []) addLink(links, seen, { url: w.url, label: w.label ?? "Website", type: "website" });
  for (const s of info?.socials ?? []) addLink(links, seen, { url: s.url, type: s.type, label: s.type });
  return links;
}

export async function fetchDexTokenProfile(address: string): Promise<DexTokenProfile | null> {
  const key = address.toLowerCase();
  if (!key || key === "0x0000000000000000000000000000000000000000") return null;

  const cached = profileCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  try {
    const [pairsRes, index] = await Promise.all([
      fetch(`${TOKENS_V1}/${CHAIN_ID}/${key}`, { signal: AbortSignal.timeout(8000) }),
      loadProfileIndex(),
    ]);

    const indexHit = index.get(profileKey(key));
    const pairLinks: DexTokenLink[] = [];
    let name: string | null = null;
    let symbol: string | null = null;
    let headerImage: string | null = indexHit?.header ?? null;
    let icon: string | null = indexHit?.icon ?? null;
    let dexscreenerUrl: string | null = indexHit?.dexscreenerUrl ?? null;

    if (pairsRes.ok) {
      const pairs = (await pairsRes.json()) as PairRow[];
      const picked = Array.isArray(pairs) ? pickMonadPair(pairs, key) : null;
      if (picked) {
        const { pair, isBase } = picked;
        const token = isBase ? pair.baseToken : pair.quoteToken;
        name = token?.name?.trim() || null;
        symbol = token?.symbol?.trim() || null;
        dexscreenerUrl = dexscreenerUrl ?? pair.url?.trim() ?? `https://dexscreener.com/${CHAIN_ID}/${key}`;
        headerImage = headerImage ?? pair.info?.header?.trim() ?? null;
        icon = icon ?? pair.info?.imageUrl?.trim() ?? null;
        pairLinks.push(...linksFromPairInfo(pair.info));
      }
    }

    const description = indexHit?.description ?? null;
    const links = mergeLinks(indexHit?.links ?? [], pairLinks);

    const hasContent =
      !!description?.trim() ||
      links.length > 0 ||
      !!headerImage ||
      !!dexscreenerUrl;

    const data: DexTokenProfile | null = hasContent
      ? {
          address: key,
          name,
          symbol,
          description: description?.trim() || null,
          headerImage,
          icon,
          dexscreenerUrl,
          links,
        }
      : null;

    profileCache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch {
    profileCache.set(key, { data: null, timestamp: Date.now() });
    return null;
  }
}
