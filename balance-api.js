import { ethers } from 'ethers';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Monad testnet RPC
const RPC_URL = 'https://testnet-rpc.monad.xyz';
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ERC-20 Transfer event signature
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Minimal ERC-20 ABI for balanceOf
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

// Known tokens on Monad testnet
const KNOWN_TOKENS = {
  '10143': [
    {
      address: '0xa1D67bD149d47d17421c0A558e88E1cf3f8cf541',
      symbol: 'HOUSE',
      name: 'Dog House Token',
      decimals: 18
    },
    {
      address: '0x39171AC03b8e14EeE61791E06a492b98a7ec7983',
      symbol: 'DOG',
      name: 'Dog Coin',
      decimals: 18
    },
    {
      address: '0xAA4162ED4120990695a6eb9A6F936F43B36b3727',
      symbol: 'BONE',
      name: 'Bone Token',
      decimals: 18
    },
    {
      address: '0xBCF1D8725a3887443367653C11D1325d3CE6cCd2',
      symbol: 'TREAT',
      name: 'Treat Token',
      decimals: 6
    },
    {
      address: '0x1ef349548eb2b6dA9Feef726F76629177205480d',
      symbol: 'PAW',
      name: 'Paw Points',
      decimals: 18
    },
    {
      address: '0xa7378E467bf4B3d789e9f3509474D4A33390127e',
      symbol: 'WOOF',
      name: 'Woof Rewards',
      decimals: 18
    }
  ]
};

async function padAddress(address) {
  // Remove 0x and pad to 32 bytes for topic filtering
  return '0x' + address.slice(2).padStart(64, '0');
}

async function getLogsInChunks(address, fromBlock, toBlock, chunkSize = 50000) {
  const paddedAddress = await padAddress(address);
  let allLogs = [];

  // Query transfers TO the address
  const filterTo = {
    fromBlock: ethers.toBeHex(fromBlock),
    toBlock: ethers.toBeHex(toBlock),
    topics: [TRANSFER_TOPIC, null, paddedAddress]
  };

  // Query transfers FROM the address
  const filterFrom = {
    fromBlock: ethers.toBeHex(fromBlock),
    toBlock: ethers.toBeHex(toBlock),
    topics: [TRANSFER_TOPIC, paddedAddress, null]
  };

  try {
    const [logsTo, logsFrom] = await Promise.all([
      provider.getLogs(filterTo),
      provider.getLogs(filterFrom)
    ]);
    allLogs = [...logsTo, ...logsFrom];
  } catch (error) {
    // If chunk too large, split it
    const midBlock = Math.floor((fromBlock + toBlock) / 2);
    const [first, second] = await Promise.all([
      getLogsInChunks(address, fromBlock, midBlock, chunkSize),
      getLogsInChunks(address, midBlock + 1, toBlock, chunkSize)
    ]);
    allLogs = [...first, ...second];
  }

  return allLogs;
}

async function getTokenBalances(address, chainId = 10143) {
  console.log(`Fetching balances for ${address} on chain ${chainId}`);

  const balances = [];

  // Get native MON balance
  try {
    const nativeBalance = await provider.getBalance(address);
    balances.push({
      token: '0x0000000000000000000000000000000000000000',
      symbol: 'MON',
      name: 'Monad',
      decimals: 18,
      balance: ethers.formatEther(nativeBalance),
      rawBalance: nativeBalance.toString()
    });
  } catch (error) {
    console.error('Error fetching native balance:', error);
  }

  // Check known tokens first (faster)
  const knownTokens = KNOWN_TOKENS[chainId.toString()] || [];
  
  for (const tokenInfo of knownTokens) {
    try {
      const contract = new ethers.Contract(tokenInfo.address, ERC20_ABI, provider);
      const balance = await contract.balanceOf(address);
      
      if (balance > 0n) {
        const formattedBalance = ethers.formatUnits(balance, tokenInfo.decimals);
        balances.push({
          token: tokenInfo.address,
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          decimals: tokenInfo.decimals,
          balance: formattedBalance,
          rawBalance: balance.toString()
        });
      }
    } catch (error) {
      console.error(`Error checking token ${tokenInfo.symbol}:`, error.message);
    }
  }

  return balances;
}

// API endpoint
app.get('/api/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const chainId = parseInt(req.query.chainId) || 10143;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const balances = await getTokenBalances(address, chainId);
    
    res.json({
      address,
      chainId,
      balances,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Balance API running on port ${PORT}`);
  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`🔗 Usage: GET /api/balance/:address?chainId=10143`);
});