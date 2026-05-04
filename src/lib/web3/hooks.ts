import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { CONTRACTS, TOKEN_LOCK_ABI, VESTING_NFT_ABI } from "./contracts";
import { ERC20_ABI, EXPLORER_API, getTokenList, type TokenInfo } from "./tokens";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function useContractAddresses() {
  const chainId = useChainId();
  return CONTRACTS[chainId] ?? CONTRACTS[10143];
}

// ──────────────────────────────────────────────────────────────────────────
//  Token discovery: explorer API + on-chain balanceOf multicall
// ──────────────────────────────────────────────────────────────────────────
export function useUserTokens(): {
  tokens: (TokenInfo & { balance: bigint })[];
  isLoading: boolean;
} {
  const chainId = useChainId();
  const { address } = useAccount();
  const seed = getTokenList(chainId);
  const explorerBase = EXPLORER_API[chainId];

  const [discovered, setDiscovered] = useState<TokenInfo[]>([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    if (!address || !explorerBase) return;
    let cancelled = false;
    setDiscovering(true);
    const url =
      `${explorerBase}?module=account&action=tokentx` +
      `&address=${address}&startblock=0&endblock=99999999&sort=asc`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const txs: { contractAddress: string; tokenSymbol: string; tokenName: string; tokenDecimal: string }[] =
          Array.isArray(json?.result) ? json.result : [];
        const seen = new Map<string, TokenInfo>();
        for (const tx of txs) {
          const addr = tx.contractAddress.toLowerCase() as `0x${string}`;
          if (!seen.has(addr)) {
            seen.set(addr, {
              address: addr,
              symbol: tx.tokenSymbol || addr.slice(0, 6),
              name: tx.tokenName || addr.slice(0, 10),
              decimals: parseInt(tx.tokenDecimal ?? "18", 10) || 18,
            });
          }
        }
        setDiscovered(Array.from(seen.values()));
      })
      .catch(() => { if (!cancelled) setDiscovered([]); })
      .finally(() => { if (!cancelled) setDiscovering(false); });
    return () => { cancelled = true; };
  }, [address, explorerBase]);

  const erc20s = useMemo<TokenInfo[]>(() => {
    const map = new Map<string, TokenInfo>();
    for (const t of seed) if (t.address !== ZERO) map.set(t.address.toLowerCase(), t);
    for (const t of discovered) if (!map.has(t.address.toLowerCase())) map.set(t.address.toLowerCase(), t);
    return Array.from(map.values());
  }, [seed, discovered]);

  const hasNative = seed.some((t) => t.address === ZERO);
  const nativeBal = useBalance({ address, query: { enabled: !!address && hasNative } });
  const reads = useReadContracts({
    allowFailure: true,
    contracts: erc20s.map((t) => ({
      address: t.address,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
    })),
    query: { enabled: !!address && erc20s.length > 0 },
  });

  const tokens = useMemo(() => {
    const result: (TokenInfo & { balance: bigint })[] = [];
    if (hasNative) {
      const native = seed.find((t) => t.address === ZERO)!;
      result.push({ ...native, balance: nativeBal.data?.value ?? 0n });
    }
    erc20s.forEach((t, i) => {
      const r = reads.data?.[i];
      const balance = r?.status === "success" ? (r.result as bigint) : 0n;
      if (balance > 0n) result.push({ ...t, balance });
    });
    return result;
  }, [erc20s, reads.data, nativeBal.data, hasNative, seed]);

  return { tokens, isLoading: discovering || nativeBal.isLoading || reads.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                                  LOCKS
// ──────────────────────────────────────────────────────────────────────────
export type LockView = {
  id: bigint;
  token: `0x${string}`;
  owner: `0x${string}`;   // current NFT owner (fetched via ownerOf)
  amount: bigint;
  unlockAt: bigint;       // maps to contract's unlockTime
  createdAt: bigint;
  withdrawn: boolean;
};

export function useUserLocks(): { locks: LockView[]; isLoading: boolean } {
  const { address } = useAccount();
  const { tokenLock } = useContractAddresses();

  const idsQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "locksOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && tokenLock !== ZERO },
  });
  const ids = (idsQ.data as bigint[] | undefined) ?? [];

  // Fetch lock details + ownerOf in one multicall
  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts: ids.flatMap((id) => [
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "getLock" as const, args: [id] as const },
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "ownerOf" as const, args: [id] as const },
    ]),
    query: { enabled: ids.length > 0 },
  });

  const locks = useMemo<LockView[]>(() => {
    if (!detailsQ.data) return [];
    return ids.map((id, i) => {
      const lockRes = detailsQ.data[i * 2];
      const ownerRes = detailsQ.data[i * 2 + 1];
      if (lockRes?.status !== "success") return null;
      const r = lockRes.result as { token: `0x${string}`; amount: bigint; unlockTime?: bigint; unlockAt?: bigint; createdAt: bigint; withdrawn: boolean };
      const owner = (ownerRes?.status === "success" ? ownerRes.result : "0x0000000000000000000000000000000000000000") as `0x${string}`;
      const unlockAt = r.unlockTime ?? r.unlockAt ?? 0n;
      return { id, token: r.token, owner, amount: r.amount, unlockAt, createdAt: r.createdAt, withdrawn: r.withdrawn };
    }).filter(Boolean) as LockView[];
  }, [detailsQ.data, ids]);

  return { locks, isLoading: idsQ.isLoading || detailsQ.isLoading };
}

