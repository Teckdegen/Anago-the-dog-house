import { useEffect, useMemo, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { useContractAddresses } from "./hooks";
import { TOKEN_LOCK_ABI } from "./contracts";
import { bigintToUsd, useMonPrice } from "./prices";
import { ERC20_ABI } from "./tokens";
import { batchGetTokenPrices } from "./dexscreener";
import { loadAllMetricsCache } from "@/lib/capricorn/poolMetricsCache";
import { CAPRICORN_POOL_ADDRESSES } from "@/lib/capricorn/pools";
import { getMonadPublicClient } from "@/lib/capricorn";
import { fetchPoolMetrics } from "@/lib/capricorn/poolMetrics";
import { stubPoolsFromAddresses } from "@/lib/capricorn/pools";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const NATIVE = ZERO;

// ── Token Lock TVL ────────────────────────────────────────────────────────
export function useLocksTVL(): { usd: number; isLoading: boolean } {
  const { tokenLock } = useContractAddresses();
  const monPrice = useMonPrice();

  const allTokensQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "allTokens",
    query: { enabled: tokenLock !== ZERO, refetchInterval: 30_000 },
  });

  const tokenAddrs = (allTokensQ.data as `0x${string}`[] | undefined) ?? [];

  const lockIdsQ = useReadContracts({
    allowFailure: true,
    contracts: tokenAddrs.map((t) => ({
      address: tokenLock,
      abi: TOKEN_LOCK_ABI,
      functionName: "locksOfToken" as const,
      args: [t] as const,
    })),
    query: { enabled: tokenAddrs.length > 0 },
  });

  const allLockIds = useMemo(() => {
    if (!lockIdsQ.data) return [] as bigint[];
    return lockIdsQ.data.flatMap((r) =>
      r?.status === "success" ? (r.result as bigint[]) : [],
    );
  }, [lockIdsQ.data]);

  const lockDetailsQ = useReadContracts({
    allowFailure: true,
    contracts: allLockIds.map((id) => ({
      address: tokenLock,
      abi: TOKEN_LOCK_ABI,
      functionName: "getLock" as const,
      args: [id] as const,
    })),
    query: { enabled: allLockIds.length > 0 },
  });

  const entries = useMemo(() => {
    if (!lockDetailsQ.data) return [] as { token: `0x${string}`; amount: bigint }[];
    const byToken = new Map<`0x${string}`, bigint>();
    lockDetailsQ.data.forEach((r) => {
      if (r?.status !== "success") return;
      const lock = r.result as { token: `0x${string}`; amount: bigint; withdrawn: boolean };
      if (lock.withdrawn) return;
      const key = lock.token.toLowerCase() as `0x${string}`;
      byToken.set(key, (byToken.get(key) ?? 0n) + lock.amount);
    });
    return Array.from(byToken.entries()).map(([token, amount]) => ({ token, amount }));
  }, [lockDetailsQ.data]);

  const decimalsReads = useReadContracts({
    allowFailure: true,
    contracts: entries.map((e) => ({
      address: e.token,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
    })),
    query: { enabled: entries.length > 0 },
  });

  const [tokenPrices, setTokenPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (entries.length === 0) {
      setTokenPrices(new Map());
      return;
    }
    const addrs = entries.map((e) => e.token);
    let cancelled = false;
    batchGetTokenPrices(addrs).then((map) => {
      if (!cancelled) setTokenPrices(map);
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const usd = useMemo(() => {
    let total = 0;
    for (let i = 0; i < entries.length; i++) {
      const { token, amount } = entries[i];
      const decimals = (decimalsReads.data?.[i]?.result as number | undefined) ?? 18;
      const key = token.toLowerCase();
      const price =
        key === NATIVE
          ? monPrice
          : (tokenPrices.get(key) ?? 0);
      total += bigintToUsd(amount, decimals, price);
    }
    return total;
  }, [entries, decimalsReads.data, monPrice, tokenPrices]);

  return {
    usd,
    isLoading:
      allTokensQ.isLoading ||
      lockIdsQ.isLoading ||
      lockDetailsQ.isLoading ||
      decimalsReads.isLoading,
  };
}

export function useVestingTVL(): { usd: number; isLoading: boolean } {
  return { usd: 0, isLoading: false };
}

/** Sum cached + sampled on-chain TVL for Capricorn CL pools (mainnet). */
export function useCLMMTVL(): { usd: number; isLoading: boolean } {
  const [usd, setUsd] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cache = loadAllMetricsCache();
      let sum = 0;
      let cachedCount = 0;
      for (const m of Object.values(cache)) {
        if (m.tvlUsd != null && m.tvlUsd > 0) {
          sum += m.tvlUsd;
          cachedCount++;
        }
      }

      if (cachedCount >= 20) {
        if (!cancelled) {
          setUsd(sum);
          setLoading(false);
        }
        return;
      }

      const client = getMonadPublicClient();
      const sample = stubPoolsFromAddresses().slice(0, 24);
      const results = await Promise.all(
        sample.map(async (pool) => {
          const cached = cache[pool.address.toLowerCase()];
          if (cached?.tvlUsd != null && cached.tvlUsd > 0) return cached.tvlUsd;
          try {
            const m = await fetchPoolMetrics(pool, client, false, { light: true });
            return m.tvlUsd ?? 0;
          } catch {
            return 0;
          }
        }),
      );

      const sampled = results.reduce((a, b) => a + b, 0);
      const scale =
        sample.length > 0 && sampled > 0
          ? (sampled / sample.length) * CAPRICORN_POOL_ADDRESSES.length
          : sum;

      if (!cancelled) {
        setUsd(Math.max(sum, scale));
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { usd, isLoading: loading };
}

export function useFarmTVL(): { usd: number; isLoading: boolean } {
  return { usd: 0, isLoading: false };
}

export function useProtocolTVL(): { usd: number; isLoading: boolean } {
  const locks = useLocksTVL();
  const vesting = useVestingTVL();
  const clmm = useCLMMTVL();
  const farm = useFarmTVL();
  return {
    usd: locks.usd + vesting.usd + clmm.usd + farm.usd,
    isLoading: locks.isLoading || vesting.isLoading || clmm.isLoading || farm.isLoading,
  };
}
