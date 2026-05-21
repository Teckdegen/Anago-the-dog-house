s# Stream Farm Admin Dashboard

Admin-only dashboard for managing Stream Farm contracts. Deploy this to a separate domain.

## Setup

```bash
cd admin
npm install
npm run dev
```

## Deploy to Vercel

```bash
cd admin
npx vercel
```

Or connect the `admin/` directory as a separate project on Vercel with:
- Root Directory: `admin`
- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`

## Features

- **Wallet-gated**: Only admin wallets can access after connecting
- **Create Farms**: Set stake token, lock duration, early exit penalty
- **Add Reward Streams**: Token, budget, duration, start delay
- **Pause/Activate Farms**: Toggle farm status
- **Boost Tiers**: Update lock durations and multipliers
- **Recover Tokens**: Recover penalty/stuck tokens
- **Admin Management**: Add/remove admins (owner only)

## Contract

StreamFarm: `0x8cdaB2A0c70B27E0f6B4eE0540bBC50395978EC1`

Owner (deployer): `0xdb4034fA3829B488eFc1FC0f01F5F1Af722562Df`
