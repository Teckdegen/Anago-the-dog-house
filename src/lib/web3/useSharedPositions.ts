import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { STREAM_FARM_ABI, TOKEN_LOCK_ABI, VESTING_NFT_ABI } from "./contracts";
import { useContractAddresses } from "./hooks";
import { parseLockTuple, resolveLockOwner } from "./parseLock";
import type { LockView, VestingView } from "./hooks";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const POLL = 10_000 as const;

export function useSharedLock(lockId: bigint | undefined): {
  lock: LockView | null;
  loading: boolean;
  notFound: boolean;
} {
  const { tokenLock } = useContractAddresses();
  const enabled = lockId !== undefined && tokenLock !== ZERO;

  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts:
      enabled && lockId !== undefined
        ? [
            { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "getLock" as const, args: [lockId] as const },
            { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "ownerOf" as const, args: [lockId] as const },
          ]
        : [],
    query: { enabled, refetchInterval: POLL },
  });

  const lock = useMemo<LockView | null>(() => {
    if (lockId === undefined || !detailsQ.data) return null;
    const lockRes = detailsQ.data[0];
    const ownerRes = detailsQ.data[1];
    if (lockRes?.status !== "success") return null;
    const r = parseLockTuple(lockRes.result);
    if (!r) return null;
    const owner = resolveLockOwner(ownerRes?.status === "success" ? ownerRes.result : undefined);
    return {
      id: lockId,
      token: r.token,
      owner,
      amount: r.amount,
      unlockAt: r.unlockAt,
      createdAt: r.createdAt,
      withdrawn: r.withdrawn,
    };
  }, [detailsQ.data, lockId]);

  const loading = enabled && detailsQ.isLoading;
  const notFound = enabled && !loading && lock === null;

  return { lock, loading, notFound };
}

export function useSharedVesting(vestingId: bigint | undefined): {
  vesting: VestingView | null;
  loading: boolean;
  notFound: boolean;
} {
  const { vestingNFT } = useContractAddresses();
  const enabled = vestingId !== undefined && vestingNFT !== ZERO;

  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts:
      enabled && vestingId !== undefined
        ? [
            { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "getVesting" as const, args: [vestingId] as const },
            { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "claimableAmount" as const, args: [vestingId] as const },
          ]
        : [],
    query: { enabled, refetchInterval: POLL },
  });

  const vesting = useMemo<VestingView | null>(() => {
    if (vestingId === undefined || !detailsQ.data) return null;
    const vestRes = detailsQ.data[0];
    const claimRes = detailsQ.data[1];
    if (vestRes?.status !== "success") return null;
    const v = vestRes.result as {
      token: `0x${string}`;
      totalAmount: bigint;
      startTime: bigint;
      duration: bigint;
      cliffDuration: bigint;
      claimed: bigint;
      revoked: boolean;
    };
    const claimable = claimRes?.status === "success" ? (claimRes.result as bigint) : 0n;
    return { id: vestingId, ...v, claimable };
  }, [detailsQ.data, vestingId]);

  const loading = enabled && detailsQ.isLoading;
  const notFound = enabled && !loading && vesting === null;

  return { vesting, loading, notFound };
}

/** Returns true if the position NFT still exists on StreamFarm. */
export function useSharedFarmPositionExists(tokenId: bigint | undefined): {
  exists: boolean;
  loading: boolean;
} {
  const { streamFarm } = useContractAddresses();
  const enabled = tokenId !== undefined && streamFarm !== ZERO;

  const ownerQ = useReadContract({
    address: streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled, refetchInterval: POLL },
  });

  const loading = enabled && ownerQ.isLoading;
  const exists = enabled && ownerQ.isSuccess && !!ownerQ.data;
  const notFound = enabled && !loading && !exists;

  return { exists, loading, notFound };
}
