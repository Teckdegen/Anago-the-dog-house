import { formatUnits } from "viem";

export function formatAmount(value: bigint, decimals: number, maxFrac = 4) {
  const s = formatUnits(value, decimals);
  const [int, frac = ""] = s.split(".");
  const trimmed = frac.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${int}.${trimmed}` : int;
}

export function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeUntil(unixSeconds: number | bigint): string {
  const target =
    typeof unixSeconds === "bigint" ? Number(unixSeconds) : unixSeconds;
  const now = Math.floor(Date.now() / 1000);
  const delta = target - now;
  if (delta <= 0) return "Unlocked";

  const d = Math.floor(delta / 86400);
  const h = Math.floor((delta % 86400) / 3600);
  const m = Math.floor((delta % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDate(unixSeconds: number | bigint): string {
  const t = typeof unixSeconds === "bigint" ? Number(unixSeconds) : unixSeconds;
  return new Date(t * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
