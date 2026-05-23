import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { CONTRACTS, STREAM_FARM_ABI } from "@/lib/web3/contracts";
import {
  fetchUserPositions,
  getMonadPublicClient,
  isUniswapSupportedChain,
  type LpPosition,
} from "@/lib/uniswap";

export function useFarmPositionCount(): { count: number; farmCount: number; isLoading: boolean } {
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = CONTRACTS[chainId] ?? CONTRACTS[10143];

  const farmCountQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "farmCount",
    query: { refetchInterval: 15_000 },
  });

  const positionsQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "positionsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const positions = (positionsQ.data as bigint[] | undefined) ?? [];

  return {
    count: positions.length,
    farmCount: Number(farmCountQ.data ?? 0),
    isLoading: farmCountQ.isLoading || (!!address && positionsQ.isLoading),
  };
}

export function useClmmPositionCount(): { count: number; isLoading: boolean; positions: LpPosition[] } {
  const chainId = useChainId();
  const { address } = useAccount();
  const supported = isUniswapSupportedChain(chainId);
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [isLoading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address || !supported) {
      setPositions([]);
      return;
    }
    setLoading(true);
    try {
      const client = getMonadPublicClient();
      setPositions(await fetchUserPositions(client, address));
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [address, supported]);

  useEffect(() => {
    refresh();
    if (!address || !supported) return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh, address, supported]);

  return { count: positions.length, isLoading, positions };
}
