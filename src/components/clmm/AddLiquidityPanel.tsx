import { useState } from "react";
import { Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useToast } from "@/components/Toast";
import { UNISWAP_V4, type PoolLiveState } from "@/lib/uniswap";

export function AddLiquidityPanel({ live }: { live: PoolLiveState }) {
  const { address } = useAccount();
  const { toast } = useToast();
  const positionManager = UNISWAP_V4.positionManager;

  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");

  const parsed0 = safeParse(amount0, live.token0Decimals);
  const parsed1 = safeParse(amount1, live.token1Decimals);

  const handleAdd = () => {
    if (!address) return;
    toast("error", "V4 liquidity", "Use the Uniswap LP API with a server-side key on Monad 143.");
  };

  if (!address) {
    return (
      <p className="font-mono text-[11px]" style={{ color: "rgba(196,168,240,0.55)" }}>
        Connect wallet to add liquidity
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px]" style={{ color: "rgba(196,168,240,0.5)" }}>
        Uniswap V4 · Position Manager {positionManager.slice(0, 10)}… · add via LP API
      </p>
      <AmountField label={live.token0Symbol} value={amount0} onChange={setAmount0} />
      <AmountField label={live.token1Symbol} value={amount1} onChange={setAmount1} />
      <button
        type="button"
        onClick={handleAdd}
        disabled={parsed0 === 0n && parsed1 === 0n}
        className="w-full rounded-xl py-3 font-grotesk text-[11px] uppercase tracking-wider disabled:opacity-40"
        style={{ background: "rgba(155,127,212,0.22)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
      >
        Add Liquidity (LP API)
      </button>
      <p className="font-mono text-[8px] flex items-center gap-1" style={{ color: "rgba(196,168,240,0.35)" }}>
        <Plus className="w-3 h-3" /> V4 PM {positionManager.slice(0, 10)}…
      </p>
    </div>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.0"
        className="w-full mt-1 rounded-xl px-4 py-3 font-grotesk text-[16px] outline-none"
        style={{ color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.3)", background: "rgba(155,127,212,0.06)" }}
      />
    </div>
  );
}

function safeParse(v: string, decimals: number): bigint {
  try {
    return v ? parseUnits(v, decimals) : 0n;
  } catch {
    return 0n;
  }
}
