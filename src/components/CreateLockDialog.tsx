import { useEffect, useRef, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CheckCircle2 } from "lucide-react";
import { Modal } from "./Modal";
import { TokenPicker } from "./TokenPicker";
import { DurationPicker } from "./DurationPicker";
import { useContractAddresses } from "@/lib/web3/hooks";
import { TOKEN_LOCK_ABI } from "@/lib/web3/contracts";
import { ERC20_ABI, type TokenInfo } from "@/lib/web3/tokens";
import { formatAmount } from "@/lib/web3/format";
import { useToast } from "./Toast";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

type Props = { open: boolean; onClose: () => void };

export function CreateLockDialog({ open, onClose }: Props) {
  const { address } = useAccount();
  const { tokenLock } = useContractAddresses();
  const { toast } = useToast();
  const [token, setToken] = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(30 * 86400);
  const [confirmed, setConfirmed] = useState(false);

  const autoLockRef = useRef(false);

  const parsedAmount = (() => {
    if (!token || !amount) return 0n;
    try { return parseUnits(amount, token.decimals); } catch { return 0n; }
  })();

  const allowanceQ = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token ? [address, tokenLock] : undefined,
    query: {
      enabled: !!address && !!token && token.address !== ZERO,
      refetchInterval: 2000,
    },
  });
  const allowance = (allowanceQ.data as bigint | undefined) ?? 0n;
  const needsApproval = parsedAmount > 0n && parsedAmount > allowance;

  const approveTx = useWriteContract();
  const lockTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const lockRcpt = useWaitForTransactionReceipt({ hash: lockTx.data });

  useEffect(() => {
    if (approveRcpt.isSuccess && autoLockRef.current) {
      autoLockRef.current = false;
      allowanceQ.refetch().then(() => {
        if (!token) return;
        const unlockAt = BigInt(Math.floor(Date.now() / 1000) + duration);
        lockTx.writeContract({
          address: tokenLock,
          abi: TOKEN_LOCK_ABI,
          functionName: "createLock",
          args: [token.address, parsedAmount, unlockAt],
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  useEffect(() => {
    if (lockRcpt.isSuccess) {
      setConfirmed(true);
      toast(
        "success",
        "Tokens locked",
        token ? `${formatUnits(parsedAmount, token.decimals)} ${token.symbol} locked successfully.` : undefined,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockRcpt.isSuccess]);

  const handleApproveAndLock = () => {
    if (!token) return;
    autoLockRef.current = true;
    approveTx.writeContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [tokenLock, maxUint256],
    });
  };

  const handleLock = () => {
    if (!token) return;
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + duration);
    lockTx.writeContract({
      address: tokenLock,
      abi: TOKEN_LOCK_ABI,
      functionName: "createLock",
      args: [token.address, parsedAmount, unlockAt],
    });
  };

  const handleClose = () => {
    setConfirmed(false);
    approveTx.reset();
    lockTx.reset();
    autoLockRef.current = false;
    onClose();
  };

  const factoryUnset = tokenLock === ZERO;
  const approving = approveTx.isPending || approveRcpt.isLoading;
  const locking = lockTx.isPending || lockRcpt.isLoading;
  const busy = approving || locking;
  const unlockDate = new Date(Date.now() + duration * 1000);

  return (
    <Modal open={open} onClose={handleClose} title="New Lock">

      {/* ── Confirmation screen ── */}
      {confirmed ? (
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(155,127,212,0.2)", border: "1px solid rgba(155,127,212,0.55)" }}
          >
            <CheckCircle2 className="w-7 h-7" style={{ color: "#C4A8F0" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-grotesk text-[18px] uppercase tracking-wider" style={{ color: "#EDE0FF" }}>
              Tokens Locked
            </p>
            <p className="font-mono text-[12px] mt-1" style={{ color: "rgba(196,168,240,0.6)" }}>
              Your lock has been created successfully.
            </p>
          </div>
          {token && (
            <div
              className="w-full rounded-xl px-4 py-3 space-y-2"
              style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.25)" }}
            >
              <ConfirmRow label="Token" value={token.symbol} />
              <ConfirmRow
                label="Amount"
                value={`${formatUnits(parsedAmount, token.decimals)} ${token.symbol}`}
              />
              <ConfirmRow
                label="Unlocks"
                value={unlockDate.toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                })}
              />
            </div>
          )}
          <button
            onClick={handleClose}
            className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition active:scale-[0.99]"
            style={{
              background: "rgba(155,127,212,0.2)",
              color: "#EDE0FF",
              border: "1px solid rgba(155,127,212,0.5)",
            }}
          >
            Done
          </button>
        </div>

      ) : factoryUnset ? (
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,180,50,0.9)" }}>
          TokenLock address not configured. Deploy the contract and set it in{" "}
          <code className="ml-1" style={{ color: "rgba(196,168,240,0.7)" }}>src/lib/web3/contracts.ts</code>.
        </p>
      ) : !address ? (
        <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.6)" }}>
          Connect your wallet to continue.
        </p>
      ) : (
        <div className="space-y-5">

          {/* Step 1 — Token */}
          <div>
            <Label>1. Token</Label>
            <TokenPicker selected={token} onSelect={setToken} excludeNative />
          </div>

          {token && (
            <>
              {/* Step 2 — Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>2. Amount</Label>
                  <button
                    onClick={() => setAmount(formatAmount(token.balance, token.decimals, 8))}
                    className="font-mono text-[9px] uppercase tracking-wider transition hover:opacity-80"
                    style={{ color: "rgba(196,168,240,0.55)" }}
                  >
                    Max: {formatAmount(token.balance, token.decimals)}
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="w-full bg-transparent rounded-xl px-4 py-3 font-grotesk text-[20px] outline-none transition placeholder:text-[rgba(155,127,212,0.3)]"
                  style={{
                    color: "#EDE0FF",
                    border: "1px solid rgba(155,127,212,0.3)",
                    background: "rgba(155,127,212,0.06)",
                  }}
                />
              </div>

              {/* Step 3 — Duration */}
              <div>
                <Label>3. Lock Duration</Label>
                <DurationPicker value={duration} onChange={setDuration} />
              </div>

              {/* Step progress */}
              {approving && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}
                >
                  <StepDot active done={false} />
                  <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.8)" }}>
                    Step 1 of 2 — Approving {token.symbol}…
                  </p>
                </div>
              )}
              {locking && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(155,127,212,0.08)", border: "1px solid rgba(155,127,212,0.2)" }}
                >
                  <StepDot active done={false} />
                  <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.8)" }}>
                    {needsApproval ? "Step 2 of 2 — " : ""}Locking tokens…
                  </p>
                </div>
              )}

              {/* Action button */}
              {needsApproval ? (
                <ActionButton
                  onClick={handleApproveAndLock}
                  disabled={parsedAmount === 0n || busy}
                  loading={busy}
                  label={`Approve & Lock ${token.symbol}`}
                  loadingLabel={approving ? "Approving…" : "Locking…"}
                />
              ) : (
                <ActionButton
                  onClick={handleLock}
                  disabled={parsedAmount === 0n || busy}
                  loading={busy}
                  label="Lock Tokens"
                  loadingLabel="Locking…"
                />
              )}

              {(approveTx.error || lockTx.error) && (
                <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
                  {(approveTx.error || lockTx.error)?.message}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(196,168,240,0.55)" }}>
      {children}
    </p>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
        {label}
      </span>
      <span className="font-mono text-[11px]" style={{ color: "rgba(237,224,255,0.9)" }}>
        {value}
      </span>
    </div>
  );
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0 animate-pulse"
      style={{
        background: done
          ? "rgba(100,255,160,0.8)"
          : active
          ? "#9B7FD4"
          : "rgba(155,127,212,0.25)",
      }}
    />
  );
}

function ActionButton({
  onClick, disabled, loading, label, loadingLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99]"
      style={{
        background: "rgba(155,127,212,0.2)",
        color: "#EDE0FF",
        border: "1px solid rgba(155,127,212,0.5)",
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
