import { useState, useEffect, useRef } from "react";
import { parseUnits, maxUint256 } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { CheckCircle2 } from "lucide-react";
import { Modal } from "./Modal";
import { TokenPicker } from "./TokenPicker";
import { DurationPicker } from "./DurationPicker";
import { useContractAddresses } from "@/lib/web3/hooks";
import { VESTING_NFT_ABI } from "@/lib/web3/contracts";
import { ERC20_ABI, type TokenInfo } from "@/lib/web3/tokens";
import { formatAmount } from "@/lib/web3/format";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import { useToast } from "./Toast";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const isAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

type Props = { open: boolean; onClose: () => void };

export function CreateVestingDialog({ open, onClose }: Props) {
  const { address } = useAccount();
  const { vestingNFT } = useContractAddresses();
  const { toast } = useToast();
  const publicClient = usePublicClient();

  const [token, setToken] = useState<(TokenInfo & { balance: bigint }) | undefined>();
  const [amount, setAmount] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [duration, setDuration] = useState(365 * 86400);
  const [withCliff, setWithCliff] = useState(false);
  const [cliff, setCliff] = useState(90 * 86400);

  // Capture vesting params at approve-click time to avoid stale closure
  const pendingVestRef = useRef<{
    beneficiary: `0x${string}`;
    token: `0x${string}`;
    amount: bigint;
    duration: bigint;
    cliff: bigint;
  } | null>(null);

  const parsedAmount = (() => {
    if (!token || !amount) return 0n;
    try { return parseUnits(amount, token.decimals); } catch { return 0n; }
  })();

  const allowanceQ = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token ? [address, vestingNFT] : undefined,
    query: {
      enabled: !!address && !!token && token.address !== ZERO,
      refetchInterval: 2000,
    },
  });
  const allowance = (allowanceQ.data as bigint | undefined) ?? 0n;
  const needsApproval = parsedAmount > 0n && parsedAmount > allowance;

  const approveTx = useWriteContract();
  const vestTx    = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const vestRcpt    = useWaitForTransactionReceipt({ hash: vestTx.data });

  // After approval confirmed → fire createVesting with captured params
  useEffect(() => {
    if (approveRcpt.isSuccess && pendingVestRef.current && publicClient) {
      const p = pendingVestRef.current;
      pendingVestRef.current = null;
      
      // Prepare vesting transaction with gas estimation
      const vestingRequest = {
        address: vestingNFT,
        abi: VESTING_NFT_ABI,
        functionName: "createVesting",
        args: [p.beneficiary, p.token, p.amount, p.duration, p.cliff],
        account: address,
      };

      prepareTransactionWithGas(publicClient)
        .then((gas) => {
          vestTx.writeContract({
            address: vestingNFT,
            abi: VESTING_NFT_ABI,
            functionName: "createVesting",
            args: [p.beneficiary, p.token, p.amount, p.duration, p.cliff],
            ...gas,
          });
        })
        .catch((error) => {
          console.error("[CreateVesting] Auto-vesting preparation failed:", error);
          toast("error", "Transaction Failed", "Failed to prepare vesting transaction after approval");
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess, publicClient]);

  useEffect(() => {
    if (vestRcpt.isSuccess && token) {
      toast("success", "Vesting created", `${token.symbol} vesting schedule is live.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vestRcpt.isSuccess]);

  const contractUnset = vestingNFT === ZERO;
  const validBeneficiary = isAddress(beneficiary);
  const cliffInvalid = withCliff && cliff > duration;
  const insufficientBalance = !!token && parsedAmount > 0n && parsedAmount > token.balance;
  const canSubmit =
    parsedAmount > 0n && validBeneficiary && !cliffInvalid && !insufficientBalance;

  const handleApproveAndCreate = async () => {
    if (!token || parsedAmount === 0n || !validBeneficiary || !publicClient) return;
    
    try {
      // Capture params now
      pendingVestRef.current = {
        beneficiary: beneficiary as `0x${string}`,
        token: token.address,
        amount: parsedAmount,
        duration: BigInt(duration),
        cliff: withCliff ? BigInt(cliff) : 0n,
      };

      // Prepare approval transaction with gas estimation
      const approveRequest = {
        address: token.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vestingNFT, maxUint256],
        account: address,
      };

      const gas = await prepareTransactionWithGas(publicClient);

      approveTx.writeContract({
        address: token.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vestingNFT, maxUint256],
        ...gas,
      });
    } catch (error) {
      console.error("[CreateVesting] Approve preparation failed:", error);
      toast("error", "Transaction Failed", "Failed to prepare approval transaction");
    }
  };

  const handleCreate = async () => {
    if (!token || parsedAmount === 0n || !validBeneficiary || !publicClient) return;
    
    try {
      // Prepare vesting creation transaction with gas estimation
      const vestingRequest = {
        address: vestingNFT,
        abi: VESTING_NFT_ABI,
        functionName: "createVesting",
        args: [
          beneficiary as `0x${string}`,
          token.address,
          parsedAmount,
          BigInt(duration),
          withCliff ? BigInt(cliff) : 0n,
        ],
        account: address,
      };

      const gas = await prepareTransactionWithGas(publicClient);

      vestTx.writeContract({
        address: vestingNFT,
        abi: VESTING_NFT_ABI,
        functionName: "createVesting",
        args: [
          beneficiary as `0x${string}`,
          token.address,
          parsedAmount,
          BigInt(duration),
          withCliff ? BigInt(cliff) : 0n,
        ],
        ...gas,
      });
    } catch (error) {
      console.error("[CreateVesting] Vesting creation preparation failed:", error);
      toast("error", "Transaction Failed", "Failed to prepare vesting transaction");
    }
  };

  const reset = () => {
    vestTx.reset();
    approveTx.reset();
    pendingVestRef.current = null;
    setBeneficiary("");
    setToken(undefined);
    setAmount("");
    setWithCliff(false);
    onClose();
  };

  const approving = approveTx.isPending || approveRcpt.isLoading;
  const creating  = vestTx.isPending  || vestRcpt.isLoading;
  const busy      = approving || creating;

  return (
    <Modal open={open} onClose={onClose} title="New Vesting Schedule">
      {contractUnset ? (
        <Notice tone="warn">
          VestingNFT not configured. Set the address in{" "}
          <code style={{ color: "rgba(255,255,255,0.7)" }}>src/lib/web3/contracts.ts</code>.
        </Notice>
      ) : !address ? (
        <Notice tone="info">Connect your wallet to continue.</Notice>
      ) : vestRcpt.isSuccess ? (
        <SuccessState onDone={reset} />
      ) : (
        <div className="space-y-5">

          {/* Step 1 — Token */}
          <div>
            <Label>1. Token to vest</Label>
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
                    style={{ color: "rgba(255,255,255,0.55)" }}
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
                  className="w-full bg-transparent rounded-xl px-4 py-3 font-grotesk text-[20px] outline-none transition placeholder:text-[rgba(139,92,246,0.3)]"
                  style={{
                    color: "#FFFFFF",
                    border: "1px solid rgba(139,92,246,0.3)",
                    background: "rgba(139,92,246,0.06)",
                  }}
                />
              </div>

              {/* Step 3 — Beneficiary */}
              <div>
                <Label>3. Beneficiary</Label>
                <button
                  type="button"
                  onClick={() => address && setBeneficiary(beneficiary === address ? "" : address)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-3 transition"
                  style={{
                    background: beneficiary === address ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.05)",
                    border: `1px solid ${beneficiary === address ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.2)"}`,
                  }}
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition"
                    style={{
                      background: beneficiary === address ? "#8B5CF6" : "transparent",
                      border: `1.5px solid ${beneficiary === address ? "#8B5CF6" : "rgba(139,92,246,0.4)"}`,
                    }}
                  >
                    {beneficiary === address && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="#0c0c10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="text-left min-w-0">
                    <p className="font-grotesk text-[12px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>Use my address</p>
                    <p className="font-mono text-[9px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {address ?? "Connect wallet first"}
                    </p>
                  </div>
                </button>
                <input
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value.trim())}
                  placeholder="or paste any 0x… address"
                  className="w-full bg-transparent rounded-xl px-4 py-3 font-mono text-[12px] outline-none transition placeholder:text-[rgba(139,92,246,0.35)]"
                  style={{
                    color: "#FFFFFF",
                    background: "rgba(139,92,246,0.06)",
                    border: `1px solid ${beneficiary && !validBeneficiary ? "rgba(255,100,100,0.55)" : "rgba(139,92,246,0.25)"}`,
                  }}
                />
                {beneficiary && !validBeneficiary && (
                  <p className="font-mono text-[10px] mt-1.5" style={{ color: "rgba(255,120,120,0.9)" }}>Not a valid address.</p>
                )}
              </div>

              {/* Step 4 — Duration */}
              <div>
                <Label>4. Vesting Duration</Label>
                <DurationPicker value={duration} onChange={setDuration} />
                <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Tokens release linearly over this period. E.g. 365 days = ~0.27% unlocked per day.
                </p>
              </div>

              {/* Step 5 — Cliff */}
              <div>
                <button
                  onClick={() => setWithCliff((v) => !v)}
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition"
                  style={{
                    background: withCliff ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.05)",
                    border: `1px solid ${withCliff ? "rgba(139,92,246,0.45)" : "rgba(139,92,246,0.18)"}`,
                  }}
                >
                  <div className="text-left">
                    <p className="font-grotesk text-[11px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>Add a cliff</p>
                    <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                      0% vests until cliff date, then linear from cliff → end
                    </p>
                  </div>
                  <Toggle on={withCliff} />
                </button>
                {withCliff && (
                  <div className="mt-3">
                    <DurationPicker value={cliff} onChange={setCliff} />
                    {cliffInvalid ? (
                      <p className="font-mono text-[10px] mt-2" style={{ color: "rgba(255,120,120,0.9)" }}>
                        Cliff must be ≤ vesting duration.
                      </p>
                    ) : (
                      <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Nothing claimable for the first {Math.round(cliff / 86400)} days, then linear release until end.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Step progress */}
              {approving && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: "#8B5CF6" }} />
                  <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.8)" }}>
                    Step 1 of 2 — Approving {token.symbol}…
                  </p>
                </div>
              )}
              {creating && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: "#8B5CF6" }} />
                  <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {needsApproval ? "Step 2 of 2 — " : ""}Creating vesting schedule…
                  </p>
                </div>
              )}

              {insufficientBalance && token && (
                <p className="font-mono text-[10px]" style={{ color: "rgba(255,120,120,0.9)" }}>
                  Insufficient {token.symbol} balance (have {formatAmount(token.balance, token.decimals)})
                </p>
              )}

              {/* Action */}
              {needsApproval ? (
                <ActionButton
                  onClick={handleApproveAndCreate}
                  disabled={!canSubmit || busy}
                  loading={busy}
                  label={`Approve & Create Vesting`}
                  loadingLabel={approving ? "Approving…" : "Creating…"}
                />
              ) : (
                <ActionButton
                  onClick={handleCreate}
                  disabled={!canSubmit || busy}
                  loading={busy}
                  label="Create Vesting Schedule"
                  loadingLabel="Creating…"
                />
              )}

              {(approveTx.error || vestTx.error) && (
                <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
                  {(approveTx.error || vestTx.error)?.message}
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
    <p className="font-mono text-[9px] uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
      {children}
    </p>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="relative w-9 h-5 rounded-full transition shrink-0"
      style={{ background: on ? "#8B5CF6" : "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
        style={{ left: on ? "calc(100% - 18px)" : "2px", background: on ? "#0c0c10" : "rgba(139,92,246,0.5)" }}
      />
    </span>
  );
}

function ActionButton({ onClick, disabled, loading, label, loadingLabel }: {
  onClick: () => void; disabled: boolean; loading: boolean; label: string; loadingLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition disabled:opacity-40 active:scale-[0.99]"
      style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "info" | "warn" }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
      <p className="font-mono text-[11px] leading-relaxed" style={{ color: tone === "warn" ? "rgba(255,180,50,0.9)" : "rgba(255,255,255,0.7)" }}>
        {children}
      </p>
    </div>
  );
}

function SuccessState({ onDone }: { onDone: () => void }) {
  return (
    <div className="text-center py-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.55)" }}
      >
        <CheckCircle2 className="w-6 h-6" style={{ color: "#A78BFA" }} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk uppercase tracking-wider text-[16px] mb-1" style={{ color: "#FFFFFF" }}>
        Vesting Created
      </p>
      <p className="font-mono text-[10px] max-w-[280px] mx-auto leading-relaxed mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
        Tokens are locked in the vesting contract and will release linearly to the beneficiary.
      </p>
      <button
        onClick={onDone}
        className="mt-5 w-full rounded-xl py-3 font-grotesk text-[12px] uppercase tracking-wider transition active:scale-[0.99]"
        style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
      >
        Done
      </button>
    </div>
  );
}