export function useAllLocks(limit = 100): { locks: LockView[]; isLoading: boolean } {
  const { tokenLock } = useContractAddresses();

  // Try locksLength() first (new contract), fall back to totalLocks() (old contract)
  const lengthQ = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "locksLength" as const },
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "totalLocks"  as const },
    ],
    query: { enabled: tokenLock !== ZERO },
  });

  const total = useMemo(() => {
    const a = lengthQ.data?.[0];
    const b = lengthQ.data?.[1];
    const val = (a?.status === "success" ? a.result : null)
             ?? (b?.status === "success" ? b.result : null)
             ?? 0n;
    return Number(val as bigint);
  }, [lengthQ.data]);

  const ids = useMemo<bigint[]>(() => {
    if (total === 0) return [];
    const start = Math.max(0, total - limit);
    const result: bigint[] = [];
    for (let i = total - 1; i >= start; i--) result.push(BigInt(i));
    return result;
  }, [total, limit]);

  // Fetch lock details + ownerOf in one multicall
  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts: ids.flatMap((id) => [
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "getLock"  as const, args: [id] as const },
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "ownerOf"  as const, args: [id] as const },
    ]),
    query: { enabled: ids.length > 0 },
  });

  const locks = useMemo<LockView[]>(() => {
    if (!detailsQ.data) return [];
    return ids.map((id, i) => {
      const lockRes  = detailsQ.data[i * 2];
      const ownerRes = detailsQ.data[i * 2 + 1];
      if (lockRes?.status !== "success") return null;
      const r = lockRes.result as {
        token: `0x${string}`; amount: bigint;
        unlockTime?: bigint; unlockAt?: bigint;
        createdAt: bigint; withdrawn: boolean;
      };
      const owner = (ownerRes?.status === "success"
        ? ownerRes.result
        : "0x0000000000000000000000000000000000000000") as `0x${string}`;
      const unlockAt = r.unlockTime ?? r.unlockAt ?? 0n;
      return { id, token: r.token, owner, amount: r.amount, unlockAt, createdAt: r.createdAt, withdrawn: r.withdrawn };
    }).filter(Boolean) as LockView[];
  }, [detailsQ.data, ids]);

  return { locks, isLoading: lengthQ.isLoading || detailsQ.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                              LEADERBOARDS
// ──────────────────────────────────────────────────────────────────────────
/**
 * Computes token and user leaderboards entirely off-chain from the allLocks
 * data. No extra contract functions needed — just iterates the fetched locks.
 */
export function useLockLeaderboards(limit = 50) {
  const { locks, isLoading } = useAllLocks(500);

  const { tokens, users } = useMemo(() => {
    // Aggregate active (non-withdrawn) locks by token and by owner
    const byToken = new Map<`0x${string}`, bigint>();
    const byUser  = new Map<`0x${string}`, bigint>();

    for (const lock of locks) {
      if (lock.withdrawn) continue;

      const tok = lock.token.toLowerCase() as `0x${string}`;
      byToken.set(tok, (byToken.get(tok) ?? 0n) + lock.amount);

      const usr = lock.owner.toLowerCase() as `0x${string}`;
      byUser.set(usr, (byUser.get(usr) ?? 0n) + lock.amount);
    }

    const tokens = Array.from(byToken.entries())
      .map(([address, amount]) => ({ address, amount }))
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
      .slice(0, limit);

    const users = Array.from(byUser.entries())
      .map(([address, amount]) => ({ address, amount }))
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
      .slice(0, limit);

    return { tokens, users };
  }, [locks, limit]);

  return { tokens, users, isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                              PROTOCOL STATS
// ──────────────────────────────────────────────────────────────────────────
export function useProtocolStats() {
  const { tokenLock, vestingNFT } = useContractAddresses();

  // Try both function names — locksLength (new) or totalLocks (old deployed contract)
  const countsQ = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: tokenLock,  abi: TOKEN_LOCK_ABI,  functionName: "locksLength"   as const },
      { address: tokenLock,  abi: TOKEN_LOCK_ABI,  functionName: "totalLocks"    as const },
      { address: tokenLock,  abi: TOKEN_LOCK_ABI,  functionName: "tokensLength"  as const },
      { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "totalVestings" as const },
    ],
    query: { enabled: tokenLock !== ZERO },
  });

  const pick = (i: number) => Number((countsQ.data?.[i]?.status === "success" ? countsQ.data[i].result : 0n) as bigint);

  const totalLocks     = pick(0) || pick(1); // whichever returns non-zero
  const tokensLocked   = pick(2);
  const totalSchedules = pick(3);

  return {
    totalLocks,
    totalSchedules,
    tokensLocked,
    rawLockedSum: 0n,
    isLoading: countsQ.isLoading,
  };
}

