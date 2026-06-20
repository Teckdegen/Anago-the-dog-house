import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Settings2, ChevronLeft, ChevronRight, Shield, UserPlus } from "lucide-react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseEventLogs, parseUnits } from "viem";
import { STREAM_FARM_ABI, CONTRACTS, ERC20_ABI } from "@/lib/web3/contracts";
import { LIVE_CHAIN_QUERY } from "@/lib/web3/nftImage";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import { formatFeePercent, netAfterPlatformFee, platformFeeAmount } from "@/lib/web3/platformFee";
import { PlatformFeeValue } from "@/components/PlatformFeeValue";
import { useToast } from "@/components/Toast";
import { SuccessModal } from "@/components/SuccessModal";
import { useTransactionSuccess } from "@/lib/web3/useTransactionSuccess";
import { TokenPicker } from "@/components/TokenPicker";
import { TokenIcon } from "@/components/TokenIcon";
import { useRemoteTokenMeta } from "@/lib/web3/useRemoteTokenMeta";
import type { TokenInfo } from "@/lib/web3/tokens";
import { useIsFarmOperator, useIsStreamFarmAdmin, useIsStreamFarmOwner } from "@/lib/web3/useStreamFarmRoles";
import { computeRewardStreamWindow, parseFarmTuple } from "@/lib/web3/parseFarm";

const isEthAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

function useContracts() {
  const chainId = useChainId();
  return CONTRACTS[chainId] ?? CONTRACTS[143];
}

/** Reward budget must be strictly less than wallet balance (leave headroom for gas). */
function useRewardBudget(token: TokenInfo | null, budget: string) {
  const { address } = useAccount();

  const decimalsQ = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!token?.address },
  });
  const balanceOfQ = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address && token?.address ? [address] : undefined,
    query: { enabled: !!address && !!token?.address, refetchInterval: 5_000 },
  });

  const decimals = token?.decimals ?? (decimalsQ.data as number) ?? 18;
  const balance = (balanceOfQ.data as bigint) ?? 0n;

  const parsedBudget = (() => {
    try {
      return budget ? parseUnits(budget, decimals) : 0n;
    } catch {
      return 0n;
    }
  })();

  const maxAllowed = balance > 0n ? balance - 1n : 0n;
  const isWholeBalance = parsedBudget > 0n && balance > 0n && parsedBudget >= balance;
  const exceedsBalance = parsedBudget > balance;
  const validBudget = parsedBudget > 0n && parsedBudget <= maxAllowed;

  return {
    decimals,
    balance,
    maxAllowed,
    parsedBudget,
    validBudget,
    isWholeBalance,
    exceedsBalance,
  };
}

const farmFieldLabel = "block font-grotesk text-[13px] sm:text-[14px] font-semibold uppercase tracking-wide mb-1";
const farmFieldHint = "block font-mono text-[10px] mb-2";
const farmInput =
  "w-full rounded-xl px-4 py-3 font-mono text-[14px] font-medium outline-none transition focus:ring-2 focus:ring-violet-500/40";

function FarmFieldLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <span className={farmFieldLabel} style={{ color: "#FFFFFF" }}>{title}</span>
      {hint && (
        <span className={farmFieldHint} style={{ color: "rgba(255,255,255,0.5)" }}>{hint}</span>
      )}
    </div>
  );
}

