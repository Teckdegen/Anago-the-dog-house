import { useAccount, useChainId, useReadContract } from "wagmi";
import { CONTRACTS, STREAM_FARM_ABI } from "@/lib/web3/contracts";
import { LIVE_CHAIN_QUERY } from "@/lib/web3/nftImage";

function streamFarmAddress(chainId: number): `0x${string}` {
  return (CONTRACTS[chainId] ?? CONTRACTS[143]).streamFarm;
}

/** Contract deployer (owner()) — only they can add/remove protocol admins. */
export function useIsStreamFarmOwner() {
  const { address } = useAccount();
  const chainId = useChainId();
  const streamFarm = streamFarmAddress(chainId);

  const q = useReadContract({
    address: streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "owner",
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 30_000 },
  });

  const owner = q.data as `0x${string}` | undefined;
  const isOwner = !!address && !!owner && owner.toLowerCase() === address.toLowerCase();

  return {
    isOwner,
    owner,
    isLoading: q.isLoading,
  };
}

/** On-chain StreamFarm protocol admin (owner or admins mapping). */
export function useIsStreamFarmAdmin() {
  const { address } = useAccount();
  const chainId = useChainId();
  const streamFarm = streamFarmAddress(chainId);

  const q = useReadContract({
    address: streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 },
  });

  return {
    isAdmin: q.data === true,
    isLoading: !!address && q.isLoading,
    isFetched: q.isFetched,
  };
}

/** Whitelisted farm creator (or protocol admin / owner). */
export function useIsFarmOperator() {
  const { address } = useAccount();
  const chainId = useChainId();
  const streamFarm = streamFarmAddress(chainId);

  const q = useReadContract({
    address: streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "isFarmOperator",
    args: address ? [address] : undefined,
    query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 },
  });

  return {
    isFarmOperator: q.data === true,
    isLoading: !!address && q.isLoading,
    isFetched: q.isFetched,
  };
}