// ──────────────────────────────────────────────────────────────────────────
//                              VESTINGS
// ──────────────────────────────────────────────────────────────────────────

export type VestingView = {
  id: bigint;
  token: `0x${string}`;
  totalAmount: bigint;
  startTime: bigint;
  duration: bigint;
  cliffDuration: bigint;
  claimed: bigint;
  revoked: boolean;
  claimable: bigint;
};

export function useUserVestings(): {
  vestings: VestingView[];
  isLoading: boolean;
} {
  const { address } = useAccount();
  const { vestingNFT } = useContractAddresses();

  const idsQ = useReadContract({
    address: vestingNFT,
    abi: VESTING_NFT_ABI,
    functionName: "vestingsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && vestingNFT !== ZERO },
  });
  const ids = (idsQ.data as bigint[] | undefined) ?? [];

  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts: ids.flatMap((id) => [
      { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "getVesting" as const, args: [id] as const },
      { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "claimableAmount" as const, args: [id] as const },
    ]),
    query: { enabled: ids.length > 0 },
  });

  const vestings = useMemo<VestingView[]>(() => {
    if (!detailsQ.data) return [];
    return ids.map((id, i) => {
      const vestRes = detailsQ.data[i * 2];
      const claimRes = detailsQ.data[i * 2 + 1];
      if (vestRes?.status !== "success") return null;
      const v = vestRes.result as {
        token: `0x${string}`; totalAmount: bigint; startTime: bigint;
        duration: bigint; cliffDuration: bigint; claimed: bigint; revoked: boolean;
      };
      const claimable = claimRes?.status === "success" ? (claimRes.result as bigint) : 0n;
      return { id, ...v, claimable };
    }).filter(Boolean) as VestingView[];
  }, [detailsQ.data, ids]);

  return { vestings, isLoading: idsQ.isLoading || detailsQ.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                         TOKEN BALANCES (AUTO-DISCOVERY)
// ──────────────────────────────────────────────────────────────────────────
import { usePublicClient } from "wagmi";
import { fetchAllBalances, type TokenBalance } from "./tokenBalances";

/**
 * Hook to fetch all token balances for the connected wallet
 * Automatically discovers tokens from Monad Explorer API
 * No need to manually enter token addresses!
 */
export function useAllTokenBalances(): {
  balances: TokenBalance[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!address || !publicClient) {
      setBalances([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchAllBalances(address, chainId, publicClient)
      .then((results) => {
        if (!cancelled) {
          setBalances(results);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setBalances([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, chainId, publicClient, refreshKey]);

  const refetch = () => setRefreshKey((k) => k + 1);

  return { balances, isLoading, error, refetch };
}
