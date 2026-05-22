import { useChainId, useSwitchChain } from "wagmi";
import { Loader2 } from "lucide-react";
import { MONAD_CHAIN_ID, isUniswapSupportedChain } from "@/lib/uniswap";
import { clmm } from "./clmmTheme";

export function SwitchToMonadMainnetButton({ className = "" }: { className?: string }) {
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();

  if (isUniswapSupportedChain(chainId)) return null;

  return (
    <div className={className}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchChain({ chainId: MONAD_CHAIN_ID })}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition disabled:opacity-50"
        style={{
          background: clmm.purpleSolid,
          color: clmm.text,
          border: `1px solid ${clmm.borderStrong}`,
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Switching…
          </>
        ) : (
          "Switch to Monad Mainnet"
        )}
      </button>
      {error && (
        <p className="font-mono text-[10px] mt-3 max-w-sm mx-auto" style={{ color: clmm.red }}>
          {(error as Error).message}
        </p>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

export function ClmmNetworkGate({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  if (isUniswapSupportedChain(chainId)) return <>{children}</>;

  return (
    <div className="max-w-[520px] mx-auto px-5 pt-16 pb-20 text-center">
      <p className="font-grotesk text-[20px] uppercase" style={{ color: clmm.text }}>
        Monad Mainnet required
      </p>
      <p className="font-mono text-[11px] mt-3 leading-relaxed" style={{ color: clmm.textMuted }}>
        Uniswap V3 CLMM runs on Monad mainnet (chain <strong>143</strong>). You are on chain{" "}
        <strong>{chainId}</strong>.
      </p>
      <SwitchToMonadMainnetButton className="mt-8" />
    </div>
  );
}
