import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { TOKEN_LOCK_ABI, VESTING_NFT_ABI, STREAM_FARM_ABI, ERC20_ABI } from "@/lib/web3/contracts";
import { parseLockTuple } from "@/lib/web3/parseLock";
import { parseFarmTuple } from "@/lib/web3/parseFarm";
import { formatAmount, formatDate, timeUntil } from "@/lib/web3/format";
import { bigintToUsd, useTokenPriceUsdLive } from "@/lib/web3/prices";
import { formatUsdTable } from "@/lib/capricorn/poolMetrics";
import { TokenIcon } from "@/components/TokenIcon";
import { useRemoteTokenMeta } from "@/lib/web3/useRemoteTokenMeta";

type VestingData = {
  token: `0x${string}`;
  totalAmount: bigint;
  startTime: bigint;
  duration: bigint;
  cliffDuration: bigint;
  claimed: bigint;
  revoked: boolean;
};

function parseVestingTuple(raw: unknown): VestingData | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    if (raw.length < 8) return null;
    return {
      token: raw[0] as `0x${string}`,
      totalAmount: raw[2] as bigint,
      startTime: raw[3] as bigint,
      duration: raw[4] as bigint,
      cliffDuration: raw[5] as bigint,
      claimed: raw[6] as bigint,
      revoked: Boolean(raw[7]),
    };
  }
  const r = raw as Record<string, unknown>;
  if (r.token == null) return null;
  return {
    token: r.token as `0x${string}`,
    totalAmount: (r.totalAmount ?? 0n) as bigint,
    startTime: (r.startTime ?? 0n) as bigint,
    duration: (r.duration ?? 0n) as bigint,
    cliffDuration: (r.cliffDuration ?? 0n) as bigint,
    claimed: (r.claimed ?? 0n) as bigint,
    revoked: Boolean(r.revoked),
  };
}

function usdLabel(amount: bigint, decimals: number, priceUsd: number, loading: boolean): string {
  if (loading) return "…";
  const usd = bigintToUsd(amount, decimals, priceUsd);
  return usd > 0 ? formatUsdTable(usd) : "—";
}

