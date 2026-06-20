import { useMemo } from "react";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS, STREAM_FARM_ABI } from "@/lib/web3/contracts";
import { LIVE_CHAIN_QUERY } from "@/lib/web3/nftImage";

function useStreamFarmAddress() {
  const chainId = useChainId();
  return (CONTRACTS[chainId] ?? CONTRACTS[143]).streamFarm;
}

/**
 * Scans active position NFTs and counts unique stakers per farm.
 * Uses ownerOf + getPosition multicalls (burned IDs are skipped via allowFailure).
 */
export function useFarmStakerCounts() {
  const streamFarm = useStreamFarmAddress();

  const nextIdQ = useReadContract({
    address: streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "nextTokenId",
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 30_000 },
  });

  const nextId = Number(nextIdQ.data ?? 0n);

  const ownerReads = useReadContracts({
    allowFailure: true,
    contracts: Array.from({ length: nextId }, (_, i) => ({
      address: streamFarm,
      abi: STREAM_FARM_ABI,
      functionName: "ownerOf" as const,
      args: [BigInt(i)] as const,
    })),
    query: { ...LIVE_CHAIN_QUERY, enabled: nextId > 0, refetchInterval: 30_000 },
  });

  const activeTokenIds = useMemo(() => {
    if (!ownerReads.data) return [];
    return ownerReads.data
      .map((r, i) => (r.status === "success" ? i : -1))
      .filter((i) => i >= 0);
  }, [ownerReads.data]);

  const positionReads = useReadContracts({
    allowFailure: true,
    contracts: activeTokenIds.map((id) => ({
      address: streamFarm,
      abi: STREAM_FARM_ABI,
      functionName: "getPosition" as const,
      args: [BigInt(id)] as const,
    })),
    query: {
      ...LIVE_CHAIN_QUERY,
      enabled: activeTokenIds.length > 0,
      refetchInterval: 30_000,
    },
  });

  const countsByFarm = useMemo(() => {
    const ownersByFarm = new Map<number, Set<string>>();
    if (!positionReads.data || !ownerReads.data) return ownersByFarm;

    activeTokenIds.forEach((tokenId, idx) => {
      const posResult = positionReads.data?.[idx];
      const ownerResult = ownerReads.data?.[tokenId];
      if (posResult?.status !== "success" || ownerResult?.status !== "success") return;

      const [farmId, amount] = posResult.result as readonly [bigint, bigint, ...unknown[]];
      if (amount === 0n) return;

      const farmKey = Number(farmId);
      const owner = (ownerResult.result as string).toLowerCase();
      if (!ownersByFarm.has(farmKey)) ownersByFarm.set(farmKey, new Set());
      ownersByFarm.get(farmKey)!.add(owner);
    });

    return ownersByFarm;
  }, [activeTokenIds, positionReads.data, ownerReads.data]);

  const loading =
    nextIdQ.isLoading ||
    (nextId > 0 && (ownerReads.isLoading || (activeTokenIds.length > 0 && positionReads.isLoading)));

  const getStakerCount = (farmId: number): number | undefined => {
    if (loading) return undefined;
    return countsByFarm.get(farmId)?.size ?? 0;
  };

  return { getStakerCount, loading };
}
