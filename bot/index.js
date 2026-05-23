/**
 * GZ Capricorn CL — Telegram pool monitor
 * Deploy bot/ folder alone to Railway.
 *
 * Commands: /start /pools /top /help
 * Polls Supabase for metric changes and alerts TELEGRAM_CHAT_ID.
 */

import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";
import { POOL_ADDRESSES, POOL_COUNT } from "./pools.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pollMs = Math.max(60_000, Number(process.env.POLL_INTERVAL_MS ?? 900_000));

if (!token || !chatId) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** address → last snapshot for change detection */
const lastSnapshot = new Map();

function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  if (x >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  if (x >= 1_000) return `$${(x / 1_000).toFixed(2)}K`;
  return `$${x.toFixed(2)}`;
}

function fmtApr(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(2)}%`;
}

function poolLine(row) {
  const sym = row.symbol0 && row.symbol1 ? `${row.symbol0}/${row.symbol1}` : row.address.slice(0, 10);
  const fee = row.fee ? `${(row.fee / 10_000).toFixed(2)}%` : "?";
  return `${sym} (${fee}) · TVL ${fmtUsd(row.tvl_usd)} · APR ${fmtApr(row.apr_percent)}`;
}

async function fetchPoolsFromDb() {
  const { data, error } = await supabase
    .from("clmm_pools")
    .select("address, symbol0, symbol1, fee, tvl_usd, apr_percent, volume_24h_usd, metrics_at")
    .in("address", POOL_ADDRESSES);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function sendToChat(text, opts = {}) {
  await bot.sendMessage(chatId, text, { parse_mode: "HTML", disable_web_page_preview: true, ...opts });
}

bot.onText(/\/start|\/help/, async (msg) => {
  const id = msg.chat.id.toString();
  if (id !== chatId) return;
  await bot.sendMessage(
    id,
    [
      "<b>Capricorn CL Monitor</b>",
      "",
      `/pools — ${POOL_COUNT} curated pools`,
      "/top — top 10 by TVL (Supabase)",
      "/sync — show last metrics refresh",
      "",
      `Alerts every ${Math.round(pollMs / 60_000)} min when TVL/APR moves ≥5%.`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

bot.onText(/\/pools/, async (msg) => {
  if (msg.chat.id.toString() !== chatId) return;
  await sendToChat(`Monitoring <b>${POOL_COUNT}</b> hardcoded Capricorn pools.\nIndexer fills Supabase; UI reads on-chain.`);
});

bot.onText(/\/top/, async (msg) => {
  if (msg.chat.id.toString() !== chatId) return;
  try {
    const rows = await fetchPoolsFromDb();
    const top = [...rows]
      .filter((r) => r.tvl_usd != null)
      .sort((a, b) => Number(b.tvl_usd) - Number(a.tvl_usd))
      .slice(0, 10);
    if (!top.length) {
      await sendToChat("No TVL data yet — run the pool indexer (<code>npm run pool-indexer</code>).");
      return;
    }
    const lines = top.map((r, i) => `${i + 1}. ${poolLine(r)}`);
    await sendToChat(`<b>Top pools by TVL</b>\n\n${lines.join("\n")}`);
  } catch (e) {
    await sendToChat(`Error: ${e instanceof Error ? e.message : e}`);
  }
});

bot.onText(/\/sync/, async (msg) => {
  if (msg.chat.id.toString() !== chatId) return;
  try {
    const { data, error } = await supabase
      .from("clmm_pools")
      .select("metrics_at")
      .order("metrics_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    await sendToChat(`Last Supabase metrics: <code>${data?.metrics_at ?? "never"}</code>`);
  } catch (e) {
    await sendToChat(`Error: ${e instanceof Error ? e.message : e}`);
  }
});

function pctChange(oldVal, newVal) {
  const o = Number(oldVal);
  const n = Number(newVal);
  if (!o || !n) return null;
  return ((n - o) / o) * 100;
}

async function pollMetrics() {
  try {
    const rows = await fetchPoolsFromDb();
    const alerts = [];

    for (const row of rows) {
      const key = row.address.toLowerCase();
      const prev = lastSnapshot.get(key);
      lastSnapshot.set(key, row);

      if (!prev) continue;

      const tvlChg = pctChange(prev.tvl_usd, row.tvl_usd);
      const aprChg = pctChange(prev.apr_percent, row.apr_percent);

      if ((tvlChg != null && Math.abs(tvlChg) >= 5) || (aprChg != null && Math.abs(aprChg) >= 5)) {
        const parts = [poolLine(row)];
        if (tvlChg != null && Math.abs(tvlChg) >= 5) {
          parts.push(`TVL ${tvlChg >= 0 ? "+" : ""}${tvlChg.toFixed(1)}%`);
        }
        if (aprChg != null && Math.abs(aprChg) >= 5) {
          parts.push(`APR ${aprChg >= 0 ? "+" : ""}${aprChg.toFixed(1)}%`);
        }
        alerts.push(parts.join(" · "));
      }
    }

    if (alerts.length > 0) {
      const chunk = alerts.slice(0, 15).join("\n\n");
      await sendToChat(`<b>Pool update</b>\n\n${chunk}`);
    }
  } catch (e) {
    console.error("[poll]", e instanceof Error ? e.message : e);
  }
}

console.log(`Capricorn Telegram bot — ${POOL_COUNT} pools, poll every ${pollMs}ms`);
await sendToChat(`✅ Bot online — watching <b>${POOL_COUNT}</b> Capricorn CL pools.`);

setInterval(pollMetrics, pollMs);
await pollMetrics();
