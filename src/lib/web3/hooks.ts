import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { CONTRACTS, TOKEN_LOCK_ABI, VESTING_FACTORY_ABI } from "./contracts";
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
  owner: `0x${string}`;
  amount: bigint;
  unlockAt: bigint;
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

  const detailsQ = useReadContracts({
    allowFailure: false,
    contracts: ids.map((id) => ({
      address: tokenLock,
      abi: TOKEN_LOCK_ABI,
      functionName: "getLock" as const,
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0 },
  });

  const locks = useMemo<LockView[]>(() => {
    if (!detailsQ.data) return [];
    return detailsQ.data.map((d, i) => {
      const r = d as { token: `0x${string}`; owner: `0x${string}`; amount: bigint; unlockAt: bigint; createdAt: bigint; withdrawn: boolean };
      return { id: ids[i], ...r };
    });
  }, [detailsQ.data, ids]);

  return { locks, isLoading: idsQ.isLoading || detailsQ.isLoading };
}

export function useAllLocks(limit = 100): { locks: LockView[]; isLoading: boolean } {
  const { tokenLock } = useContractAddresses();

  const lengthQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "locksLength",
    query: { enabled: tokenLock !== ZERO },
  });
  const total = Number((lengthQ.data as bigint | undefined) ?? 0n);

  const ids = useMemo<bigint[]>(() => {
    if (total === 0) return [];
    const start = Math.max(0, total - limit);
    const result: bigint[] = [];
    for (let i = total - 1; i >= start; i--) result.push(BigInt(i));
    return result;
  }, [total, limit]);

  const detailsQ = useReadContracts({
    allowFailure: true,
    contracts: ids.map((id) => ({
      address: tokenLock,
      abi: TOKEN_LOCK_ABI,
      functionName: "getLock" as const,
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0 },
  });

  const locks = useMemo<LockView[]>(() => {
    if (!detailsQ.data) return [];
    return detailsQ.data
      .map((d, i) => {
        if (d?.status !== "success") return null;
        const r = d.result as { token: `0x${string}`; owner: `0x${string}`; amount: bigint; unlockAt: bigint; createdAt: bigint; withdrawn: boolean };
        return { id: ids[i], ...r };
      })
      .filter(Boolean) as LockView[];
  }, [detailsQ.data, ids]);

  return { locks, isLoading: lengthQ.isLoading || detailsQ.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                              LEADERBOARDS
// ──────────────────────────────────────────────────────────────────────────
export function useLockLeaderboards(limit = 50) {
  const { tokenLock } = useContractAddresses();

  const tokensQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "tokenLeaderboard",
    args: [0n, BigInt(limit)],
    query: { enabled: tokenLock !== ZERO, refetchInterval: 10_000 },
  });
  const usersQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "userLeaderboard",
    args: [0n, BigInt(limit)],
    query: { enabled: tokenLock !== ZERO, refetchInterval: 10_000 },
  });

  const tokens = useMemo(() => {
    const d = tokensQ.data as readonly [readonly `0x${string}`[], readonly bigint[]] | undefined;
    if (!d) return [];
    const [addrs, amts] = d;
    return addrs.map((address, i) => ({ address, amount: amts[i] }))
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  }, [tokensQ.data]);

  const users = useMemo(() => {
    const d = usersQ.data as readonly [readonly `0x${string}`[], readonly bigint[]] | undefined;
    if (!d) return [];
    const [addrs, amts] = d;
    return addrs.map((address, i) => ({ address, amount: amts[i] }))
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  }, [usersQ.data]);

  return { tokens, users, isLoading: tokensQ.isLoading || usersQ.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                              PROTOCOL STATS
// ──────────────────────────────────────────────────────────────────────────
export function useProtocolStats() {
  const { tokenLock, vestingFactory } = useContractAddresses();

  const locksLen = useReadContract({ address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "locksLength", query: { enabled: tokenLock !== ZERO } });
  const walletsLen = useReadContract({ address: vestingFactory, abi: VESTING_FACTORY_ABI, functionName: "allWalletsLength", query: { enabled: vestingFactory !== ZERO } });
  const board = useReadContract({ address: tokenLock, abi: TOKEN_LOCK_ABI, functionName: "tokenLeaderboard", args: [0n, 200n], query: { enabled: tokenLock !== ZERO } });

  const totalLocks = (locksLen.data as bigint | undefined) ?? 0n;
  const totalSchedules = (walletsLen.data as bigint | undefined) ?? 0n;
  const boardData = board.data as readonly [readonly `0x${string}`[], readonly bigint[]] | undefined;
  const tokensLocked = boardData ? boardData[0].length : 0;
  const rawLockedSum = boardData ? boardData[1].reduce((acc, v) => acc + v, 0n) : 0n;

  return { totalLocks: Number(totalLocks), totalSchedules: Number(totalSchedules), tokensLocked, rawLockedSum, isLoading: locksLen.isLoading || walletsLen.isLoading || board.isLoading };
}

// ──────────────────────────────────────────────────────────────────────────
//                              VESTINGS
// ──────────────────────────────────────────────────────────────────────────
export function useUserVestings(): {
  wallets: `0x${string}`[];
  walletTokens: Record<string, `0x${string}`>;
  isLoading: boolean;
} {
  const { address } = useAccount();
  const { vestingFactory } = useContractAddresses();

  const beneficiaryQ = useReadContract({
    address: vestingFactory,
    abi: VESTING_FACTORY_ABI,
    functionName: "walletsOfBeneficiary",
    args: address ? [address] : undefined,
    query: { enabled: !!address && vestingFactory !== ZERO },
  });
  const creatorQ = useReadContract({
    address: vestingFactory,
    abi: VESTING_FACTORY_ABI,
    functionName: "walletsOfCreator",
    args: address ? [address] : undefined,
    query: { enabled: !!address && vestingFactory !== ZERO },
  });

  const wallets = useMemo(() => {
    const a = (beneficiaryQ.data as `0x${string}`[] | undefined) ?? [];
    const b = (creatorQ.data as `0x${string}`[] | undefined) ?? [];
    return Array.from(new Set([...a, ...b]));
  }, [beneficiaryQ.data, creatorQ.data]);

  // Read the token stored for each wallet from the factory (on-chain, device-agnostic)
  const tokenReads = useReadContracts({
    allowFailure: true,
    contracts: wallets.map((w) => ({
      address: vestingFactory,
      abi: VESTING_FACTORY_ABI,
      functionName: "tokenOf" as const,
      args: [w] as const,
    })),
    query: { enabled: wallets.length > 0 && vestingFactory !== ZERO },
  });

  const walletTokens = useMemo(() => {
    const map: Record<string, `0x${string}`> = {};
    wallets.forEach((w, i) => {
      const r = tokenReads.data?.[i];
      if (r?.status === "success") map[w] = r.result as `0x${string}`;
    });
    return map;
  }, [wallets, tokenReads.data]);

  return {
    wallets,
    walletTokens,
    isLoading: beneficiaryQ.isLoading || creatorQ.isLoading || tokenReads.isLoading,
  };
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
