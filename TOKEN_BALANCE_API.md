# Token Balance API - Auto-Discovery on Monad

This feature automatically fetches all ERC-20 token balances for connected wallets on Monad without requiring users to manually enter token addresses.

## 🚀 How It Works

The system uses the **Monad Explorer API** to:
1. Discover all tokens the user has interacted with (via transfer history)
2. Fetch token metadata (symbol, name, decimals) from the blockchain
3. Query current balances for each token
4. Display only tokens with non-zero balances, sorted by amount

## 📦 What's Included

### 1. Core API (`src/lib/web3/tokenBalances.ts`)

```typescript
import { fetchAllBalances } from "@/lib/web3/tokenBalances";

// Fetch all balances (native MON + all ERC-20 tokens)
const balances = await fetchAllBalances(address, chainId, publicClient);
```

**Functions:**
- `fetchAllBalances()` - Get native + ERC-20 token balances
- `fetchUserTokenBalances()` - Get only ERC-20 tokens
- `fetchNativeBalance()` - Get only native MON balance

### 2. React Hook (`src/lib/web3/hooks.ts`)

```typescript
import { useAllTokenBalances } from "@/lib/web3/hooks";

function MyComponent() {
  const { balances, isLoading, error, refetch } = useAllTokenBalances();
  
  return (
    <div>
      {balances.map(token => (
        <div key={token.address}>
          {token.symbol}: {token.balanceFormatted}
        </div>
      ))}
    </div>
  );
}
```

### 3. UI Component (`src/components/TokenBalanceSelector.tsx`)

A ready-to-use component with:
- ✅ Automatic token discovery
- ✅ Search functionality
- ✅ Refresh button
- ✅ Loading states
- ✅ Error handling
- ✅ Sorted by balance (highest first)

```typescript
import { TokenBalanceSelector } from "@/components/TokenBalanceSelector";

<TokenBalanceSelector
  onSelect={(token) => {
    console.log("Selected:", token.symbol, token.balance);
  }}
  selectedAddress={selectedTokenAddress}
/>
```

## 🎯 Usage Examples

### Example 1: Simple Token List

```typescript
import { useAllTokenBalances } from "@/lib/web3/hooks";

function TokenList() {
  const { balances, isLoading } = useAllTokenBalances();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <ul>
      {balances.map(token => (
        <li key={token.address}>
          {token.symbol}: {token.balanceFormatted}
        </li>
      ))}
    </ul>
  );
}
```

### Example 2: Token Selector in Dialog

```typescript
import { TokenBalanceSelector } from "@/components/TokenBalanceSelector";
import { useState } from "react";

function CreateLockDialog() {
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  
  return (
    <div>
      <h2>Select Token to Lock</h2>
      <TokenBalanceSelector
        onSelect={setSelectedToken}
        selectedAddress={selectedToken?.address}
      />
      {selectedToken && (
        <p>Selected: {selectedToken.symbol} ({selectedToken.balanceFormatted})</p>
      )}
    </div>
  );
}
```

### Example 3: Manual API Call

```typescript
import { fetchAllBalances } from "@/lib/web3/tokenBalances";
import { usePublicClient, useAccount, useChainId } from "wagmi";

async function loadBalances() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const chainId = useChainId();
  
  if (!address || !publicClient) return;
  
  const balances = await fetchAllBalances(address, chainId, publicClient);
  console.log("User has", balances.length, "tokens");
  
  balances.forEach(token => {
    console.log(`${token.symbol}: ${token.balanceFormatted}`);
  });
}
```

## 🔧 Integration with Existing Components

### Update CreateLockDialog

Replace manual token address input with the token selector:

```typescript
import { TokenBalanceSelector } from "@/components/TokenBalanceSelector";

// Inside your dialog:
<TokenBalanceSelector
  onSelect={(token) => {
    setTokenAddress(token.address);
    setTokenSymbol(token.symbol);
    setTokenDecimals(token.decimals);
  }}
  selectedAddress={tokenAddress}
/>
```

### Update CreateVestingDialog

Same approach - replace manual input with auto-discovery:

```typescript
<TokenBalanceSelector
  onSelect={(token) => {
    setToken(token.address);
    // Token metadata is automatically available
  }}
  selectedAddress={token}
/>
```

## 📊 Data Structure

```typescript
type TokenBalance = {
  address: `0x${string}`;      // Token contract address
  symbol: string;               // e.g., "USDC"
  name: string;                 // e.g., "USD Coin"
  decimals: number;             // e.g., 6
  balance: bigint;              // Raw balance (wei)
  balanceFormatted: string;     // Human-readable balance
};
```

## 🌐 API Endpoints

The system uses the Monad Explorer API:
- **Testnet**: `https://testnet.monadexplorer.com/api`
- **Endpoint**: `?module=account&action=tokentx&address={address}`

Configured in `src/lib/web3/tokens.ts`:
```typescript
export const EXPLORER_API: Record<number, string> = {
  10143: "https://testnet.monadexplorer.com/api",
};
```

## ⚡ Performance

- **Parallel Fetching**: Token metadata and balances are fetched in parallel
- **Caching**: React hooks cache results until wallet/chain changes
- **Filtering**: Only tokens with non-zero balances are returned
- **Sorting**: Results sorted by balance (highest first)

## 🎨 Styling

The `TokenBalanceSelector` component uses your existing design system:
- Purple accent color (`#9B7FD4`)
- Grotesk font for labels
- Mono font for addresses
- Consistent border and background styles

## 🔄 Refresh Functionality

Users can manually refresh token balances:

```typescript
const { balances, refetch } = useAllTokenBalances();

<button onClick={refetch}>Refresh Balances</button>
```

## 🐛 Error Handling

The system gracefully handles:
- ❌ Network failures
- ❌ Invalid token contracts
- ❌ Missing token metadata
- ❌ API rate limits

Errors are logged to console and exposed via the hook:

```typescript
const { error } = useAllTokenBalances();

if (error) {
  console.error("Failed to load balances:", error);
}
```

## 🚦 Best Practices

1. **Always check wallet connection** before using the hook
2. **Show loading states** while fetching
3. **Handle empty states** (no tokens found)
4. **Provide refresh option** for users
5. **Display formatted balances** using `balanceFormatted`

## 📝 Notes

- Native MON token is always included (address: `0x0000...0000`)
- Only tokens with non-zero balances are shown
- Token discovery is based on transfer history (requires at least one transfer)
- New tokens may take a few seconds to appear after first transfer

## 🎉 Benefits

✅ **No manual address entry** - Users don't need to copy/paste token addresses  
✅ **Automatic discovery** - All tokens are found automatically  
✅ **Real-time balances** - Always shows current balance  
✅ **Better UX** - Cleaner, faster, more intuitive  
✅ **Fewer errors** - No typos in addresses  
✅ **Mobile-friendly** - No need to switch apps to find addresses  

## 🔮 Future Enhancements

Potential improvements:
- Token logos/icons from a token list
- USD price display (integrate with price API)
- Token verification badges
- Custom token addition (manual override)
- Balance change notifications
- Historical balance tracking
