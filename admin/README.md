# Stream Farm Admin

Wallet-gated dashboard to **create and manage** yield farms on the `StreamFarm` contract. Deploy separately from the main Dog House app (e.g. `admin.yourdomain.com`).

## How admin access works (on-chain)

`StreamFarm` uses two roles:

| Role | Who | Can do |
|------|-----|--------|
| **Owner** | Address that deployed the contract (`owner()`) | Everything an admin can do, plus **`addAdmin`** / **`removeAdmin`** |
| **Admin** | Wallets in `admins[address]` mapping | Create farms, add rewards, pause farms, boost tiers, recover tokens |

On deploy, the deployer is **both** owner and admin (`admins[deployer] = true` in the constructor).

The UI calls `isAdmin(yourWallet)` — returns `true` if you are owner **or** listed in `admins`.

```solidity
modifier onlyAdmin() {
    require(admins[msg.sender] || msg.sender == owner(), "Not admin");
    _;
}
```

**Regular users** cannot call admin functions. They only `deposit`, `withdraw`, and `claim` on farms that are **active**.

## What admins manage

1. **Create farm** — `createFarm(stakeToken, lockDurationSeconds, earlyWithdrawBps)`
   - Sets which ERC-20 users stake
   - Optional lock (days → seconds) and early-exit penalty (max 50% = 5000 bps)

2. **Add reward stream** — `addRewardStream(farmId, rewardToken, totalBudget, startTime, endTime)`
   - Admin must **approve** the reward token, then the contract pulls `totalBudget` in
   - Rewards stream linearly between `startTime` and `endTime`

3. **Pause / activate** — `setFarmActive(farmId, active)` — stops new deposits when paused

4. **Boost tiers** — `setBoostTiers(durations[], multipliers[])` — global lock tiers (e.g. 7d → 1.2x shares)

5. **Recover tokens** — `recoverTokens(token, amount)` — pull stuck/penalty tokens (admin only)

6. **Add/remove admin** — `addAdmin` / `removeAdmin` — **owner only** (Admins tab in UI)

## First-time setup

### 1. Deploy StreamFarm (if not already)

From repo root:

```bash
cd contracts
npm install
cp .env.example .env   # set PRIVATE_KEY + RPC
npm run deploy:testnet   # or deploy:mainnet
```

This updates `src/lib/web3/deployments.generated.ts` with `streamFarm`.

### 2. Configure admin app

```bash
cd admin
cp .env.example .env.local
```

Set:

- `NEXT_PUBLIC_STREAM_FARM_ADDRESS` — same as `streamFarm` in `deployments.generated.ts` (or `VITE_STREAM_FARM_MAINNET` on mainnet)
- `NEXT_PUBLIC_CHAIN_ID` — `10143` (testnet) or `143` (mainnet)
- `NEXT_PUBLIC_REOWN_PROJECT_ID` — WalletConnect project id

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, connect the **deployer wallet** (or any wallet the owner added via `addAdmin`).

### 4. Add more admins (optional)

- Connect as **owner**
- Open **Admins** tab → paste wallet → **Add Admin**
- That wallet can manage farms but cannot add/remove other admins

## Deploy to Vercel

- Root directory: `admin`
- Framework: Next.js
- Environment variables (same as `.env.local`):
  - `NEXT_PUBLIC_STREAM_FARM_ADDRESS`
  - `NEXT_PUBLIC_CHAIN_ID`
  - `NEXT_PUBLIC_REOWN_PROJECT_ID`

## Main app link

Public users use **Yield Farm** at `/farm` on the main app. It reads `CONTRACTS[chainId].streamFarm` and only shows farms that exist on-chain. Until an admin creates a farm, users see: *"Farms are created by the admin from the Admin dashboard."*

## Current testnet deployment

| | |
|--|--|
| Chain | Monad testnet (`10143`) |
| StreamFarm | `0xf14eD1b63EF380BF1d32C49fbA43b2871f194Fef` |
| Explorer | https://testnet.monadexplorer.com/address/0xf14eD1b63EF380BF1d32C49fbA43b2871f194Fef |

After redeploy, update `NEXT_PUBLIC_STREAM_FARM_ADDRESS` in admin **and** `VITE_STREAM_FARM_MAINNET` / `deployments.generated.ts` in the main app so both stay in sync.

## Typical workflow

1. Admin → **Create Farm** (stake token + lock/penalty rules)
2. Admin → **Add Rewards** (approve reward token → fund stream)
3. Users → main app **Farm** → deposit (mints position NFT)
4. Admin → **Overview** → pause farm or add more reward streams as needed