function RewardStreamFields({
  token,
  onTokenSelect,
  budget,
  onBudgetChange,
  days,
  onDaysChange,
  delayHours,
  onDelayHoursChange,
  budgetMeta,
  compact,
}: {
  token: TokenInfo | null;
  onTokenSelect: (t: TokenInfo | null) => void;
  budget: string;
  onBudgetChange: (v: string) => void;
  days: string;
  onDaysChange: (v: string) => void;
  delayHours: string;
  onDelayHoursChange: (v: string) => void;
  budgetMeta: ReturnType<typeof useRewardBudget>;
  compact?: boolean;
}) {
  const { decimals, balance, maxAllowed, parsedBudget, validBudget, isWholeBalance, exceedsBalance } = budgetMeta;

  const setMaxBudget = () => {
    if (maxAllowed <= 0n) return;
    onBudgetChange(formatUnits(maxAllowed, decimals));
  };

  const inputStyle = {
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(139,92,246,0.45)",
    color: "#FFFFFF",
  };

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div>
        <FarmFieldLabel
          title="Reward token"
          hint="Token deposited into the reward stream for farmers to earn."
        />
        <TokenPicker selected={token} onSelect={onTokenSelect} excludeNative compact={compact} />
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <FarmFieldLabel
              title="Total reward budget"
              hint={`Full amount you fund upfront. A ${formatFeePercent()} platform fee is deducted in tokens; the rest streams to farmers.`}
            />
          </div>
          {token && balance > 0n && (
            <button
              type="button"
              onClick={setMaxBudget}
              className="shrink-0 mt-0.5 font-grotesk text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg transition hover:opacity-80"
              style={{ color: "#C4B5FD", background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              Use max
            </button>
          )}
        </div>
        <input
          placeholder="0.0"
          value={budget}
          onChange={(e) => onBudgetChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className={farmInput}
          style={inputStyle}
        />
        {parsedBudget > 0n && token && (
          <div className="mt-2 space-y-1 font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            <p>Streams to farmers: {formatUnits(netAfterPlatformFee(parsedBudget), decimals)} {token.symbol}</p>
            <p className="flex items-center gap-2 flex-wrap">
              <span>Platform fee:</span>
              <PlatformFeeValue amount={platformFeeAmount(parsedBudget)} decimals={decimals} symbol={token.symbol} />
            </p>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <FarmFieldLabel
            title="Emission duration (days)"
            hint="How many days rewards drip out to stakers."
          />
          <input
            inputMode="numeric"
            placeholder="30"
            value={days}
            onChange={(e) => onDaysChange(e.target.value.replace(/[^0-9]/g, ""))}
            className={farmInput}
            style={inputStyle}
          />
        </div>
        <div>
          <FarmFieldLabel
            title="Start delay (hours)"
            hint="Wait before emissions start. 0 = ~2 min from now (chain time buffer)."
          />
          <input
            inputMode="numeric"
            placeholder="0"
            value={delayHours}
            onChange={(e) => onDelayHoursChange(e.target.value.replace(/[^0-9]/g, ""))}
            className={farmInput}
            style={inputStyle}
          />
        </div>
      </div>

      {token && balance === 0n && (
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,180,100,0.9)" }}>
          No {token.symbol} balance in wallet.
        </p>
      )}
      {isWholeBalance && (
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,100,100,0.9)" }}>
          Cannot use your entire balance — leave at least 1 wei for gas and rounding.
        </p>
      )}
      {exceedsBalance && !isWholeBalance && (
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,100,100,0.9)" }}>
          Budget exceeds wallet balance.
        </p>
      )}
      {parsedBudget > 0n && validBudget && token && (
        <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
          Available: {Number(formatUnits(balance, decimals)).toLocaleString()} {token.symbol}
        </p>
      )}
    </div>
  );
}

/** Create / manage farms — shown on Create & Manage tab for operators and protocol admins. */
export function FarmManagePanel() {
  const { address } = useAccount();
  const { isFarmOperator } = useIsFarmOperator();
  const { isAdmin } = useIsStreamFarmAdmin();

  if (!address) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <p className="font-grotesk text-[13px]" style={{ color: "#FFFFFF" }}>Connect wallet to create farms</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && <FarmAdminSettings />}
      {isFarmOperator ? (
        <>
          <CreateFarmForm />
          <MyFarmsList />
        </>
      ) : isAdmin ? (
        <div
          className="rounded-xl p-5 text-center"
          style={{ border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.05)" }}
        >
          <p className="font-grotesk text-[13px] font-medium" style={{ color: "#FFFFFF" }}>
            You are a protocol admin
          </p>
          <p className="font-mono text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            Use the panel above to whitelist wallets. Only whitelisted creators can launch farms.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FarmAdminSettings() {
  const { toast } = useToast();
  const contracts = useContracts();
  const publicClient = usePublicClient();
  const { isOwner, owner } = useIsStreamFarmOwner();
  const [open, setOpen] = useState(false);
  const [operatorAddr, setOperatorAddr] = useState("");
  const [adminAddr, setAdminAddr] = useState("");

  const allowTx = useWriteContract();
  const allowRcpt = useWaitForTransactionReceipt({ hash: allowTx.data });
  const revokeTx = useWriteContract();
  const revokeRcpt = useWaitForTransactionReceipt({ hash: revokeTx.data });
  const addAdminTx = useWriteContract();
  const addAdminRcpt = useWaitForTransactionReceipt({ hash: addAdminTx.data });
  const removeAdminTx = useWriteContract();
  const removeAdminRcpt = useWaitForTransactionReceipt({ hash: removeAdminTx.data });

  const operatorCheck = (operatorAddr || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const operatorQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "farmOperators",
    args: [operatorCheck],
    query: { enabled: isEthAddress(operatorAddr), refetchInterval: 5_000 },
  });
  const operatorIsAdminQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "isAdmin",
    args: [operatorCheck],
    query: { enabled: isEthAddress(operatorAddr), refetchInterval: 5_000 },
  });
  const operatorIsOperatorQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "isFarmOperator",
    args: [operatorCheck],
    query: { enabled: isEthAddress(operatorAddr), refetchInterval: 5_000 },
  });

  const adminCheck = (adminAddr || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const adminQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "admins",
    args: [adminCheck],
    query: { enabled: isEthAddress(adminAddr), refetchInterval: 5_000 },
  });

  const isWhitelisted = operatorQ.data === true;
  const canCreateFarms = operatorIsOperatorQ.data === true;
  const isProtocolAdmin = adminQ.data === true || (!!owner && adminAddr.toLowerCase() === owner.toLowerCase());

  const inputStyle = {
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(139,92,246,0.45)",
    color: "#FFFFFF",
  };

  const writeSetFarmOperator = async (operator: `0x${string}`, allowed: boolean) => {
    if (!publicClient) return;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      (allowed ? allowTx : revokeTx).writeContract({
        address: contracts.streamFarm,
        abi: STREAM_FARM_ABI,
        functionName: "setFarmOperator",
        args: [operator, allowed],
        ...gas,
      });
    } catch (e) {
      toast("error", "Transaction failed", (e as Error).message?.slice(0, 120) ?? "Failed");
    }
  };

  const writeAddAdmin = async (admin: `0x${string}`) => {
    if (!publicClient) return;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      addAdminTx.writeContract({
        address: contracts.streamFarm,
        abi: STREAM_FARM_ABI,
        functionName: "addAdmin",
        args: [admin],
        ...gas,
      });
    } catch (e) {
      toast("error", "Add admin failed", (e as Error).message?.slice(0, 120) ?? "Failed");
    }
  };

  const writeRemoveAdmin = async (admin: `0x${string}`) => {
    if (!publicClient) return;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      removeAdminTx.writeContract({
        address: contracts.streamFarm,
        abi: STREAM_FARM_ABI,
        functionName: "removeAdmin",
        args: [admin],
        ...gas,
      });
    } catch (e) {
      toast("error", "Remove admin failed", (e as Error).message?.slice(0, 120) ?? "Failed");
    }
  };

  useEffect(() => {
    if (allowRcpt.isSuccess) toast("success", "Whitelisted", "Wallet can now create farms.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowRcpt.isSuccess]);

  useEffect(() => {
    if (revokeRcpt.isSuccess) toast("success", "Revoked", "Wallet can no longer create farms.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revokeRcpt.isSuccess]);

  useEffect(() => {
    if (addAdminRcpt.isSuccess) toast("success", "Admin added", "Wallet is now a protocol admin.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addAdminRcpt.isSuccess]);

  useEffect(() => {
    if (removeAdminRcpt.isSuccess) toast("success", "Admin removed", "Wallet is no longer a protocol admin.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeAdminRcpt.isSuccess]);

  const operatorBusy = allowTx.isPending || allowRcpt.isLoading || revokeTx.isPending || revokeRcpt.isLoading;
  const adminBusy = addAdminTx.isPending || addAdminRcpt.isLoading || removeAdminTx.isPending || removeAdminRcpt.isLoading;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.45)", background: "rgba(0,0,0,0.35)" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-5"
        style={{ background: "rgba(139,92,246,0.12)" }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: "#A78BFA" }} />
          <span className="font-grotesk text-[15px] font-semibold uppercase tracking-wider" style={{ color: "#FFFFFF" }}>
            Protocol admin
          </span>
          {isOwner && (
            <span
              className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-full"
              style={{ color: "#C4B5FD", background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              Deployer
            </span>
          )}
        </div>
        <span className="font-grotesk text-[11px] font-medium uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="p-5 sm:p-6 space-y-8" style={{ borderTop: "1px solid rgba(139,92,246,0.25)" }}>
          <div className="space-y-4">
            <div>
              <h3 className="font-grotesk text-[18px] sm:text-[20px] font-semibold" style={{ color: "#FFFFFF" }}>
                Whitelist farm creators
              </h3>
              <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                Allow a wallet to create and manage its own farms on Stream Farms.
              </p>
            </div>

            <div>
              <FarmFieldLabel title="Wallet address" hint="Paste the full 0x address." />
              <input
                value={operatorAddr}
                onChange={(e) => setOperatorAddr(e.target.value.trim())}
                placeholder="0x…"
                className={farmInput}
                style={inputStyle}
              />
            </div>

            {isEthAddress(operatorAddr) && (
              <p className="font-mono text-[11px]" style={{ color: canCreateFarms ? "#6EE7B7" : "rgba(255,255,255,0.45)" }}>
                {operatorQ.isLoading || operatorIsOperatorQ.isLoading
                  ? "Checking on-chain…"
                  : canCreateFarms
                    ? operatorIsAdminQ.data
                      ? "Can create farms (protocol admin)"
                      : isWhitelisted
                        ? "Whitelisted — can create farms"
                        : "Can create farms (owner)"
                    : "Not whitelisted — cannot create farms"}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => writeSetFarmOperator(operatorAddr as `0x${string}`, true)}
                disabled={!isEthAddress(operatorAddr) || operatorBusy}
                className="flex-1 rounded-xl py-3 font-grotesk text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40"
                style={{ background: "rgba(139,92,246,0.35)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.65)" }}
              >
                {allowTx.isPending || allowRcpt.isLoading ? "Whitelisting…" : "Whitelist wallet"}
              </button>
              <button
                type="button"
                onClick={() => writeSetFarmOperator(operatorAddr as `0x${string}`, false)}
                disabled={!isEthAddress(operatorAddr) || operatorBusy}
                className="flex-1 rounded-xl py-3 font-grotesk text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40"
                style={{ background: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.35)" }}
              >
                {revokeTx.isPending || revokeRcpt.isLoading ? "Revoking…" : "Revoke access"}
              </button>
            </div>
          </div>

          {isOwner && (
            <div className="space-y-4 pt-6" style={{ borderTop: "1px solid rgba(139,92,246,0.2)" }}>
              <div>
                <h3 className="font-grotesk text-[18px] sm:text-[20px] font-semibold flex items-center gap-2" style={{ color: "#FFFFFF" }}>
                  <UserPlus className="w-5 h-5" style={{ color: "#A78BFA" }} />
                  Manage protocol admins
                </h3>
                <p className="font-mono text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Only the deployer can add or remove admins. Admins can whitelist farm creators.
                </p>
              </div>

              <div>
                <FarmFieldLabel title="Admin wallet address" />
                <input
                  value={adminAddr}
                  onChange={(e) => setAdminAddr(e.target.value.trim())}
                  placeholder="0x…"
                  className={farmInput}
                  style={inputStyle}
                />
              </div>

              {isEthAddress(adminAddr) && (
                <p className="font-mono text-[11px]" style={{ color: isProtocolAdmin ? "#6EE7B7" : "rgba(255,255,255,0.45)" }}>
                  {adminQ.isLoading
                    ? "Checking on-chain…"
                    : isProtocolAdmin
                      ? adminAddr.toLowerCase() === owner?.toLowerCase()
                        ? "Contract deployer (owner)"
                        : "Already a protocol admin"
                      : "Not a protocol admin"}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => writeAddAdmin(adminAddr as `0x${string}`)}
                  disabled={!isEthAddress(adminAddr) || adminBusy}
                  className="flex-1 rounded-xl py-3 font-grotesk text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40"
                  style={{ background: "rgba(139,92,246,0.35)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.65)" }}
                >
                  {addAdminTx.isPending || addAdminRcpt.isLoading ? "Adding…" : "Add admin"}
                </button>
                <button
                  type="button"
                  onClick={() => writeRemoveAdmin(adminAddr as `0x${string}`)}
                  disabled={!isEthAddress(adminAddr) || adminBusy || adminAddr.toLowerCase() === owner?.toLowerCase()}
                  className="flex-1 rounded-xl py-3 font-grotesk text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40"
                  style={{ background: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.35)" }}
                >
                  {removeAdminTx.isPending || removeAdminRcpt.isLoading ? "Removing…" : "Remove admin"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateFarmForm() {
  const { address } = useAccount();
  const { toast } = useToast();
  const contracts = useContracts();
  const publicClient = usePublicClient();
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [rewardToken, setRewardToken] = useState<TokenInfo | null>(null);
  const [lockDays, setLockDays] = useState("0");
  const [penalty, setPenalty] = useState("0");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("30");
  const [delayHours, setDelayHours] = useState("0");
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successRows, setSuccessRows] = useState<{ label: string; value: string }[]>([]);

  const createTx = useWriteContract();
  const createRcpt = useWaitForTransactionReceipt({ hash: createTx.data });
  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const addTx = useWriteContract();
  const addRcpt = useWaitForTransactionReceipt({ hash: addTx.data });

  const pendingFarmIdRef = useRef<bigint | null>(null);
  const createHandledRef = useRef<string | null>(null);
  const autoApproveRef = useRef(false);
  const autoAddRef = useRef(false);

  const rewardBudget = useRewardBudget(rewardToken, budget);

  const resetForm = () => {
    setToken(null);
    setRewardToken(null);
    setLockDays("0");
    setPenalty("0");
    setBudget("");
    setDays("30");
    setDelayHours("0");
    setPhase(1);
    pendingFarmIdRef.current = null;
    createHandledRef.current = null;
    autoApproveRef.current = false;
    autoAddRef.current = false;
  };

  const runAddReward = async (farmId: bigint) => {
    if (!rewardToken || !publicClient || !rewardBudget.validBudget) return;
    try {
      const { start, end } = await computeRewardStreamWindow(
        publicClient,
        parseInt(delayHours, 10) || 0,
        parseInt(days, 10) || 30,
      );
      const gas = await prepareTransactionWithGas(publicClient);
      addTx.writeContract({
        address: contracts.streamFarm,
        abi: STREAM_FARM_ABI,
        functionName: "addRewardStream",
        args: [farmId, rewardToken.address, rewardBudget.parsedBudget, start, end],
        ...gas,
      });
    } catch (e) {
      toast("error", "Reward failed", (e as Error).message?.slice(0, 120) ?? "Failed to add stream");
    }
  };

  const runApprove = async () => {
    if (!rewardToken || !publicClient || !rewardBudget.validBudget) return;
    const gas = await prepareTransactionWithGas(publicClient);
    approveTx.writeContract({
      address: rewardToken.address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contracts.streamFarm, rewardBudget.parsedBudget],
      ...gas,
    });
  };

  const handleCreate = async () => {
    if (!token || !rewardToken || !publicClient || !rewardBudget.validBudget) return;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      createTx.writeContract({
        address: contracts.streamFarm,
        abi: STREAM_FARM_ABI,
        functionName: "createFarm",
        args: [
          token.address,
          BigInt((parseInt(lockDays, 10) || 0) * 86400),
          BigInt(Math.round((parseFloat(penalty) || 0) * 100)),
        ],
        ...gas,
      });
    } catch (e) {
      toast("error", "Create failed", (e as Error).message?.slice(0, 120) ?? "Transaction failed");
    }
  };

  useEffect(() => {
    const txHash = createRcpt.data?.transactionHash;
    if (!createRcpt.isSuccess || !txHash || !publicClient || !address || !rewardToken) return;
    if (createHandledRef.current === txHash) return;
    if (!rewardBudget.validBudget) return;

    createHandledRef.current = txHash;

    void (async () => {
      try {
        const parsed = parseEventLogs({
          abi: STREAM_FARM_ABI,
          logs: createRcpt.data!.logs,
          eventName: "FarmCreated",
        });
        const farmId = parsed[0]?.args.farmId as bigint | undefined;
        if (farmId == null) {
          toast("error", "Farm created", "Could not read new farm ID — add rewards manually below.");
          return;
        }
        pendingFarmIdRef.current = farmId;

        const currentAllowance = await publicClient.readContract({
          address: rewardToken.address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, contracts.streamFarm],
        });

        if (currentAllowance < rewardBudget.parsedBudget) {
          autoApproveRef.current = true;
          autoAddRef.current = true;
          await runApprove();
        } else {
          autoAddRef.current = true;
          await runAddReward(farmId);
        }
      } catch {
        toast("error", "Farm created", "Add reward stream manually in My farms.");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRcpt.isSuccess, createRcpt.data?.transactionHash, publicClient, address, rewardToken, rewardBudget.validBudget]);

  useEffect(() => {
    if (!approveRcpt.isSuccess || !autoApproveRef.current || pendingFarmIdRef.current == null) return;
    autoApproveRef.current = false;
    runAddReward(pendingFarmIdRef.current).catch(() => {
      autoAddRef.current = false;
      toast("error", "Reward failed", "Farm created — add reward stream in My farms.");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  useTransactionSuccess(addTx, addRcpt, () => {
    const farmId = pendingFarmIdRef.current;
    setSuccessRows([
      { label: "Stake token", value: token?.symbol ?? "—" },
      { label: "Reward token", value: rewardToken?.symbol ?? "—" },
      { label: "Reward budget", value: budget ? `${budget} ${rewardToken?.symbol ?? ""}`.trim() : "—" },
      { label: "Farm ID", value: farmId != null ? `#${farmId.toString()}` : "—" },
    ]);
    setSuccessOpen(true);
    resetForm();
    createTx.reset();
    approveTx.reset();
    addTx.reset();
  });

  const busy =
    createTx.isPending ||
    createRcpt.isLoading ||
    approveTx.isPending ||
    approveRcpt.isLoading ||
    addTx.isPending ||
    addRcpt.isLoading;

  const stepLabel = (() => {
    if (createTx.isPending || createRcpt.isLoading) return "Step 1 of 3 — Creating farm…";
    if (approveTx.isPending || approveRcpt.isLoading) return "Step 2 of 3 — Approving reward token…";
    if (addTx.isPending || addRcpt.isLoading) return "Step 3 of 3 — Funding reward stream…";
    return null;
  })();

  const canSubmit = !!token && !!rewardToken && rewardBudget.validBudget && !busy;
  const canAdvancePhase1 = !!token;
  const inputStyle = {
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(139,92,246,0.45)",
    color: "#FFFFFF",
  };

  const toggleOpen = () => {
    setOpen((prev) => {
      if (prev) setPhase(1);
      return !prev;
    });
  };

  return (
    <>
      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Stream Farms"
        heading="Farm Created"
        subtext="Your farm is live and the initial reward stream has been funded."
        rows={successRows}
      />
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.45)", background: "rgba(0,0,0,0.35)" }}>
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between gap-3 p-5"
        style={{ background: "rgba(139,92,246,0.08)" }}
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4" style={{ color: "#A78BFA" }} />
          <span className="font-grotesk text-[15px] font-semibold uppercase tracking-wider" style={{ color: "#FFFFFF" }}>
            Create new farm
          </span>
        </div>
        <span className="font-grotesk text-[11px] font-medium uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="p-5 sm:p-6 space-y-6" style={{ borderTop: "1px solid rgba(139,92,246,0.25)" }}>
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-grotesk text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#C4B5FD" }}>
                Step {phase} of 2
              </span>
              <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                {phase === 1 ? "Farm setup" : "Fund rewards"}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.15)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: phase === 1 ? "50%" : "100%", background: "linear-gradient(90deg, #7C3AED, #A78BFA)" }}
              />
            </div>
          </div>

          {phase === 1 ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="font-grotesk text-[20px] sm:text-[24px] font-semibold leading-tight mb-1" style={{ color: "#FFFFFF" }}>
                  Which token will users stake?
                </h3>
                <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  This is the token farmers deposit to earn rewards.
                </p>
              </div>

              <div>
                <FarmFieldLabel title="Stake token" />
                <TokenPicker selected={token} onSelect={setToken} excludeNative />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <FarmFieldLabel
                    title="Lock period (days)"
                    hint="How long deposits stay locked. Use 0 for no lock."
                  />
                  <input
                    inputMode="numeric"
                    value={lockDays}
                    onChange={(e) => setLockDays(e.target.value.replace(/[^0-9]/g, ""))}
                    className={farmInput}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FarmFieldLabel
                    title="Early exit penalty (%)"
                    hint="Token penalty if users withdraw before lock ends. Collected by protocol admin, not the farm creator."
                  />
                  <input
                    inputMode="decimal"
                    value={penalty}
                    onChange={(e) => setPenalty(e.target.value.replace(/[^0-9.]/g, ""))}
                    className={farmInput}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPhase(2)}
                disabled={!canAdvancePhase1}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-grotesk text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40 transition hover:opacity-90"
                style={{ background: "rgba(139,92,246,0.35)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.65)" }}
              >
                Continue to rewards
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="font-grotesk text-[20px] sm:text-[24px] font-semibold leading-tight mb-1" style={{ color: "#FFFFFF" }}>
                  Fund the reward stream
                </h3>
                <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Choose the reward token, budget, and how long emissions run.
                </p>
              </div>

              {token && (
                <div
                  className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.35)" }}
                >
                  <span className="font-grotesk text-[11px] font-semibold uppercase" style={{ color: "#C4B5FD" }}>Farm preview</span>
                  <span className="font-mono text-[11px]" style={{ color: "#FFFFFF" }}>
                    Stake: <strong>{token.symbol}</strong>
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Lock: {lockDays || "0"} days
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Penalty: {penalty || "0"}%
                  </span>
                </div>
              )}

              <div
                className="rounded-xl p-5 sm:p-6"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.3)" }}
              >
                <p className="font-grotesk text-[13px] font-semibold uppercase tracking-wide mb-5" style={{ color: "#A78BFA" }}>
                  Initial reward stream
                </p>
                <RewardStreamFields
                  token={rewardToken}
                  onTokenSelect={setRewardToken}
                  budget={budget}
                  onBudgetChange={setBudget}
                  days={days}
                  onDaysChange={setDays}
                  delayHours={delayHours}
                  onDelayHoursChange={setDelayHours}
                  budgetMeta={rewardBudget}
                />
              </div>

              {stepLabel && (
                <p className="font-grotesk text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{stepLabel}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setPhase(1)}
                  disabled={busy}
                  className="sm:w-auto flex items-center justify-center gap-2 rounded-xl py-3 px-5 font-grotesk text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40 transition hover:opacity-90"
                  style={{ background: "rgba(0,0,0,0.4)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.35)" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canSubmit}
                  className="flex-1 rounded-xl py-3.5 font-grotesk text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40 transition hover:opacity-90"
                  style={{ background: "rgba(139,92,246,0.4)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.7)" }}
                >
                  {busy ? "Processing…" : "Create farm & fund rewards"}
                </button>
              </div>

              {createTx.error && (
                <p className="font-mono text-[11px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
                  {(createTx.error as Error).message?.slice(0, 160)}
                </p>
              )}
              {(approveTx.error || addTx.error) && (
                <p className="font-mono text-[11px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
                  {((approveTx.error || addTx.error) as Error).message?.slice(0, 160)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function MyFarmsList() {
  const { address } = useAccount();
  const contracts = useContracts();

  const myFarmsQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "farmsOfCreator",
    args: address ? [address] : undefined,
    query: { ...LIVE_CHAIN_QUERY, enabled: !!address, refetchInterval: 10_000 },
  });

  const myFarmIds = useMemo(() => {
    const raw = myFarmsQ.data as bigint[] | undefined;
    if (!raw) return [];
    return raw.map((id) => Number(id));
  }, [myFarmsQ.data]);

  if (myFarmsQ.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "rgba(139,92,246,0.2)", borderTopColor: "#8B5CF6" }}
        />
      </div>
    );
  }

  if (myFarmIds.length === 0) {
    return (
      <p className="font-mono text-[11px] text-center py-4" style={{ color: "rgba(255,255,255,0.45)" }}>
        You have not created any farms yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Settings2 className="w-4 h-4" style={{ color: "#A78BFA" }} />
        <p className="font-grotesk text-[13px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>
          My farms
        </p>
        <p className="font-mono text-[9px] w-full sm:w-auto sm:ml-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
          Pause and rewards only for pools you created — not other creators&apos; farms
        </p>
      </div>
      {myFarmIds.map((id) => (
        <ManageFarmCard key={id} farmId={id} />
      ))}
    </div>
  );
}

function ManageFarmCard({ farmId }: { farmId: number }) {
  const { address } = useAccount();
  const contracts = useContracts();
  const [showRewards, setShowRewards] = useState(false);

  const creatorQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "getFarmCreator",
    args: [BigInt(farmId)],
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 },
  });
  const creator = creatorQ.data as string | undefined;
  const isCreator =
    !!address &&
    !!creator &&
    creator.toLowerCase() === address.toLowerCase();

  const farmQ = useReadContract({
    address: contracts.streamFarm,
    abi: STREAM_FARM_ABI,
    functionName: "getFarm",
    args: [BigInt(farmId)],
    query: { ...LIVE_CHAIN_QUERY, refetchInterval: 10_000 },
  });
  const data = farmQ.data;
  const farm = parseFarmTuple(data);
  const stakeToken = farm?.stakeToken;
  const stakeAddr = (stakeToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const canShow = !!farm && isCreator;
  const metaAddrs = useMemo(
    () => (canShow && stakeToken ? [stakeAddr] : []),
    [canShow, stakeToken, stakeAddr],
  );

  const symbolQ = useReadContract({
    address: stakeAddr,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: canShow && !!stakeToken },
  });
  const decimalsQ = useReadContract({
    address: stakeAddr,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: canShow && !!stakeToken },
  });
  const getRemoteMeta = useRemoteTokenMeta(metaAddrs);
  const remote = canShow && stakeToken ? getRemoteMeta(stakeAddr) : undefined;

  if (!canShow || !farm) return null;

  const { totalStaked, active, rewardStreamCount } = farm;
  const rewardCount = Number(rewardStreamCount);
  const symbol = remote?.symbol ?? ((symbolQ.data as string) || "Token");
  const decimals = remote?.decimals ?? ((decimalsQ.data as number) ?? 18);
  const stakedLabel = Number(formatUnits(totalStaked ?? 0n, decimals)).toLocaleString();

  return (
    <div className="rounded-xl p-4" style={{ border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.04)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <TokenIcon address={stakeAddr} symbol={symbol} size={32} logoUrl={remote?.logoURI} />
          <div className="min-w-0">
            <p className="font-grotesk text-[14px] font-medium truncate" style={{ color: "#FFFFFF" }}>
              {symbol} Farm
            </p>
            <p className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Pool #{farmId} · {stakedLabel} {symbol} staked
            </p>
          </div>
        </div>
        <FarmActiveToggle farmId={farmId} active={active} />
      </div>
      <p className="font-mono text-[10px] mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
        {rewardCount} reward stream{rewardCount !== 1 ? "s" : ""}
        {!active && <span style={{ color: "rgba(255,100,100,0.85)" }}> · Paused</span>}
      </p>
      <button
        type="button"
        onClick={() => setShowRewards(!showRewards)}
        className="font-mono text-[10px] uppercase tracking-wider"
        style={{ color: "#A78BFA" }}
      >
        {showRewards ? "Hide" : "Add reward stream"}
      </button>
      {showRewards && (
        <AddRewardStreamForm
          farmId={farmId}
          onStreamAdded={() => {
            void farmQ.refetch();
            setShowRewards(false);
          }}
        />
      )}
    </div>
  );
}

function FarmActiveToggle({ farmId, active }: { farmId: number; active: boolean }) {
  const contracts = useContracts();
  const publicClient = usePublicClient();
  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  const toggle = async () => {
    if (!publicClient) return;
    const gas = await prepareTransactionWithGas(publicClient);
    tx.writeContract({
      address: contracts.streamFarm,
      abi: STREAM_FARM_ABI,
      functionName: "setFarmActive",
      args: [BigInt(farmId), !active],
      ...gas,
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={tx.isPending || rcpt.isLoading}
      className="px-3 py-1 rounded-lg font-mono text-[9px] uppercase disabled:opacity-40"
      style={{
        background: active ? "rgba(110,231,168,0.12)" : "rgba(248,113,113,0.1)",
        color: active ? "#6EE7B7" : "#F87171",
        border: `1px solid ${active ? "rgba(110,231,168,0.35)" : "rgba(248,113,113,0.35)"}`,
      }}
    >
      {tx.isPending ? "…" : active ? "Live · Pause" : "Paused · Activate"}
    </button>
  );
}

function AddRewardStreamForm({
  farmId,
  onStreamAdded,
}: {
  farmId: number;
  onStreamAdded?: () => void;
}) {
  const { address } = useAccount();
  const { toast } = useToast();
  const contracts = useContracts();
  const publicClient = usePublicClient();
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("30");
  const [delayHours, setDelayHours] = useState("0");

  const approveTx = useWriteContract();
  const approveRcpt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const addTx = useWriteContract();
  const addRcpt = useWaitForTransactionReceipt({ hash: addTx.data });
  const autoAddAfterApproveRef = useRef(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successRows, setSuccessRows] = useState<{ label: string; value: string }[]>([]);

  const budgetMeta = useRewardBudget(token, budget);
  const { parsedBudget, validBudget } = budgetMeta;

  const allowanceQ = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token?.address ? [address, contracts.streamFarm] : undefined,
    query: { enabled: !!address && !!token?.address, refetchInterval: 5_000 },
  });

  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = validBudget && allowance < parsedBudget;

  const runAdd = async () => {
    if (!token || !publicClient || !validBudget) return;
    try {
      const { start, end } = await computeRewardStreamWindow(
        publicClient,
        parseInt(delayHours, 10) || 0,
        parseInt(days, 10) || 30,
      );
      const gas = await prepareTransactionWithGas(publicClient);
      addTx.writeContract({
        address: contracts.streamFarm,
        abi: STREAM_FARM_ABI,
        functionName: "addRewardStream",
        args: [BigInt(farmId), token.address, parsedBudget, start, end],
        ...gas,
      });
    } catch (e) {
      toast("error", "Add stream failed", (e as Error).message?.slice(0, 120) ?? "Failed");
    }
  };

  const runApprove = async () => {
    if (!token || !publicClient || !validBudget) return;
    autoAddAfterApproveRef.current = true;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      approveTx.writeContract({
        address: token.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.streamFarm, parsedBudget],
        ...gas,
      });
    } catch (e) {
      autoAddAfterApproveRef.current = false;
      toast("error", "Approve failed", (e as Error).message?.slice(0, 120) ?? "Failed");
    }
  };

  useEffect(() => {
    if (!approveRcpt.isSuccess || !autoAddAfterApproveRef.current) return;
    autoAddAfterApproveRef.current = false;
    runAdd().catch(() => toast("error", "Add stream failed", "Approved but failed to fund stream."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRcpt.isSuccess]);

  useTransactionSuccess(addTx, addRcpt, () => {
    setSuccessRows([
      { label: "Farm", value: `#${farmId}` },
      { label: "Token", value: token?.symbol ?? "—" },
      { label: "Budget", value: budget ? `${budget} ${token?.symbol ?? ""}`.trim() : "—" },
      { label: "Duration", value: `${days} days` },
    ]);
    setSuccessOpen(true);
    setBudget("");
    setDays("30");
    setDelayHours("0");
    setToken(null);
    addTx.reset();
    approveTx.reset();
    onStreamAdded?.();
  });

  const txError =
    (addTx.error as { shortMessage?: string; message?: string } | undefined)?.shortMessage ??
    addTx.error?.message ??
    (approveTx.error as { shortMessage?: string; message?: string } | undefined)?.shortMessage ??
    approveTx.error?.message;

  const busy = approveTx.isPending || approveRcpt.isLoading || addTx.isPending || addRcpt.isLoading;

  return (
    <>
      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Stream Farms"
        heading="Rewards Added"
        subtext="Your reward stream is funded and emissions will begin on schedule."
        rows={successRows}
      />
    <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid rgba(139,92,246,0.12)" }}>
      <RewardStreamFields
        token={token}
        onTokenSelect={setToken}
        budget={budget}
        onBudgetChange={setBudget}
        days={days}
        onDaysChange={setDays}
        delayHours={delayHours}
        onDelayHoursChange={setDelayHours}
        budgetMeta={budgetMeta}
        compact
      />
      {needsApproval ? (
        <button
          type="button"
          onClick={runApprove}
          disabled={!token || !validBudget || busy}
          className="w-full rounded-xl py-2.5 font-grotesk text-[10px] uppercase disabled:opacity-40"
          style={{ background: "rgba(139,92,246,0.2)", color: "#fff", border: "1px solid rgba(139,92,246,0.45)" }}
        >
          {approveTx.isPending || approveRcpt.isLoading ? "Approving…" : "Approve & fund stream"}
        </button>
      ) : (
        <button
          type="button"
          onClick={runAdd}
          disabled={!token || !validBudget || busy}
          className="w-full rounded-xl py-2.5 font-grotesk text-[10px] uppercase disabled:opacity-40"
          style={{ background: "rgba(139,92,246,0.25)", color: "#fff", border: "1px solid rgba(139,92,246,0.55)" }}
        >
          {addTx.isPending || addRcpt.isLoading ? "Adding…" : "Add reward stream"}
        </button>
      )}
      {txError && (
        <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
          {txError}
        </p>
      )}
    </div>
    </>
  );
}
