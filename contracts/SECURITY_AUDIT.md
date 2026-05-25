# Security Audit — GZ Utility Contracts

**Date:** 2026-05-23  
**Scope:** `TokenLockNFT`, `VestingNFT`, `StreamFarm`, `OTCMarket` (Solidity ^0.8.20, OpenZeppelin 5.x)  
**Out of scope:** Capricorn CL / Uniswap pool contracts (not in this repo)

---

## Executive summary

| Contract       | User fund paths                         | Status after fixes                          |
|----------------|-----------------------------------------|---------------------------------------------|
| TokenLockNFT   | Lock → NFT transfer → withdraw          | Escrow-protected admin recovery             |
| VestingNFT     | Create → claim; owner revoke            | Escrow-protected recovery; revoke is trusted |
| StreamFarm     | Deposit / claim / withdraw              | Liability-capped admin recovery             |
| OTCMarket      | List escrow → buy / unlist              | Cannot recover active listing NFTs          |

**No automated formal verification** (Certora / Slither) was run in this pass. `hardhat compile` succeeds after fixes.

**Deployed bytecode:** If contracts are already on Monad mainnet, **redeploy** is required for these fixes — old deployments still have unrestricted admin recovery.

---

## Critical issues (fixed in this repo)

### 1. Admin could drain user escrow

| Contract      | Function                 | Issue |
|---------------|--------------------------|-------|
| TokenLockNFT  | `emergencyRecoverToken`  | Owner could transfer full ERC20 balance, including locked tokens |
| VestingNFT    | `emergencyRecoverToken`  | Same |
| StreamFarm    | `recoverTokens`          | Admin could drain staked principal and undistributed rewards |
| OTCMarket     | `recoverStuckNFT`        | Owner could take NFTs held for **active** listings |

**Fix:**

- **TokenLockNFT / VestingNFT:** `totalEscrowed[token]` tracks liability; recovery limited to `balance - totalEscrowed`.
- **StreamFarm:** `_tokenLiability()` sums `totalStaked` per farm + undistributed reward budget per stream; `recoverTokens` capped via `recoverableBalance()`.
- **OTCMarket:** `activeListingByNft` mapping; `recoverStuckNFT` reverts if listing is active.

---

## High / trust assumptions (documented, not bugs)

### VestingNFT — `revokeVesting` (onlyOwner)

- Owner can revoke any vesting; **unvested** tokens go to contract owner, **claimable** slice goes to current NFT holder.
- This is **centralization by design** (employer/grantor control). Disclose in UI and legal copy.

### StreamFarm — early withdraw penalty

- Penalty tokens remain in the contract and are recoverable by admin via `recoverTokens` (they are **not** counted as user liability). Intended.

### Fee-on-transfer / rebasing ERC20s

- All four contracts account using **requested transfer amounts**, not `balanceOf` deltas.
- Deflationary or rebasing tokens can desync escrow vs real balance → **do not support** without contract changes.

### StreamFarm — reward rounding

- `rewardRate = totalBudget * 1e18 / duration` can leave dust; undistributed remainder stays recoverable as non-liability excess after streams end.

### OTCMarket — payment tokens

- No ERC20 escrow in the market contract for payments (buyer → seller direct). Accidental ERC20 sends to OTC are not recoverable unless you add a similar excess-only helper.

---

## Medium / low

| Item | Severity | Notes |
|------|----------|-------|
| `list()` does not verify NFT encodes real lock/vest/farm state | Low | Seller can list any approved ERC721; buyer must verify underlying position |
| `getActiveListings` scans all listings | Low | Gas for views only; fine at moderate scale |
| StreamFarm `recoverTokens` liability loop | Low | O(farms × streams); admin-only, acceptable |
| NFT transfer before withdraw/claim | Info | By design — new owner gets economic rights |
| Platform fee up to 10% | Info | `setFee` capped at `MAX_FEE` |

---

## What looks sound

- `nonReentrant` on user-facing state changes
- `SafeERC20` for transfers
- OpenZeppelin `Ownable` / `ReentrancyGuard`
- TokenLockNFT: only NFT owner withdraws after `unlockTime`
- VestingNFT: linear vesting + cliff; claim updates `claimed` before transfer
- StreamFarm: MasterChef-style `accRewardPerShare`; rewards capped to remaining budget
- OTCMarket: `buy` / `unlist` deactivate listing and clear `activeListingByNft`; fee split on buy

---

## Recommendations before mainnet

1. **Redeploy** all four contracts with escrow fixes; update `src/lib/web3/contracts.ts` addresses.
2. **Transfer ownership** to multisig or timelock; document `revokeVesting` power.
3. **Blocklist** fee-on-transfer tokens in the frontend.
4. Add **Hardhat tests** for: lock/withdraw escrow, vest claim/revoke accounting, farm deposit/withdraw/recover excess, OTC list/buy/recover revert on active listing.
5. Optional: run [Slither](https://github.com/crytic/slither) on `contracts/contracts/*.sol`.

---

## User-facing checklist (100% “clean” UX)

- [ ] Show deployed addresses + “audited 2026-05-23 (escrow fixes)” badge only after redeploy
- [ ] Warn that vesting creator can revoke
- [ ] Warn that lock/vest/farm **NFT owner** controls funds
- [ ] OTC: verify NFT contract is official GZ deployment before buy

---

## Changelog (audit remediation)

- Added `totalEscrowed` + bounded `emergencyRecoverToken` (TokenLockNFT, VestingNFT)
- Added `_tokenLiability` / `recoverableBalance` + bounded `recoverTokens` (StreamFarm)
- Added `activeListingByNft` + guarded `recoverStuckNFT` (OTCMarket)
