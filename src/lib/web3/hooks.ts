import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { CONTRACTS, TOKEN_LOCK_ABI, VESTING_NFT_ABI } from "./contracts";
import { ERC20_ABI, getTokenList, type TokenInfo } from "./tokens";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
/** 10-second poll interval used on all contract reads */
const POLL = 10_000 as const;

/** Etherscan-compatible explorer API bases per chain */
const EXPLORER_API: Record<number, string> = {
  10143: "https://testnet.monadexplorer.com/api",
};

// ──────────────────────────────────────────────────────────────────────────
//                           PERSISTENT DATA CACHE
// ──────────────────────────────────────────────────────────────────────────

type CacheKey = string;
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  chainId: number;
};

const CACHE_VERSION = "v6"; // Bump to invalidate stale localStorage caches

function getCacheKey(key: string, address?: string, chainId?: number): CacheKey {
  return `${CACHE_VERSION}_locks_cache_${key}_${address || 'global'}_${chainId || 'unknown'}`;
}

function getCachedData<T>(key: CacheKey): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached, (_key, value) => {
      if (typeof value === 'string' && value.startsWith('__bigint__:')) {
        return BigInt(value.slice(11));
      }
      return value;
    });
    
    return entry.data;
  } catch {
    // Corrupted cache — clear it
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
}

function setCachedData<T>(key: CacheKey, data: T, chainId: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      chainId,
    };
    localStorage.setItem(key, JSON.stringify(entry, (_key, value) => {
      // Serialize BigInts to a recoverable format
      if (typeof value === 'bigint') {
        return `__bigint__:${value.toString()}`;
      }
      return value;
    }));
  } catch {
    // Ignore localStorage errors
  }
}

function usePersistentData<T>(
  key: string,
  data: T | undefined,
  isLoading: boolean,
  address?: string,
  chainId?: number,
  /** When true, prefer fresh on-chain data even if empty (avoids stale cache after withdraw) */
  fetchComplete = false,
): { data: T | undefined; isLoading: boolean } {
  const cacheKey = getCacheKey(key, address, chainId);
  const [persistentData, setPersistentData] = useState<T | undefined>(() => {
    try { return getCachedData<T>(cacheKey) || undefined; } catch { return undefined; }
  });

  useEffect(() => {
    if (fetchComplete && data !== undefined && chainId) {
      try {
        setCachedData(cacheKey, data, chainId);
        setPersistentData(data);
      } catch {
        // Ignore cache write failures
      }
    }
  }, [data, fetchComplete, cacheKey, chainId]);

  return {
    data: fetchComplete ? data : (data || persistentData),
    isLoading: isLoading && !persistentData && !fetchComplete,
  };
}

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
  const nativeBal = useBalance({ address, query: { enabled: !!address && hasNative, refetchInterval: POLL } });
  const reads = useReadContracts({
    allowFailure: true,
    contracts: erc20s.map((t) => ({
      address: t.address,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
    })),
    query: { enabled: !!address && erc20s.length > 0, refetchInterval: POLL },
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
  const chainId = useChainId();
  const { tokenLock } = useContractAddresses();

  const idsQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "locksOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && tokenLock !== ZERO, refetchInterval: POLL },
  });
  const ids = (idsQ.data as bigint[] | undefined) ?? [];

  // Fetch lock details + ownerOf in one multicall
  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts: ids.flatMap((id) => [
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "getLock" as const, args: [id] as const },
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "ownerOf" as const, args: [id] as const },
    ]),
    query: { enabled: ids.length > 0, refetchInterval: POLL },
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

  const fetchComplete =
    !idsQ.isLoading && !detailsQ.isLoading && (ids.length === 0 || !!detailsQ.data);

  const persistent = usePersistentData(
    "user_locks",
    locks,
    idsQ.isLoading || detailsQ.isLoading,
    address,
    chainId,
    fetchComplete,
  );

  return { locks: persistent.data || [], isLoading: persistent.isLoading };
}

