# GZ Capricorn CL Telegram Bot

Standalone package for [Railway](https://railway.app). Deploy **only this folder** as the service root.

## Setup

1. Copy `.env.example` → `.env` (or set variables in Railway).
2. Run `clmm.sql` in Supabase (repo root).
3. Run the main repo indexer (`npm run pool-indexer`) so `clmm_pools` has metrics.

## Railway

- **Root directory:** `bot`
- **Start command:** `npm start`
- **Variables:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Commands

- `/start` / `/help` — menu
- `/pools` — pool count
- `/top` — top 10 by TVL from Supabase
- `/sync` — last metrics timestamp

Polls every `POLL_INTERVAL_MS` (default 15 min) and posts when TVL or APR moves ≥5% on a tracked pool.
