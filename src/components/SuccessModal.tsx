import { CheckCircle2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Row = { label: string; value: ReactNode };

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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "#0c0c10",
          border: "1px solid rgba(139,92,246,0.3)",
          borderBottom: "none",
          boxShadow: "0 -8px 60px rgba(139,92,246,0.12)",
        }}
      >
        {/* drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full" style={{ background: "rgba(139,92,246,0.25)" }} />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.12)" }}>
          <h2 className="font-grotesk uppercase tracking-wider text-[14px]" style={{ color: "#FFFFFF" }}>
            {title}
          </h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition hover:bg-[rgba(139,92,246,0.15)]"
            style={{ background: "rgba(139,92,246,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-6 flex flex-col items-center gap-5 text-center">
          {/* checkmark */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.18)", border: "1.5px solid rgba(139,92,246,0.5)" }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: "#A78BFA" }} strokeWidth={1.5} />
          </div>

          {/* text */}
          <div>
            <p className="font-grotesk uppercase tracking-wider text-[18px]" style={{ color: "#FFFFFF" }}>
              {heading}
            </p>
            <p className="font-mono text-[12px] mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
              {subtext}
            </p>
          </div>

          {/* detail rows */}
          {rows && rows.length > 0 && (
            <div
              className="w-full rounded-xl px-4 py-3 space-y-2.5"
              style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {r.label}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "#FFFFFF" }}>
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
            style={{ background: "rgba(139,92,246,0.2)", color: "#FFFFFF", border: "1px solid rgba(139,92,246,0.5)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
