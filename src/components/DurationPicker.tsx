import { useMemo, useState } from "react";

const SEC = 1;
const MIN = 60;
const HOUR = 60 * 60;
const DAY = 86400;

const PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "5m",  seconds: 5 * MIN },
  { label: "1h",  seconds: 1 * HOUR },
  { label: "1d",  seconds: 1 * DAY },
  { label: "7d",  seconds: 7 * DAY },
  { label: "30d", seconds: 30 * DAY },
  { label: "90d", seconds: 90 * DAY },
  { label: "1y",  seconds: 365 * DAY },
];

const UNITS = [
  { label: "sec",  factor: SEC },
  { label: "min",  factor: MIN },
  { label: "hr",   factor: HOUR },
  { label: "days", factor: DAY },
] as const;
type Unit = (typeof UNITS)[number];

type Props = {
  value: number; // seconds
  onChange: (seconds: number) => void;
};

export function DurationPicker({ value, onChange }: Props) {
  const [unit, setUnit] = useState<Unit>(UNITS[3]); // default days
  const [custom, setCustom] = useState<string>("");
  const isCustom = !PRESETS.some((p) => p.seconds === value);

  const customDisplay = useMemo(() => {
    if (custom !== "") return custom;
    if (!isCustom) return "";
    const v = value / unit.factor;
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }, [custom, isCustom, value, unit.factor]);

  const unlockDate = new Date(Date.now() + value * 1000);

  return (
    <div>
      {/* Preset pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((p) => {
          const active = value === p.seconds;
          return (
            <button
              key={p.label}
              onClick={() => { onChange(p.seconds); setCustom(""); }}
              className="px-3 py-1.5 rounded-full font-grotesk text-[11px] uppercase tracking-wider transition active:scale-[0.97]"
              style={{
                background: active ? "rgba(155,127,212,0.35)" : "rgba(155,127,212,0.07)",
                color: active ? "#EDE0FF" : "rgba(196,168,240,0.6)",
                border: `1px solid ${active ? "rgba(155,127,212,0.7)" : "rgba(155,127,212,0.2)"}`,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom input + unit selector */}
      <div
        className="flex items-stretch rounded-xl overflow-hidden"
        style={{
          background: "rgba(155,127,212,0.07)",
          border: "1px solid rgba(155,127,212,0.25)",
        }}
      >
        <input
          type="number"
          min={1}
          placeholder="Custom"
          value={customDisplay}
          onChange={(e) => {
            setCustom(e.target.value);
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n > 0) onChange(Math.round(n * unit.factor));
          }}
          className="bg-transparent font-mono text-[12px] outline-none w-full px-3 py-2.5 placeholder:text-[rgba(155,127,212,0.35)]"
          style={{ color: "#EDE0FF" }}
        />
        <div className="flex" style={{ borderLeft: "1px solid rgba(155,127,212,0.2)" }}>
          {UNITS.map((u) => {
            const active = u.label === unit.label;
            return (
              <button
                key={u.label}
                onClick={() => {
                  setUnit(u);
                  const n = Number(custom);
                  if (Number.isFinite(n) && n > 0) onChange(Math.round(n * u.factor));
                }}
                className="px-2.5 font-mono text-[10px] uppercase tracking-wider transition"
                style={{
                  background: active ? "rgba(155,127,212,0.3)" : "transparent",
                  color: active ? "#EDE0FF" : "rgba(196,168,240,0.45)",
                }}
              >
                {u.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Unlock date display */}
      <div
        className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg"
        style={{
          background: "rgba(155,127,212,0.06)",
          border: "1px solid rgba(155,127,212,0.18)",
        }}
      >
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ color: "rgba(196,168,240,0.5)" }}
        >
          Unlocks
        </span>
        <span className="font-mono text-[10px]" style={{ color: "rgba(237,224,255,0.85)" }}>
          {unlockDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          {" · "}
          {unlockDate.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: value < 5 * MIN ? "2-digit" : undefined,
          })}
        </span>
      </div>
    </div>
  );
}