export function OtcListingPositionInfo({
  nftContract,
  tokenId,
  tokenLock,
  vestingNFT,
  streamFarm,
  nftLabel,
}: {
  nftContract: `0x${string}`;
  tokenId: bigint;
  tokenLock: `0x${string}`;
  vestingNFT: `0x${string}`;
  streamFarm: `0x${string}`;
  nftLabel: string;
}) {
  const addr = nftContract.toLowerCase();
  const isLock = addr === tokenLock.toLowerCase();
  const isVesting = addr === vestingNFT.toLowerCase();
  const isFarm = addr === streamFarm.toLowerCase();

  const lockQ = useReadContract({
    address: tokenLock,
    abi: TOKEN_LOCK_ABI,
    functionName: "getLock",
    args: [tokenId],
    query: { enabled: isLock, refetchInterval: 10_000 },
  });

  const vestingQ = useReadContract({
    address: vestingNFT,
    abi: VESTING_NFT_ABI,
    functionName: "getVesting",
    args: [tokenId],
    query: { enabled: isVesting, refetchInterval: 10_000 },
  });

  const farmPosQ = useReadContract({
    address: streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "getPosition",
    args: [tokenId],
    query: { enabled: isFarm, refetchInterval: 10_000 },
  });

  const farmPos = farmPosQ.data as readonly [bigint, bigint, ...unknown[]] | undefined;
  const farmId = farmPos ? Number(farmPos[0]) : undefined;
  const farmStaked = farmPos ? (farmPos[1] as bigint) : 0n;

  const farmQ = useReadContract({
    address: streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "getFarm",
    args: farmId !== undefined ? [BigInt(farmId)] : undefined,
    query: { enabled: isFarm && farmId !== undefined, refetchInterval: 10_000 },
  });
  const farm = parseFarmTuple(farmQ.data);

  const lock = parseLockTuple(lockQ.data);
  const vesting = parseVestingTuple(vestingQ.data);

  const tokenAddress = useMemo((): `0x${string}` | undefined => {
    if (isLock && lock) return lock.token;
    if (isVesting && vesting) return vesting.token;
    if (isFarm && farm) return farm.stakeToken;
    return undefined;
  }, [isLock, isVesting, isFarm, lock, vesting, farm]);

  const positionAmount = useMemo(() => {
    if (isLock && lock) return lock.amount;
    if (isVesting && vesting) {
      const remaining = vesting.totalAmount - vesting.claimed;
      return remaining > 0n ? remaining : 0n;
    }
    if (isFarm) return farmStaked;
    return 0n;
  }, [isLock, isVesting, isFarm, lock, vesting, farmStaked]);

  const metaQ = useReadContracts({
    allowFailure: true,
    contracts: tokenAddress
      ? [
          { address: tokenAddress, abi: ERC20_ABI, functionName: "symbol" as const },
          { address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" as const },
        ]
      : [],
    query: { enabled: !!tokenAddress, refetchInterval: 10_000 },
  });

  const getRemoteMeta = useRemoteTokenMeta(tokenAddress ? [tokenAddress] : []);
  const remote = tokenAddress ? getRemoteMeta(tokenAddress) : undefined;
  const symbol =
    remote?.symbol ??
    ((metaQ.data?.[0]?.result as string | undefined) ?? (tokenAddress ? tokenAddress.slice(0, 6) : "…"));
  const decimals = remote?.decimals ?? ((metaQ.data?.[1]?.result as number | undefined) ?? 18);
  const logoUrl = remote?.logoURI ?? null;

  const { priceUsd, loading: priceLoading } = useTokenPriceUsdLive(tokenAddress ?? "");

  const loading =
    (isLock && lockQ.isLoading) ||
    (isVesting && vestingQ.isLoading) ||
    (isFarm && (farmPosQ.isLoading || farmQ.isLoading)) ||
    (!!tokenAddress && metaQ.isLoading);

  const schedule = useMemo(() => {
    if (isLock && lock) {
      const created = lock.createdAt > 0n ? formatDate(lock.createdAt) : "—";
      const unlock = formatDate(lock.unlockAt);
      const left = timeUntil(lock.unlockAt);
      return `Locked ${created} → ${unlock} · ${left}`;
    }
    if (isVesting && vesting) {
      const start = formatDate(vesting.startTime);
      const end = formatDate(BigInt(Number(vesting.startTime) + Number(vesting.duration)));
      const left = timeUntil(BigInt(Number(vesting.startTime) + Number(vesting.duration)));
      const cliff =
        Number(vesting.cliffDuration) > 0
          ? ` · cliff ${formatDate(BigInt(Number(vesting.startTime) + Number(vesting.cliffDuration)))}`
          : "";
      if (vesting.revoked) return "Vesting revoked";
      return `Vesting ${start} → ${end} · ${left}${cliff}`;
    }
    if (isFarm && farmId !== undefined) {
      return `Farm stake · Pool #${farmId}`;
    }
    return null;
  }, [isLock, isVesting, isFarm, lock, vesting, farmId]);

  if (loading) {
    return (
      <div className="mt-2 space-y-1.5 animate-pulse">
        <div className="h-3.5 w-36 rounded" style={{ background: "rgba(139,92,246,0.15)" }} />
        <div className="h-3 w-52 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    );
  }

  if (!tokenAddress || positionAmount === 0n) {
    return (
      <p className="font-mono text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
        {nftLabel} position · no balance
      </p>
    );
  }

  const amountStr = formatAmount(positionAmount, decimals);
  const valueStr = usdLabel(positionAmount, decimals, priceUsd, priceLoading);

  return (
    <div className="mt-2.5 space-y-1">
      <div className="flex items-center gap-2 min-w-0">
        <TokenIcon address={tokenAddress} symbol={symbol} size={22} logoUrl={logoUrl} />
        <p className="font-grotesk text-[14px] font-medium truncate" style={{ color: "#FFFFFF" }}>
          {amountStr}{" "}
          <span className="font-mono text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            {symbol}
          </span>
          <span className="font-mono text-[12px] ml-2" style={{ color: "#A78BFA" }}>
            · {valueStr}
          </span>
        </p>
      </div>
      {schedule && (
        <p className="font-mono text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
          {schedule}
        </p>
      )}
    </div>
  );
}
