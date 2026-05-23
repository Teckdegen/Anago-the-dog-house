-- Run supabase/migrations/001_clmm_pools.sql once in Supabase SQL Editor.
-- Indexer: node script.js (see .env.example)

create table if not exists public.clmm_pools (
  address text primary key,
  token0 text not null,
  token1 text not null,
  symbol0 text not null default '',
  symbol1 text not null default '',
  fee integer not null,
  tick_spacing integer not null default 0,
  protocol text not null default 'v4',
  liquidity numeric default 0,
  tvl_usd double precision,
  volume_24h_usd double precision,
  fees_24h_usd double precision,
  apr_percent double precision,
  price_usd double precision,
  synced_at timestamptz not null default now(),
  metrics_at timestamptz
);

create index if not exists clmm_pools_tvl_idx on public.clmm_pools (tvl_usd desc nulls last);
create index if not exists clmm_pools_liquidity_idx on public.clmm_pools (liquidity desc nulls last);
create index if not exists clmm_pools_symbol0_idx on public.clmm_pools (symbol0);
create index if not exists clmm_pools_symbol1_idx on public.clmm_pools (symbol1);

-- Public read for anon (optional — app uses server API with service role)
alter table public.clmm_pools enable row level security;

create policy "clmm_pools_public_read"
  on public.clmm_pools for select
  using (true);