export function useAllLocks(limit = 100): { locks: LockView[]; isLoading: boolean } {
  const chainId = useChainId();
  const { tokenLock } = useContractAddresses();

  // Try locksLength() first (new contract), fall back to totalLocks() (old contract)
  const lengthQ = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "locksLength" as const },
      { address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "totalLocks"  as const },
    ],
    query: { enabled: tokenLock !== ZERO, refetchInterval: POLL },
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
    query: { enabled: ids.length > 0, refetchInterval: POLL },
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

  const fetchComplete =
    !lengthQ.isLoading && !detailsQ.isLoading && (ids.length === 0 || !!detailsQ.data);

  const persistent = usePersistentData(
    "all_locks",
    locks,
    lengthQ.isLoading || detailsQ.isLoading,
    undefined,
    chainId,
    fetchComplete,
  );

  return { locks: persistent.data || [], isLoading: persistent.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                              LEADERBOARDS
// ──────────────────────────────────────────────────────────────────────────
/**
 * Computes token and user leaderboards entirely off-chain from the allLocks
 * data. No extra contract functions needed — just iterates the fetched locks.
 */
export function useLockLeaderboards(limit = 50) {
  const chainId = useChainId();
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

  // Use persistent data for leaderboards
  const fetchComplete = !isLoading;

  const persistentTokens = usePersistentData(
    "token_leaderboard",
    tokens,
    isLoading,
    undefined,
    chainId,
    fetchComplete,
  );

  const persistentUsers = usePersistentData(
    "user_leaderboard",
    users,
    isLoading,
    undefined,
    chainId,
    fetchComplete,
  );

  return { 
    tokens: persistentTokens.data || [], 
    users: persistentUsers.data || [], 
    isLoading: persistentTokens.isLoading || persistentUsers.isLoading 
  };
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
    query: { enabled: tokenLock !== ZERO, refetchInterval: POLL },
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
  const chainId = useChainId();
  const { vestingNFT } = useContractAddresses();

  const idsQ = useReadContract({
    address: vestingNFT,
    abi: VESTING_NFT_ABI,
    functionName: "vestingsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && vestingNFT !== ZERO, refetchInterval: POLL },
  });
  const ids = (idsQ.data as bigint[] | undefined) ?? [];

  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts: ids.flatMap((id) => [
      { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "getVesting" as const, args: [id] as const },
      { address: vestingNFT, abi: VESTING_NFT_ABI, functionName: "claimableAmount" as const, args: [id] as const },
    ]),
    query: { enabled: ids.length > 0, refetchInterval: POLL },
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

  const fetchComplete =
    !idsQ.isLoading && !detailsQ.isLoading && (ids.length === 0 || !!detailsQ.data);

  const persistent = usePersistentData(
    "user_vestings",
    vestings,
    idsQ.isLoading || detailsQ.isLoading,
    address,
    chainId,
    fetchComplete,
  );

  return { vestings: persistent.data || [], isLoading: persistent.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                         TOKEN BALANCES (AUTO-DISCOVERY)
// ──────────────────────────────────────────────────────────────────────────
import { usePublicClient } from "wagmi";
import { fetchAllBalances, type TokenBalance } from "./tokenBalances";
import { addCustomToken } from "./customTokens";
import type { TokenInfo as CustomTokenInfo } from "./tokens";

/**
 * Hook to fetch all token balances for the connected wallet
 * Automatically discovers tokens from RPC logs + includes custom tokens
 * Caches results in localStorage so data persists across failures
 */
export function useAllTokenBalances(): {
  balances: TokenBalance[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  addToken: (token: CustomTokenInfo) => void;
} {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  const [balances, setBalances] = useState<TokenBalance[]>(() => {
    // Initialize from cache
    if (!address) return [];
    try {
      const cached = localStorage.getItem(`token_balances_v6_${address}_${chainId}`);
      if (cached) {
        const { data } = JSON.parse(cached);
        // Restore bigints
        return data.map((t: any) => ({ ...t, balance: BigInt(t.balance) }));
      }
    } catch {}
    return [];
  });
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
        if (!cancelled && results.length > 0) {
          setBalances(results);
          setIsLoading(false);
          // Cache results (serialize bigints as strings)
          try {
            const serializable = results.map(t => ({ ...t, balance: t.balance.toString() }));
            localStorage.setItem(`token_balances_v6_${address}_${chainId}`, JSON.stringify({ data: serializable, timestamp: Date.now() }));
          } catch {}
        } else if (!cancelled) {
          // Don't clear existing data on empty results (RPC failure)
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          // Keep existing cached data on error
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, chainId, publicClient, refreshKey]);

  const refetch = () => setRefreshKey((k) => k + 1);
  
  const addToken = (token: CustomTokenInfo) => {
    addCustomToken(chainId, token);
    refetch();
  };

  return { balances, isLoading: isLoading && balances.length === 0, error, refetch, addToken };
}
