"use client";

import type { ReactNode } from "react";
import { admin } from "@/lib/theme";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{ background: admin.panel, border: `1px solid ${admin.border}` }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <p className="font-grotesk text-[17px] font-medium" style={{ color: admin.text }}>
        {children}
      </p>
      {sub && (
        <p className="font-mono text-[10px] mt-1 leading-relaxed" style={{ color: admin.textDim }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-wider mb-2 block" style={{ color: admin.textDim }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 font-mono text-[13px] outline-none transition focus:ring-1"
        style={{
          background: admin.purpleBg,
          border: `1px solid ${admin.border}`,
          color: admin.text,
        }}
      />
    </div>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  full,
  small,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  variant?: "primary" | "danger" | "ghost";
}) {
  const styles =
    variant === "danger"
      ? { background: "rgba(255,80,80,0.1)", color: admin.red, border: "1px solid rgba(255,100,100,0.25)" }
      : variant === "ghost"
        ? { background: "transparent", color: admin.textMuted, border: `1px solid ${admin.border}` }
        : { background: admin.purpleBgHover, color: admin.text, border: `1px solid ${admin.borderStrong}` };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "w-full" : ""} rounded-xl ${small ? "px-3 py-1.5 text-[10px]" : "px-5 py-3 text-[11px]"} font-grotesk uppercase tracking-wider transition disabled:opacity-40 hover:opacity-90`}
      style={styles}
    >
      {children}
    </button>
  );
}

export function Msg({ text }: { text: string }) {
  return (
    <p className="font-mono text-[11px] py-2 rounded-lg px-3" style={{ color: admin.green, background: "rgba(110,231,168,0.08)" }}>
      ✓ {text}
    </p>
  );
}

export function Err({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as { shortMessage?: string; message?: string };
  return (
    <p className="font-mono text-[11px] py-2 rounded-lg px-3" style={{ color: admin.red, background: "rgba(248,113,113,0.08)" }}>
      {e.shortMessage || e.message}
    </p>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: admin.panel, border: `1px solid ${admin.border}` }}>
      <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: admin.textDim }}>
        {label}
      </p>
      <p
        className="font-grotesk text-[28px] sm:text-[32px] font-semibold mt-2 tabular-nums"
        style={{ color: accent ? admin.accent : admin.text }}
      >
        {value}
      </p>
      {sub && (
        <p className="font-mono text-[10px] mt-1" style={{ color: admin.textMuted }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function PillTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 p-1 rounded-full w-fit max-w-full"
      style={{ background: admin.purpleBg, border: `1px solid ${admin.border}` }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="px-4 py-2 rounded-full font-grotesk text-[10px] uppercase tracking-wider transition whitespace-nowrap"
          style={
            active === t.key
              ? { background: admin.purpleBgHover, color: admin.text, border: `1px solid ${admin.borderStrong}` }
              : { color: admin.textMuted }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
