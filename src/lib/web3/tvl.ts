import { useMemo } from "react";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { useContractAddresses } from "./hooks";
import { TOKEN_LOCK_ABI } from "./contracts";
import { bigintToUsd, useMonPrice } from "./prices";
import { ERC20_ABI } from "./tokens";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

// ── Token Lock TVL ────────────────────────────────────────────────────────
export function useLocksTVL(): { usd: number; isLoading: boolean } {
  const { tokenLock } = useContractAddresses();
  const monPrice = useMonPrice();

  // Get all locked tokens + amounts from leaderboard
  const board = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "tokenLeaderboard",
    args: [0n, 200n],
    query: { enabled: tokenLock !== ZERO, refetchInterval: 30_000 },
  });

  const entries = useMemo(() => {
    const d = board.data as readonly [readonly `0x${string}`[], readonly bigint[]] | undefined;
    if (!d) return [] as { token: `0x${string}`; amount: bigint }[];
    const [addrs, amts] = d;
    return addrs.map((token, i) => ({ token, amount: amts[i] }));
  }, [board.data]);

  // Read decimals for each token on-chain
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
      // Only MON (native) has a price right now; other tokens contribute $0
      // until their price is added to PRICE_MAP
      const isNative = token.toLowerCase() === ZERO;
      const price = isNative ? monPrice : 0;
      total += bigintToUsd(amount, decimals, price);
    }
    return total;
  }, [entries, decimalsReads.data, monPrice]);

  return { usd, isLoading: board.isLoading || decimalsReads.isLoading };
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
