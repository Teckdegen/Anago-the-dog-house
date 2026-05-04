import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ToastCtx {
  toast: (kind: ToastKind, title: string, body?: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────

const Ctx = createContext<ToastCtx>({ toast: () => {} });

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++_nextId;
    setItems((prev) => [...prev, { id, kind, title, body }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {/* Portal-style fixed stack — top-right on desktop, top-center on mobile */}
      <div
        aria-live="polite"
        className="fixed top-5 right-4 sm:right-6 z-[200] flex flex-col gap-2.5 items-end pointer-events-none"
        style={{ maxWidth: "min(360px, calc(100vw - 32px))" }}
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

// ── Individual card ───────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4500;

const KIND_STYLES: Record<ToastKind, {
  icon: typeof CheckCircle2;
  iconColor: string;
  border: string;
  glow: string;
  bg: string;
}> = {
  success: {
    icon: CheckCircle2,
    iconColor: "rgba(100,255,160,0.9)",
    border: "rgba(100,255,160,0.3)",
    glow: "rgba(100,255,160,0.06)",
    bg: "rgba(10,20,15,0.97)",
  },
  error: {
    icon: XCircle,
    iconColor: "rgba(255,100,100,0.9)",
    border: "rgba(255,100,100,0.3)",
    glow: "rgba(255,100,100,0.06)",
    bg: "rgba(20,10,10,0.97)",
  },
  info: {
    icon: Info,
    iconColor: "rgba(155,127,212,0.9)",
    border: "rgba(155,127,212,0.35)",
    glow: "rgba(155,127,212,0.06)",
    bg: "rgba(13,11,20,0.97)",
  },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const s = KIND_STYLES[item.kind];
  const Icon = s.icon;

  // Animate in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => handleDismiss(), AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    // Wait for exit animation before removing from DOM
    setTimeout(() => onDismiss(item.id), 300);
  };

  return (
    <div
      role="alert"
      className="pointer-events-auto w-full rounded-2xl px-4 py-3.5 flex items-start gap-3 transition-all duration-300"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${s.glow} inset`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.97)",
      }}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <Icon className="w-4 h-4" style={{ color: s.iconColor }} strokeWidth={1.8} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-grotesk uppercase text-[12px] tracking-wider leading-tight" style={{ color: "#EDE0FF" }}>
          {item.title}
        </p>
        {item.body && (
          <p className="font-mono text-[10px] mt-1 leading-relaxed" style={{ color: "rgba(196,168,240,0.65)" }}>
            {item.body}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] rounded-b-2xl"
        style={{
          background: s.iconColor,
          width: "100%",
          animation: `toast-shrink ${AUTO_DISMISS_MS}ms linear forwards`,
        }}
      />

      {/* Close */}
      <button
        onClick={handleDismiss}
        className="shrink-0 mt-0.5 transition hover:opacity-70"
        style={{ color: "rgba(196,168,240,0.45)" }}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
