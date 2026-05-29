import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { theme } from "@/lib/theme";

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
      style={{
        background: theme.overlay,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-2xl max-h-[80vh] sm:max-h-[88vh] overflow-y-auto sheet-anim dh-panel-solid"
        style={{
          background: theme.bgPanel,
          border: `1px solid ${theme.borderStrong}`,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.8)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full" style={{ background: theme.border }} />
        </div>

        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${theme.borderSubtle}` }}
        >
          <h2 className="font-grotesk uppercase tracking-wider text-[14px] text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition dh-btn"
            style={{ color: theme.textMuted }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-6 py-5 text-white">{children}</div>
      </div>
    </div>
  );
}
