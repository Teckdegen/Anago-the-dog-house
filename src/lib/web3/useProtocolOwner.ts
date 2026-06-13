import { useAccount, useChainId, useReadContracts } from "wagmi";
import {
  CONTRACTS,
  OTC_MARKET_ABI,
  STREAM_FARM_ABI,
  TOKEN_LOCK_ABI,
  VESTING_NFT_ABI,
} from "@/lib/web3/contracts";
import { LIVE_CHAIN_QUERY } from "@/lib/web3/nftImage";

function sameAddr(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** True when the connected wallet is `owner()` on any protocol contract. */
export function useIsProtocolOwner() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { streamFarm, tokenLock, vestingNFT, otcMarket } = CONTRACTS[chainId] ?? CONTRACTS[143];

  const q = useReadContracts({
    contracts: [
      { address: streamFarm, abi: STREAM_FARM_ABI, functionName: "owner" },
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "owner" },
      { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "owner" },
      { address: otcMarket, abi: OTC_MARKET_ABI, functionName: "owner" },
    ],
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 15_000 },
  });

  const streamOwner = q.data?.[0]?.result as string | undefined;
  const lockOwner = q.data?.[1]?.result as string | undefined;
  const vestOwner = q.data?.[2]?.result as string | undefined;
  const otcOwner = q.data?.[3]?.result as string | undefined;

  const isStreamOwner = sameAddr(address, streamOwner);
  const isLockOwner = sameAddr(address, lockOwner);
  const isVestOwner = sameAddr(address, vestOwner);
  const isOtcOwner = sameAddr(address, otcOwner);
  const isProtocolOwner = isStreamOwner || isLockOwner || isVestOwner || isOtcOwner;

  return {
    isProtocolOwner,
    isStreamOwner,
    isLockOwner,
    isVestOwner,
    isOtcOwner,
    streamOwner,
    lockOwner,
    vestOwner,
    otcOwner,
    isLoading: q.isLoading,
  };
}
