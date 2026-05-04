import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[76px] sm:pb-4 overlay-anim"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-2xl max-h-[80vh] sm:max-h-[88vh] overflow-y-auto sheet-anim"
        style={{
          background: "#0D0B14",
          border: "1px solid rgba(155,127,212,0.35)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(155,127,212,0.06) inset",
        }}
      >
        {/* drag handle on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full" style={{ background: "rgba(155,127,212,0.3)" }} />
        </div>

        {/* header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(155,127,212,0.2)" }}
        >
          <h2 className="font-grotesk uppercase tracking-wider text-[14px]" style={{ color: "#EDE0FF" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition"
            style={{
              background: "rgba(155,127,212,0.1)",
              color: "rgba(196,168,240,0.6)",
              border: "1px solid rgba(155,127,212,0.25)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(155,127,212,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(155,127,212,0.1)")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
