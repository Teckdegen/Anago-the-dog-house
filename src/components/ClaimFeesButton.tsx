import { useState } from "react";
import { Coins } from "lucide-react";
import { useAccount } from "wagmi";
import { useIsProtocolOwner } from "@/lib/web3/useProtocolOwner";
import { theme } from "@/lib/theme";
import { ClaimFeesModal } from "./ClaimFeesModal";

/** Header button — visible when the connected wallet is a protocol contract owner. */
export function ClaimFeesButton() {
  const { isConnected } = useAccount();
  const { isProtocolOwner, isLoading } = useIsProtocolOwner();
  const [open, setOpen] = useState(false);

  if (!isConnected || isLoading || !isProtocolOwner) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-1.5 rounded-full px-3.5 py-2 font-grotesk text-[10px] uppercase tracking-wider transition hover:opacity-90 shrink-0"
        style={{
          background: theme.purpleGlass,
          color: theme.purpleBright,
          border: `1px solid ${theme.border}`,
        }}
      >
        <Coins className="w-3.5 h-3.5" />
        Claim fees
      </button>

      <ClaimFeesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
