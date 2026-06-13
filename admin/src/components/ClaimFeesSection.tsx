"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, isAddress, zeroAddress } from "viem";
import {
  ERC20_ABI,
  OTC_MARKET_ABI,
  OTC_MARKET_ADDRESS,
  STREAM_FARM_ABI,
  STREAM_FARM_ADDRESS,
  TOKEN_LOCK_ABI,
  TOKEN_LOCK_ADDRESS,
  VESTING_NFT_ABI,
  VESTING_NFT_ADDRESS,
} from "@/lib/contracts";
import { admin } from "@/lib/theme";
import { Btn, Card, CardTitle, Err, Field, Msg } from "./adminUi";

type FeeRow = {
  id: string;
  label: string;
  amount: bigint;
  decimals: number;
  symbol: string;
  contract: `0x${string}`;
  action: "otc-native" | "otc-token" | "lock-recover" | "vest-recover" | "farm-recover";
  token?: `0x${string}`;
};

const NATIVE = "MON";

function sameAddr(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAmt(amount: bigint, decimals: number, symbol: string) {
  const n = Number(formatUnits(amount, decimals));
  const text = n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : formatUnits(amount, decimals);
  return `${text} ${symbol}`.trim();
}

export function ClaimFeesSection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [manualToken, setManualToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [feeRows, setFeeRows] = useState<FeeRow[]>([]);
  const [claimIndex, setClaimIndex] = useState<number | null>(null);
  const [batchDone, setBatchDone] = useState(false);

  const ownersQ = useReadContracts({
    contracts: [
      { address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "owner" },
      { address: TOKEN_LOCK_ADDRESS, abi: TOKEN_LOCK_ABI, functionName: "owner" },
      { address: VESTING_NFT_ADDRESS, abi: VESTING_NFT_ABI, functionName: "owner" },
      { address: OTC_MARKET_ADDRESS, abi: OTC_MARKET_ABI, functionName: "owner" },
    ],
    query: { refetchInterval: 15_000 },
  });

  const streamOwner = ownersQ.data?.[0]?.result as string | undefined;
  const lockOwner = ownersQ.data?.[1]?.result as string | undefined;
  const vestOwner = ownersQ.data?.[2]?.result as string | undefined;
  const otcOwner = ownersQ.data?.[3]?.result as string | undefined;

  const isStreamOwner = sameAddr(address, streamOwner);
  const isLockOwner = sameAddr(address, lockOwner);
  const isVestOwner = sameAddr(address, vestOwner);
  const isOtcOwner = sameAddr(address, otcOwner);
  const isAnyOwner = isStreamOwner || isLockOwner || isVestOwner || isOtcOwner;

  const nativePendingQ = useReadContract({
    address: OTC_MARKET_ADDRESS,
    abi: OTC_MARKET_ABI,
    functionName: "pendingNativePayments",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isOtcOwner, refetchInterval: 10_000 },
  });

  const scanFees = useCallback(async () => {
    if (!publicClient || !address || !isAnyOwner) {
      setFeeRows([]);
      return;
    }
    setScanning(true);
    setBatchDone(false);
    try {
      const rows: FeeRow[] = [];

      if (isOtcOwner) {
        const nativePending = (await publicClient.readContract({
          address: OTC_MARKET_ADDRESS,
          abi: OTC_MARKET_ABI,
          functionName: "pendingNativePayments",
          args: [address],
        })) as bigint;
        if (nativePending > 0n) {
          rows.push({
            id: "otc-native",
            label: "OTC marketplace · MON fees",
            amount: nativePending,
            decimals: 18,
            symbol: NATIVE,
            contract: OTC_MARKET_ADDRESS,
            action: "otc-native",
          });
        }

        const listingCount = Number(
          await publicClient.readContract({
            address: OTC_MARKET_ADDRESS,
            abi: OTC_MARKET_ABI,
            functionName: "listingCount",
          }),
        );
        const paymentTokens = new Set<string>();
        const maxListings = Math.min(listingCount, 256);
        for (let i = 0; i < maxListings; i++) {
          const listing = (await publicClient.readContract({
            address: OTC_MARKET_ADDRESS,
            abi: OTC_MARKET_ABI,
            functionName: "getListing",
            args: [BigInt(i)],
          })) as readonly [string, string, bigint, string, bigint, boolean, bigint];
          const paymentToken = listing[3];
          if (paymentToken && paymentToken !== zeroAddress) {
            paymentTokens.add(paymentToken.toLowerCase());
          }
        }

        for (const tokenLower of paymentTokens) {
          const token = tokenLower as `0x${string}`;
          const pending = (await publicClient.readContract({
            address: OTC_MARKET_ADDRESS,
            abi: OTC_MARKET_ABI,
            functionName: "pendingTokenPayments",
            args: [token, address],
          })) as bigint;
          if (pending <= 0n) continue;
          let decimals = 18;
          let symbol = shortAddr(token);
          try {
            decimals = Number(
              await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }),
            );
            symbol = (await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })) as string;
          } catch {
            /* keep defaults */
          }
          rows.push({
            id: `otc-${tokenLower}`,
            label: `OTC marketplace · ${symbol} fees`,
            amount: pending,
            decimals,
            symbol,
            contract: OTC_MARKET_ADDRESS,
            action: "otc-token",
            token,
          });
        }
      }

      if (isLockOwner) {
        const tokenLen = Number(
          await publicClient.readContract({
            address: TOKEN_LOCK_ADDRESS,
            abi: TOKEN_LOCK_ABI,
            functionName: "tokensLength",
          }),
        );
        const tracked = (await publicClient.readContract({
          address: TOKEN_LOCK_ADDRESS,
          abi: TOKEN_LOCK_ABI,
          functionName: "allTokens",
          args: [0n, BigInt(Math.min(tokenLen, 100))],
        })) as `0x${string}`[];

        for (const token of tracked) {
          const [balance, escrow] = await Promise.all([
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [TOKEN_LOCK_ADDRESS] }),
            publicClient.readContract({ address: TOKEN_LOCK_ADDRESS, abi: TOKEN_LOCK_ABI, functionName: "totalEscrowed", args: [token] }),
          ]);
          const recoverable = (balance as bigint) > (escrow as bigint) ? (balance as bigint) - (escrow as bigint) : 0n;
          if (recoverable <= 0n) continue;
          let decimals = 18;
          let symbol = shortAddr(token);
          try {
            decimals = Number(await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }));
            symbol = (await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })) as string;
          } catch {
            /* keep defaults */
          }
          rows.push({
            id: `lock-${token.toLowerCase()}`,
            label: `Token Lock · recoverable ${symbol}`,
            amount: recoverable,
            decimals,
            symbol,
            contract: TOKEN_LOCK_ADDRESS,
            action: "lock-recover",
            token,
          });
        }
      }

      if (isVestOwner && isAddress(manualToken)) {
        const token = manualToken as `0x${string}`;
        const [balance, escrow] = await Promise.all([
          publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [VESTING_NFT_ADDRESS] }),
          publicClient.readContract({ address: VESTING_NFT_ADDRESS, abi: VESTING_NFT_ABI, functionName: "totalEscrowed", args: [token] }),
        ]);
        const recoverable = (balance as bigint) > (escrow as bigint) ? (balance as bigint) - (escrow as bigint) : 0n;
        if (recoverable > 0n) {
          let decimals = 18;
          let symbol = shortAddr(token);
          try {
            decimals = Number(await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }));
            symbol = (await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })) as string;
          } catch {
            /* keep defaults */
          }
          rows.push({
            id: `vest-${token.toLowerCase()}`,
            label: `Vesting · recoverable ${symbol}`,
            amount: recoverable,
            decimals,
            symbol,
            contract: VESTING_NFT_ADDRESS,
            action: "vest-recover",
            token,
          });
        }
      }

      if (isStreamOwner) {
        const farmCount = Number(
          await publicClient.readContract({ address: STREAM_FARM_ADDRESS, abi: STREAM_FARM_ABI, functionName: "farmCount" }),
        );
        const farmTokens = new Set<string>();
        for (let f = 0; f < farmCount; f++) {
          const farm = (await publicClient.readContract({
            address: STREAM_FARM_ADDRESS,
            abi: STREAM_FARM_ABI,
            functionName: "getFarm",
            args: [BigInt(f)],
          })) as readonly [string, bigint, bigint, boolean, bigint, bigint, bigint];
          farmTokens.add(farm[0].toLowerCase());
          const streamCount = Number(farm[6]);
          for (let r = 0; r < streamCount; r++) {
            const stream = (await publicClient.readContract({
              address: STREAM_FARM_ADDRESS,
              abi: STREAM_FARM_ABI,
              functionName: "getRewardStream",
              args: [BigInt(f), BigInt(r)],
            })) as readonly [string, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
            farmTokens.add(stream[0].toLowerCase());
          }
        }

        for (const tokenLower of farmTokens) {
          const token = tokenLower as `0x${string}`;
          const recoverable = (await publicClient.readContract({
            address: STREAM_FARM_ADDRESS,
            abi: STREAM_FARM_ABI,
            functionName: "recoverableBalance",
            args: [token],
          })) as bigint;
          if (recoverable <= 0n) continue;
          let decimals = 18;
          let symbol = shortAddr(token);
          try {
            decimals = Number(await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }));
            symbol = (await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })) as string;
          } catch {
            /* keep defaults */
          }
          rows.push({
            id: `farm-${tokenLower}`,
            label: `StreamFarm · recoverable ${symbol}`,
            amount: recoverable,
            decimals,
            symbol,
            contract: STREAM_FARM_ADDRESS,
            action: "farm-recover",
            token,
          });
        }
      }

      setFeeRows(rows);
    } finally {
      setScanning(false);
    }
  }, [address, isAnyOwner, isLockOwner, isOtcOwner, isStreamOwner, isVestOwner, manualToken, publicClient]);

  useEffect(() => {
    void scanFees();
  }, [scanFees]);

  const claimTx = useWriteContract();
  const claimRcpt = useWaitForTransactionReceipt({ hash: claimTx.data });

  const totalClaimable = useMemo(
    () => feeRows.reduce((sum, row) => sum + row.amount, 0n),
    [feeRows],
  );

  const runClaim = useCallback(
    (row: FeeRow) => {
      if (!address) return;
      switch (row.action) {
        case "otc-native":
          claimTx.writeContract({
            address: OTC_MARKET_ADDRESS,
            abi: OTC_MARKET_ABI,
            functionName: "withdrawNativePayments",
          });
          break;
        case "otc-token":
          claimTx.writeContract({
            address: OTC_MARKET_ADDRESS,
            abi: OTC_MARKET_ABI,
            functionName: "withdrawTokenPayments",
            args: [row.token!],
          });
          break;
        case "lock-recover":
          claimTx.writeContract({
            address: TOKEN_LOCK_ADDRESS,
            abi: TOKEN_LOCK_ABI,
            functionName: "emergencyRecoverToken",
            args: [row.token!, row.amount],
          });
          break;
        case "vest-recover":
          claimTx.writeContract({
            address: VESTING_NFT_ADDRESS,
            abi: VESTING_NFT_ABI,
            functionName: "emergencyRecoverToken",
            args: [row.token!, row.amount],
          });
          break;
        case "farm-recover":
          claimTx.writeContract({
            address: STREAM_FARM_ADDRESS,
            abi: STREAM_FARM_ABI,
            functionName: "recoverTokens",
            args: [row.token!, row.amount],
          });
          break;
      }
    },
    [address, claimTx],
  );

  useEffect(() => {
    if (!claimRcpt.isSuccess) return;
    if (claimIndex == null) {
      void scanFees();
      return;
    }
    const next = claimIndex + 1;
    if (next < feeRows.length) {
      setClaimIndex(next);
      runClaim(feeRows[next]!);
    } else {
      setClaimIndex(null);
      setBatchDone(true);
      void scanFees();
    }
  }, [claimRcpt.isSuccess, claimIndex, feeRows, runClaim, scanFees]);

  const claimAll = () => {
    if (!feeRows.length || claimTx.isPending || claimRcpt.isLoading) return;
    setBatchDone(false);
    setClaimIndex(0);
    runClaim(feeRows[0]!);
  };

  if (!isAnyOwner) {
    return (
      <Card>
        <CardTitle sub="Contract deployer wallets only">Claim protocol fees</CardTitle>
        <p className="font-mono text-[11px] leading-relaxed" style={{ color: admin.textMuted }}>
          Connect the wallet that deployed the protocol contracts (the on-chain{" "}
          <code style={{ color: admin.accent }}>owner()</code>). StreamFarm admins cannot claim fees here.
        </p>
        {streamOwner && (
          <p className="font-mono text-[10px] mt-3" style={{ color: admin.textDim }}>
            StreamFarm owner: {shortAddr(streamOwner)}
          </p>
        )}
      </Card>
    );
  }

  return (
    <>
      <div>
        <h1 className="font-grotesk text-[26px] font-semibold" style={{ color: admin.text }}>
          Claim fees
        </h1>
        <p className="font-mono text-[11px] mt-1 max-w-2xl leading-relaxed" style={{ color: admin.textMuted }}>
          Withdraw accumulated protocol fees held in contracts. Only the deployer wallet (
          <code style={{ color: admin.accent }}>owner()</code>) can claim. Lock, vest, and farm platform fees
          normally send straight to your wallet; OTC fees and any stray recoverable balances show up here.
        </p>
      </div>

      <Card>
        <CardTitle sub="Which contracts you control">Deployer status</CardTitle>
        <div className="grid sm:grid-cols-2 gap-2 font-mono text-[11px]">
          <OwnerPill label="StreamFarm" owner={streamOwner} active={isStreamOwner} you={address} />
          <OwnerPill label="Token Lock" owner={lockOwner} active={isLockOwner} you={address} />
          <OwnerPill label="Vesting NFT" owner={vestOwner} active={isVestOwner} you={address} />
          <OwnerPill label="OTC Market" owner={otcOwner} active={isOtcOwner} you={address} />
        </div>
      </Card>

      <Card>
        <CardTitle sub="Scan contracts for claimable balances">Pending fees</CardTitle>
        <div className="space-y-4">
          {isVestOwner && (
            <Field
              label="Vesting token (optional — paste ERC-20 to scan recoverable balance)"
              value={manualToken}
              onChange={setManualToken}
              placeholder="0x…"
            />
          )}

          <div className="flex flex-wrap gap-3">
            <Btn onClick={() => void scanFees()} disabled={scanning}>
              {scanning ? "Scanning…" : "Refresh"}
            </Btn>
            <Btn onClick={claimAll} disabled={!feeRows.length || claimTx.isPending || claimRcpt.isLoading || scanning}>
              {claimTx.isPending || claimRcpt.isLoading
                ? claimIndex != null
                  ? `Claiming ${claimIndex + 1}/${feeRows.length}…`
                  : "Claiming…"
                : "Claim all"}
            </Btn>
          </div>

          {isOtcOwner && nativePendingQ.data != null && nativePendingQ.data > 0n && (
            <p className="font-mono text-[10px]" style={{ color: admin.textDim }}>
              OTC MON pending (live): {formatAmt(nativePendingQ.data as bigint, 18, NATIVE)}
            </p>
          )}

          {feeRows.length === 0 && !scanning ? (
            <p className="font-mono text-[11px] py-3" style={{ color: admin.textMuted }}>
              No claimable fees found right now.
            </p>
          ) : (
            <div className="space-y-2">
              {feeRows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-4 py-3"
                  style={{ background: admin.purpleBg, border: `1px solid ${admin.border}` }}
                >
                  <div className="min-w-0">
                    <p className="font-grotesk text-[13px]" style={{ color: admin.text }}>
                      {row.label}
                    </p>
                    <p className="font-mono text-[10px] mt-0.5" style={{ color: admin.textDim }}>
                      {formatAmt(row.amount, row.decimals, row.symbol)}
                    </p>
                  </div>
                  <Btn
                    small
                    onClick={() => {
                      setClaimIndex(null);
                      runClaim(row);
                    }}
                    disabled={claimTx.isPending || claimRcpt.isLoading}
                  >
                    Claim
                  </Btn>
                </div>
              ))}
            </div>
          )}

          {totalClaimable > 0n && feeRows.length > 1 && (
            <p className="font-mono text-[10px]" style={{ color: admin.textDim }}>
              {feeRows.length} claim{feeRows.length === 1 ? "" : "s"} · use Claim all to run them in sequence
            </p>
          )}

          {batchDone && <Msg text="All pending claims submitted." />}
          {claimTx.error && <Err error={claimTx.error} />}
        </div>
      </Card>
    </>
  );
}

function OwnerPill({
  label,
  owner,
  active,
  you,
}: {
  label: string;
  owner?: string;
  active: boolean;
  you?: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: active ? "rgba(110,231,168,0.08)" : admin.purpleBg,
        border: `1px solid ${active ? "rgba(110,231,168,0.25)" : admin.border}`,
      }}
    >
      <p style={{ color: active ? admin.green : admin.textMuted }}>{label}</p>
      <p className="mt-1 truncate" style={{ color: admin.textDim }}>
        {owner ? shortAddr(owner) : "…"}
        {active && you ? " · you" : !active && you && owner ? " · not you" : ""}
      </p>
    </div>
  );
}
