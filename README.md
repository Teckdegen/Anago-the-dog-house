# Anago-the-dog-house

🐕 **The Dog House** - NFT-Based DeFi Suite on Monad

A complete DeFi platform featuring:
- **Token Locks** - Lock tokens as transferable NFTs
- **Vesting Schedules** - Create vesting with optional cliff as NFTs
- **Yield Farming** - Advanced multi-reward farming with vote-escrow and bribes
- **Admin Dashboard** - Wallet-gated management interface
- **Token Auto-Discovery** - Automatic token detection from Monad Explorer

## 🚀 Deployed Contracts (Monad Testnet)

- **TokenLockNFT**: `0xe6A045525C053259e096d2c48973856D9f06143f`
- **VestingNFT**: `0x2f0326D9eDDB98da0d05CfD7e7C94cbAEdacB206`
- **YieldFarmNFT**: `0x330b72ea1A45b392BfccE383d1876F5e3d7bb74d`

## 🏗️ Architecture

All positions are NFTs (ERC721):
- ✅ Fully transferable
- ✅ Tradeable on marketplaces
- ✅ Can be used as collateral
- ✅ No user address mappings
- ✅ Pure NFT ownership

## 🛠️ Tech Stack

- **Frontend**: React + TanStack Router + Viem + Wagmi
- **Contracts**: Solidity 0.8.24 + Hardhat + OpenZeppelin
- **Network**: Monad Testnet (Chain ID: 10143)

## 📦 Installation

```bash
# Install dependencies
npm install

# Install contract dependencies
cd contracts
npm install
```

## 🚀 Development

```bash
# Start frontend
npm run dev

# Compile contracts
cd contracts
npm run compile

# Deploy contracts
npm run deploy:all
```

## 🔑 Key Features

### Token Locks
- Lock any ERC20 token for a specified duration
- Each lock is an NFT that can be transferred
- Withdraw tokens after unlock time

### Vesting Schedules
- Create linear vesting schedules with optional cliff
- Each vesting is an NFT owned by the beneficiary
- Claim vested tokens over time
- Transfer vesting rights by transferring the NFT

### Yield Farming
- Permissionless pool creation (with fee)
- Vote-escrow locking for boosted rewards
- Bribe marketplace for emission control
- Multi-reward per pool
- Each farm position is an NFT

### Admin Dashboard
- Wallet-gated access (only specific admin wallet)
- Create and manage farm pools
- Add reward tokens to pools
- View platform statistics

## 📄 License

MIT
