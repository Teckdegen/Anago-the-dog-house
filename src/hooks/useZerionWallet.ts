import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { fetchZerionWalletSnapshot, fetchZerionTokenPrices, type ZerionWalletSnapshot } from "@/lib/web3/zerion";
import { bigintToUsd } from "@/lib/web3/prices";
import { useUserLocks, useUserVestings } from "@/lib/web3/hooks";

const REFRESH_MS = 60_000;

export function useZerionWallet(): {
  snapshot: ZerionWalletSnapshot | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { address } = useAccount();
  const [snapshot, setSnapshot] = useState<ZerionWalletSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        const s = await fetchZerionWalletSnapshot(address);
        if (!cancelled) setSnapshot(s);
      } catch {
        if (!cancelled) setSnapshot(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    const id = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, tick]);

  return { snapshot, isLoading, refetch: () => setTick((n) => n + 1) };
}

/** USD totals for Dog House positions (locks, vesting) using Zerion prices. */
export function useDoghousePositionUsd(): {
  locksUsd: number;
  vestingUsd: number;
  walletUsd: number;
  isLoading: boolean;
} {
  const { locks } = useUserLocks();
  const { vestings } = useUserVestings();
  const { snapshot, isLoading: zerionLoading } = useZerionWallet();
  const [extraPrices, setExtraPrices] = useState<Map<string, number>>(new Map());
  const [extraLoading, setExtraLoading] = useState(false);

  const activeLocks = useMemo(() => locks.filter((l) => !l.withdrawn), [locks]);

  const activeVestings = useMemo(
    () =>
      vestings.filter((v) => {
        const total = BigInt(v.totalAmount || 0);
        const claimed = BigInt(v.claimed || 0);
        return total > claimed && !v.revoked;
      }),
    [vestings],
  );

  const tokensNeedingPrice = useMemo(() => {
    const set = new Set<string>();
    const have = snapshot?.priceByToken ?? new Map<string, number>();
    for (const l of activeLocks) {
      const k = l.token.toLowerCase();
      if (!have.has(k)) set.add(k);
    }
    for (const v of activeVestings) {
      const k = v.token.toLowerCase();
      if (!have.has(k)) set.add(k);
    }
    return [...set];
  }, [activeLocks, activeVestings, snapshot?.priceByToken]);

  useEffect(() => {
    if (tokensNeedingPrice.length === 0) {
      setExtraPrices(new Map());
      return;
    }
    let cancelled = false;
    setExtraLoading(true);
    fetchZerionTokenPrices(tokensNeedingPrice)
      .then((m) => {
        if (!cancelled) setExtraPrices(m);
      })
      .finally(() => {
        if (!cancelled) setExtraLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokensNeedingPrice.join(",")]);

  const priceFor = (token: string, decimals: number) => {
    const key = token.toLowerCase();
    return (
      snapshot?.priceByToken.get(key) ??
      extraPrices.get(key) ??
      0
    );
  };

  const decimalsFor = (token: string) =>
    snapshot?.decimalsByToken.get(token.toLowerCase()) ?? 18;

  const locksUsd = useMemo(() => {
    let total = 0;
    for (const l of activeLocks) {
      const dec = decimalsFor(l.token);
      const price = priceFor(l.token, dec);
      total += bigintToUsd(l.amount, dec, price);
    }
    return total;
  }, [activeLocks, snapshot, extraPrices]);

  const vestingUsd = useMemo(() => {
    let total = 0;
    for (const v of activeVestings) {
      const dec = decimalsFor(v.token);
      const price = priceFor(v.token, dec);
      const totalAmt = BigInt(v.totalAmount || 0);
      const claimed = BigInt(v.claimed || 0);
      const remaining = totalAmt > claimed ? totalAmt - claimed : 0n;
      total += bigintToUsd(remaining, dec, price);
    }
    return total;
  }, [activeVestings, snapshot, extraPrices]);

  return {
    locksUsd,
    vestingUsd,
    walletUsd: snapshot?.totalUsd ?? 0,
    isLoading: zerionLoading || extraLoading,
  };
}
