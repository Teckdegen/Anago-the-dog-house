import { Plus } from "lucide-react";

type Props = {
  label: string;
  onClick: () => void;
};

export function DesktopCTA({ label, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="hidden lg:inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-grotesk text-[12px] uppercase tracking-wider transition active:scale-[0.98] hover:opacity-90"
      style={{
        background: "rgba(155,127,212,0.2)",
        color: "#EDE0FF",
        border: "1px solid rgba(155,127,212,0.5)",
      }}
    >
      <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
      {label}
    </button>
  );
}

export function MobileFAB({ label, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="lg:hidden fixed right-4 z-40 flex items-center gap-2 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition active:scale-[0.97]"
      style={{
        bottom: "calc(76px + env(safe-area-inset-bottom, 0px) + 16px)",
        padding: "12px 18px",
        background: "rgba(155,127,212,0.9)",
        color: "#0D0B14",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(155,127,212,0.3) inset",
      }}
    >
      <Plus className="w-4 h-4" strokeWidth={2.4} />
      {label}
    </button>
  );
}

export function NewActionCTA({ label, onClick }: Props) {
  return (
    <>
      <DesktopCTA label={label} onClick={onClick} />
      <MobileFAB label={label} onClick={onClick} />
    </>
  );
}
