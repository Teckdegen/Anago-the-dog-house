import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { useContractAddresses } from "./hooks";
import { TOKEN_LOCK_ABI } from "./contracts";
import { bigintToUsd, useMonPrice } from "./prices";
import { ERC20_ABI } from "./tokens";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

// ── Token Lock TVL ────────────────────────────────────────────────────────
export function useLocksTVL(): { usd: number; isLoading: boolean } {
  const { tokenLock } = useContractAddresses();
  const monPrice = useMonPrice();

  // Fetch all unique locked token addresses, then sum active lock amounts per token
  const allTokensQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "allTokens",
    query: { enabled: tokenLock !== ZERO, refetchInterval: 30_000 },
  });

  const tokenAddrs = (allTokensQ.data as `0x${string}`[] | undefined) ?? [];

  // For each token, fetch all lock IDs and then their amounts
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

  // Flatten all lock IDs we need to fetch
  const allLockIds = useMemo(() => {
    if (!lockIdsQ.data) return [] as bigint[];
    return lockIdsQ.data.flatMap((r) =>
      r?.status === "success" ? (r.result as bigint[]) : []
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

  // Aggregate active amounts per token
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

  // Read decimals for each token
  const decimalsReads = useReadContracts({
    allowFailure: true,
    contracts: entries.map((e) => ({
      address: e.token,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
    })),
    query: { enabled: entries.length > 0 },
  });

  const usd = useMemo(() => {
    let total = 0;
    for (let i = 0; i < entries.length; i++) {
      const { token, amount } = entries[i];
      const decimals = (decimalsReads.data?.[i]?.result as number | undefined) ?? 18;
      const isNative = token.toLowerCase() === ZERO;
      const price = isNative ? monPrice : 0;
      total += bigintToUsd(amount, decimals, price);
    }
    return total;
  }, [entries, decimalsReads.data, monPrice]);

  return {
    usd,
    isLoading: allTokensQ.isLoading || lockIdsQ.isLoading || lockDetailsQ.isLoading || decimalsReads.isLoading,
  };
}

export function useVestingTVL(): { usd: number; isLoading: boolean } {
  return { usd: 0, isLoading: false };
}

export function useCLMMTVL(): { usd: number; isLoading: boolean } {
  return { usd: 0, isLoading: false };
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
