import { useMemo, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { STREAM_FARM_ABI, CONTRACTS, ERC20_ABI } from "@/lib/web3/contracts";
import { LIVE_CHAIN_QUERY } from "@/lib/web3/nftImage";
import { prepareTransactionWithGas } from "@/lib/web3/gasUtils";
import { useToast } from "@/components/Toast";
import { TokenPicker } from "@/components/TokenPicker";
import { TokenIcon } from "@/components/TokenIcon";
import { useRemoteTokenMeta } from "@/lib/web3/useRemoteTokenMeta";
import type { TokenInfo } from "@/lib/web3/tokens";

function useContracts() {
  const chainId = useChainId();
  return CONTRACTS[chainId] ?? CONTRACTS[143];
}

/** Create / manage farms — only rendered when `isFarmOperator` is true on the farm page. */
export function FarmManagePanel() {
  const { address } = useAccount();

  if (!address) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ border: "1px solid rgba(139,92,246,0.35)" }}>
        <p className="font-grotesk text-[13px]" style={{ color: "#FFFFFF" }}>Connect wallet to create farms</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateFarmForm />
      <MyFarmsList />
    </div>
  );
}

function CreateFarmForm() {
  const { toast } = useToast();
  const contracts = useContracts();
  const publicClient = usePublicClient();
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [lockDays, setLockDays] = useState("0");
  const [penalty, setPenalty] = useState("0");
  const [open, setOpen] = useState(false);

  const tx = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash: tx.data });

  const handleCreate = async () => {
    if (!token || !publicClient) return;
    try {
      const gas = await prepareTransactionWithGas(publicClient);
      tx.writeContract({
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

  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.05)" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4" style={{ color: "#A78BFA" }} />
          <span className="font-grotesk text-[14px] uppercase tracking-wider" style={{ color: "#FFFFFF" }}>
            Create new farm
          </span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-5 pt-5 space-y-4" style={{ borderTop: "1px solid rgba(139,92,246,0.15)" }}>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              Stake token
            </p>
            <TokenPicker selected={token} onSelect={setToken} excludeNative />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
                Lock duration (days, 0 = none)
              </span>
              <input
                value={lockDays}
                onChange={(e) => setLockDays(e.target.value)}
                className="mt-1.5 w-full rounded-xl px-3 py-2.5 font-mono text-[12px] outline-none"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.3)", color: "#fff" }}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
                Early exit penalty (%)
              </span>
              <input
                value={penalty}
                onChange={(e) => setPenalty(e.target.value)}
                className="mt-1.5 w-full rounded-xl px-3 py-2.5 font-mono text-[12px] outline-none"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.3)", color: "#fff" }}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!token || tx.isPending || rcpt.isLoading}
            className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider disabled:opacity-40"
            style={{ background: "rgba(139,92,246,0.25)", color: "#fff", border: "1px solid rgba(139,92,246,0.55)" }}
          >
            {tx.isPending || rcpt.isLoading ? "Creating…" : "Create farm"}
          </button>
          {rcpt.isSuccess && (
            <p className="font-mono text-[10px]" style={{ color: "#A78BFA" }}>
              Farm created. Add a reward stream below in My farms.
            </p>
          )}
          {tx.error && (
            <p className="font-mono text-[10px] break-words" style={{ color: "rgba(255,100,100,0.9)" }}>
              {(tx.error as Error).message?.slice(0, 160)}
            </p>
          )}
        </div>
      )}
    </div>
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
  const data = farmQ.data as
    | [string, bigint, bigint, boolean, bigint, bigint, bigint]
    | undefined;
  if (!data || !isCreator) return null;

  const [stakeToken, , totalStaked, active, , , rewardStreamCount] = data;
  const rewardCount = Number(rewardStreamCount ?? 0);
  const stakeAddr = stakeToken as `0x${string}`;

  const symbolQ = useReadContract({
    address: stakeAddr,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: !!stakeToken },
  });
  const decimalsQ = useReadContract({
    address: stakeAddr,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!stakeToken },
  });
  const getRemoteMeta = useRemoteTokenMeta(stakeToken ? [stakeAddr] : []);
  const remote = getRemoteMeta(stakeAddr);
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
      {showRewards && <AddRewardStreamForm farmId={farmId} />}
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

function AddRewardStreamForm({ farmId }: { farmId: number }) {
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

  const rewardAddr = token?.address;
  const decimalsQ = useReadContract({
    address: rewardAddr,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!rewardAddr },
  });
  const allowanceQ = useReadContract({
    address: rewardAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && rewardAddr ? [address, contracts.streamFarm] : undefined,
    query: { enabled: !!address && !!rewardAddr, refetchInterval: 5_000 },
  });

  const decimals = token?.decimals ?? (decimalsQ.data as number) ?? 18;
  const parsedBudget = (() => {
    try {
      return budget ? parseUnits(budget, decimals) : 0n;
    } catch {
      return 0n;
    }
  })();
  const allowance = (allowanceQ.data as bigint) ?? 0n;
  const needsApproval = parsedBudget > 0n && allowance < parsedBudget;

  const runAdd = async () => {
    if (!token || !publicClient || parsedBudget === 0n) return;
    const now = Math.floor(Date.now() / 1000);
    const start = BigInt(now + (parseInt(delayHours, 10) || 0) * 3600);
    const end = start + BigInt((parseInt(days, 10) || 30) * 86400);
    try {
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
    if (!token || !publicClient) return;
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
      toast("error", "Approve failed", (e as Error).message?.slice(0, 120) ?? "Failed");
    }
  };

  return (
    <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid rgba(139,92,246,0.12)" }}>
      <TokenPicker selected={token} onSelect={setToken} excludeNative compact />
      <div className="grid sm:grid-cols-3 gap-2">
        <input
          placeholder="Total budget"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="rounded-xl px-3 py-2 font-mono text-[11px] outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.3)", color: "#fff" }}
        />
        <input
          placeholder="Days"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="rounded-xl px-3 py-2 font-mono text-[11px] outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.3)", color: "#fff" }}
        />
        <input
          placeholder="Start delay (h)"
          value={delayHours}
          onChange={(e) => setDelayHours(e.target.value)}
          className="rounded-xl px-3 py-2 font-mono text-[11px] outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.3)", color: "#fff" }}
        />
      </div>
      {needsApproval ? (
        <button
          type="button"
          onClick={runApprove}
          disabled={!token || approveTx.isPending || approveRcpt.isLoading}
          className="w-full rounded-xl py-2.5 font-grotesk text-[10px] uppercase disabled:opacity-40"
          style={{ background: "rgba(139,92,246,0.2)", color: "#fff", border: "1px solid rgba(139,92,246,0.45)" }}
        >
          {approveTx.isPending || approveRcpt.isLoading ? "Approving…" : "Approve & fund stream"}
        </button>
      ) : (
        <button
          type="button"
          onClick={runAdd}
          disabled={!token || !parsedBudget || addTx.isPending || addRcpt.isLoading}
          className="w-full rounded-xl py-2.5 font-grotesk text-[10px] uppercase disabled:opacity-40"
          style={{ background: "rgba(139,92,246,0.25)", color: "#fff", border: "1px solid rgba(139,92,246,0.55)" }}
        >
          {addTx.isPending || addRcpt.isLoading ? "Adding…" : "Add reward stream"}
        </button>
      )}
      {addRcpt.isSuccess && (
        <p className="font-mono text-[10px]" style={{ color: "#A78BFA" }}>
          Reward stream added.
        </p>
      )}
    </div>
  );
}
