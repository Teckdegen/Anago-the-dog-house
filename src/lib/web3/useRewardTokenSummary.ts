import { useEffect, useState } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20_ABI } from "@/lib/web3/contracts";
import { bigintToUsd } from "@/lib/web3/prices";

export type RewardTokenEntry = { token: string; amount: bigint };

/** Human-readable reward amounts per token + optional USD total. */
export function useRewardTokenSummary(entries: RewardTokenEntry[]) {
  const metaQ = useReadContracts({
    allowFailure: true,
    contracts: entries.flatMap((e) => [
      { address: e.token as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" as const },
      { address: e.token as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" as const },
    ]),
    query: { enabled: entries.length > 0, refetchInterval: 10_000 },
  });

  const [totalUsd, setTotalUsd] = useState(0);
  const [loading, setLoading] = useState(entries.length > 0);

  useEffect(() => {
    if (entries.length === 0) {
      setTotalUsd(0);
      setLoading(false);
      return;
    }
    if (!metaQ.data) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { getTokenPriceUsd } = await import("@/lib/web3/dexscreener");
      let sum = 0;

      for (let i = 0; i < entries.length; i++) {
        const { token, amount } = entries[i];
        const dec = (metaQ.data?.[i * 2 + 1]?.result as number | undefined) ?? 18;
        const price = await getTokenPriceUsd(token).catch(() => null);
        sum += bigintToUsd(amount, dec, price ?? 0);
      }

      if (!cancelled) {
        setTotalUsd(sum);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, metaQ.data]);

  const summary = (() => {
    if (entries.length === 0) return "—";
    if (!metaQ.data) return "…";

    const parts: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const sym = (metaQ.data[i * 2]?.result as string | undefined) ?? "…";
      const dec = (metaQ.data[i * 2 + 1]?.result as number | undefined) ?? 18;
      const formatted = Number(formatUnits(entries[i].amount, dec)).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      });
      parts.push(`${formatted} ${sym}`);
    }

    if (parts.length === 0) {
      const sym = (metaQ.data[0]?.result as string | undefined) ?? "…";
      return `0 ${sym}`;
    }
    return parts.join(" · ");
  })();

  const primarySymbol =
    entries.length === 1 && metaQ.data
      ? ((metaQ.data[0]?.result as string | undefined) ?? undefined)
      : undefined;

  return { summary, totalUsd, loading, primarySymbol };
}
