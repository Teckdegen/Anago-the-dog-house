import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

type Row = { label: string; value: string };

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  heading: string;
  subtext: string;
  rows?: Row[];
};

export function SuccessModal({ open, onClose, title, heading, subtext, rows }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "#0D0B14",
          border: "1px solid rgba(155,127,212,0.3)",
          borderBottom: "none",
          boxShadow: "0 -8px 60px rgba(155,127,212,0.12)",
        }}
      >
        {/* drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full" style={{ background: "rgba(155,127,212,0.25)" }} />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(155,127,212,0.12)" }}>
          <h2 className="font-grotesk uppercase tracking-wider text-[14px]" style={{ color: "#EDE0FF" }}>
            {title}
          </h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[rgba(155,127,212,0.15)]"
            style={{ background: "rgba(155,127,212,0.08)", color: "rgba(196,168,240,0.6)", border: "1px solid rgba(155,127,212,0.2)" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-6 flex flex-col items-center gap-5 text-center">
          {/* checkmark */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(155,127,212,0.18)", border: "1.5px solid rgba(155,127,212,0.5)" }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: "#C4A8F0" }} strokeWidth={1.5} />
          </div>

          {/* text */}
          <div>
            <p className="font-grotesk uppercase tracking-wider text-[18px]" style={{ color: "#EDE0FF" }}>
              {heading}
            </p>
            <p className="font-mono text-[12px] mt-1.5 leading-relaxed" style={{ color: "rgba(196,168,240,0.6)" }}>
              {subtext}
            </p>
          </div>

          {/* detail rows */}
          {rows && rows.length > 0 && (
            <div
              className="w-full rounded-xl px-4 py-3 space-y-2.5"
              style={{ background: "rgba(155,127,212,0.07)", border: "1px solid rgba(155,127,212,0.2)" }}
            >
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(196,168,240,0.5)" }}>
                    {r.label}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "#EDE0FF" }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* done button */}
          <button
            onClick={onClose}
            className="w-full rounded-xl py-3.5 font-grotesk text-[13px] uppercase tracking-wider transition active:scale-[0.99]"
            style={{ background: "rgba(155,127,212,0.2)", color: "#EDE0FF", border: "1px solid rgba(155,127,212,0.5)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
