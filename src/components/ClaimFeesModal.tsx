import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  STREAM_FARM_ABI,
  TOKEN_LOCK_ABI,
  VESTING_NFT_ABI,
} from "@/lib/web3/contracts";
import { useContractAddresses } from "@/lib/web3/hooks";
import { shortAddr } from "@/lib/web3/format";
import { useIsProtocolOwner } from "@/lib/web3/useProtocolOwner";
import { theme } from "@/lib/theme";
import { Modal } from "./Modal";

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

function formatAmt(amount: bigint, decimals: number, symbol: string) {
  const n = Number(formatUnits(amount, decimals));
  const text = n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : formatUnits(amount, decimals);
  return `${text} ${symbol}`.trim();
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ClaimFeesModal({ open, onClose }: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const contracts = useContractAddresses();
  const {
    isProtocolOwner,
    isStreamOwner,
    isLockOwner,
    isVestOwner,
    isOtcOwner,
    streamOwner,
    lockOwner,
    vestOwner,
    otcOwner,
  } = useIsProtocolOwner();

  const [manualToken, setManualToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [feeRows, setFeeRows] = useState<FeeRow[]>([]);
  const [claimIndex, setClaimIndex] = useState<number | null>(null);
  const [batchDone, setBatchDone] = useState(false);

  const nativePendingQ = useReadContract({
    address: contracts.otcMarket,
    abi: OTC_MARKET_ABI,
    functionName: "pendingNativePayments",
    args: address ? [address] : undefined,
    query: { enabled: open && !!address && isOtcOwner, refetchInterval: 10_000 },
  });

  const scanFees = useCallback(async () => {
    if (!publicClient || !address || !isProtocolOwner) {
      setFeeRows([]);
      return;
    }
    setScanning(true);
    setBatchDone(false);
    try {
      const rows: FeeRow[] = [];

      if (isOtcOwner) {
        const nativePending = (await publicClient.readContract({
          address: contracts.otcMarket,
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
            contract: contracts.otcMarket,
            action: "otc-native",
          });
        }

        const listingCount = Number(
          await publicClient.readContract({
            address: contracts.otcMarket,
            abi: OTC_MARKET_ABI,
            functionName: "listingCount",
          }),
        );
        const paymentTokens = new Set<string>();
        const maxListings = Math.min(listingCount, 256);
        for (let i = 0; i < maxListings; i++) {
          const listing = (await publicClient.readContract({
            address: contracts.otcMarket,
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
            address: contracts.otcMarket,
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
            contract: contracts.otcMarket,
            action: "otc-token",
            token,
          });
        }
      }

      if (isLockOwner) {
        const tokenLen = Number(
          await publicClient.readContract({
            address: contracts.tokenLock,
            abi: TOKEN_LOCK_ABI,
            functionName: "tokensLength",
          }),
        );
        const tracked = (await publicClient.readContract({
          address: contracts.tokenLock,
          abi: TOKEN_LOCK_ABI,
          functionName: "allTokens",
          args: [0n, BigInt(Math.min(tokenLen, 100))],
        })) as `0x${string}`[];

        for (const token of tracked) {
          const [balance, escrow] = await Promise.all([
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [contracts.tokenLock] }),
            publicClient.readContract({ address: contracts.tokenLock, abi: TOKEN_LOCK_ABI, functionName: "totalEscrowed", args: [token] }),
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
            contract: contracts.tokenLock,
            action: "lock-recover",
            token,
          });
        }
      }

      if (isVestOwner && isAddress(manualToken)) {
        const token = manualToken as `0x${string}`;
        const [balance, escrow] = await Promise.all([
          publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [contracts.vestingNFT] }),
          publicClient.readContract({ address: contracts.vestingNFT, abi: VESTING_NFT_ABI, functionName: "totalEscrowed", args: [token] }),
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
            contract: contracts.vestingNFT,
            action: "vest-recover",
            token,
          });
        }
      }

      if (isStreamOwner) {
        const farmCount = Number(
          await publicClient.readContract({ address: contracts.streamFarm, abi: STREAM_FARM_ABI, functionName: "farmCount" }),
        );
        const farmTokens = new Set<string>();
        for (let f = 0; f < farmCount; f++) {
          const farm = (await publicClient.readContract({
            address: contracts.streamFarm,
            abi: STREAM_FARM_ABI,
            functionName: "getFarm",
            args: [BigInt(f)],
          })) as readonly [string, bigint, bigint, boolean, bigint, bigint, bigint];
          farmTokens.add(farm[0].toLowerCase());
          const streamCount = Number(farm[6]);
          for (let r = 0; r < streamCount; r++) {
            const stream = (await publicClient.readContract({
              address: contracts.streamFarm,
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
            address: contracts.streamFarm,
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
            contract: contracts.streamFarm,
            action: "farm-recover",
            token,
          });
        }
      }

      setFeeRows(rows);
    } finally {
      setScanning(false);
    }
  }, [
    address,
    contracts,
    isLockOwner,
    isOtcOwner,
    isProtocolOwner,
    isStreamOwner,
    isVestOwner,
    manualToken,
    publicClient,
  ]);

  useEffect(() => {
    if (open) void scanFees();
  }, [open, scanFees]);

  const claimTx = useWriteContract();
  const claimRcpt = useWaitForTransactionReceipt({ hash: claimTx.data });

  const runClaim = useCallback(
    (row: FeeRow) => {
      if (!address) return;
      switch (row.action) {
        case "otc-native":
          claimTx.writeContract({
            address: contracts.otcMarket,
            abi: OTC_MARKET_ABI,
            functionName: "withdrawNativePayments",
          });
          break;
        case "otc-token":
          claimTx.writeContract({
            address: contracts.otcMarket,
            abi: OTC_MARKET_ABI,
            functionName: "withdrawTokenPayments",
            args: [row.token!],
          });
          break;
        case "lock-recover":
          claimTx.writeContract({
            address: contracts.tokenLock,
            abi: TOKEN_LOCK_ABI,
            functionName: "emergencyRecoverToken",
            args: [row.token!, row.amount],
          });
          break;
        case "vest-recover":
          claimTx.writeContract({
            address: contracts.vestingNFT,
            abi: VESTING_NFT_ABI,
            functionName: "emergencyRecoverToken",
            args: [row.token!, row.amount],
          });
          break;
        case "farm-recover":
          claimTx.writeContract({
            address: contracts.streamFarm,
            abi: STREAM_FARM_ABI,
            functionName: "recoverTokens",
            args: [row.token!, row.amount],
          });
          break;
      }
    },
    [address, claimTx, contracts],
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

  const claimBusy = claimTx.isPending || claimRcpt.isLoading;

  return (
    <Modal open={open} onClose={onClose} title="Claim fees">
      {!isProtocolOwner ? (
        <p className="font-mono text-[12px] leading-relaxed" style={{ color: theme.textMuted }}>
          Connect the deployer wallet — the on-chain <code style={{ color: theme.purpleBright }}>owner()</code> on
          StreamFarm, Token Lock, Vesting, or OTC.
        </p>
      ) : (
        <div className="space-y-5">
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
            Withdraw accumulated protocol fees. Lock, vest, and farm fees usually go straight to your wallet; OTC
            fees and stray recoverable balances show up here.
          </p>

          <div className="grid sm:grid-cols-2 gap-2 font-mono text-[10px]">
            <OwnerPill label="StreamFarm" owner={streamOwner} active={isStreamOwner} />
            <OwnerPill label="Token Lock" owner={lockOwner} active={isLockOwner} />
            <OwnerPill label="Vesting NFT" owner={vestOwner} active={isVestOwner} />
            <OwnerPill label="OTC Market" owner={otcOwner} active={isOtcOwner} />
          </div>

          {isVestOwner && (
            <label className="block space-y-1.5">
              <span className="font-grotesk text-[10px] uppercase tracking-wider" style={{ color: theme.textDim }}>
                Vesting token (optional)
              </span>
              <input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value.trim())}
                placeholder="0x… paste ERC-20 to scan"
                className="w-full rounded-xl px-3 py-2.5 font-mono text-[11px] outline-none"
                style={{
                  background: theme.bgElevated,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                }}
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <ActionBtn onClick={() => void scanFees()} disabled={scanning}>
              {scanning ? "Scanning…" : "Refresh"}
            </ActionBtn>
            <ActionBtn onClick={claimAll} disabled={!feeRows.length || claimBusy || scanning} primary>
              {claimBusy
                ? claimIndex != null
                  ? `Claiming ${claimIndex + 1}/${feeRows.length}…`
                  : "Claiming…"
                : "Claim all"}
            </ActionBtn>
          </div>

          {isOtcOwner && nativePendingQ.data != null && nativePendingQ.data > 0n && (
            <p className="font-mono text-[10px]" style={{ color: theme.textDim }}>
              OTC MON pending: {formatAmt(nativePendingQ.data as bigint, 18, NATIVE)}
            </p>
          )}

          {feeRows.length === 0 && !scanning ? (
            <p className="font-mono text-[11px] py-2" style={{ color: theme.textMuted }}>
              No claimable fees found right now.
            </p>
          ) : (
            <div className="space-y-2">
              {feeRows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-4 py-3"
                  style={{ background: theme.purpleGlass, border: `1px solid ${theme.border}` }}
                >
                  <div className="min-w-0">
                    <p className="font-grotesk text-[13px]">{row.label}</p>
                    <p className="font-mono text-[10px] mt-0.5" style={{ color: theme.textDim }}>
                      {formatAmt(row.amount, row.decimals, row.symbol)}
                    </p>
                  </div>
                  <ActionBtn
                    small
                    onClick={() => {
                      setClaimIndex(null);
                      runClaim(row);
                    }}
                    disabled={claimBusy}
                  >
                    Claim
                  </ActionBtn>
                </div>
              ))}
            </div>
          )}

          {batchDone && (
            <p className="font-mono text-[11px]" style={{ color: theme.success }}>
              All pending claims submitted.
            </p>
          )}
          {claimTx.error && (
            <p className="font-mono text-[11px]" style={{ color: theme.error }}>
              {(claimTx.error as Error).message?.slice(0, 160) ?? "Transaction failed"}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function OwnerPill({ label, owner, active }: { label: string; owner?: string; active: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: active ? "rgba(52,211,153,0.08)" : theme.purpleGlass,
        border: `1px solid ${active ? "rgba(52,211,153,0.25)" : theme.border}`,
      }}
    >
      <p style={{ color: active ? theme.success : theme.textMuted }}>{label}</p>
      <p className="mt-0.5 truncate" style={{ color: theme.textDim }}>
        {owner ? shortAddr(owner) : "…"}
        {active ? " · you" : ""}
      </p>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
  small,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full font-grotesk uppercase tracking-wider disabled:opacity-50 shrink-0 ${
        small ? "px-4 py-2 text-[10px]" : "px-5 py-2.5 text-[11px]"
      }`}
      style={
        primary
          ? {
              background: theme.btnBg,
              color: theme.text,
              border: `1px solid ${theme.btnBorder}`,
            }
          : {
              background: theme.bgElevated,
              color: theme.textMuted,
              border: `1px solid ${theme.border}`,
            }
      }
    >
      {children}
    </button>
  );
}
