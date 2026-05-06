const { ethers } = require('ethers');

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
    topics: [
      TRANSFER_TOPIC,
      null,
      paddedAddress
    ]
  };

  // Query transfers FROM the address
  const filterFrom = {
    fromBlock: ethers.toBeHex(fromBlock),
    toBlock: ethers.toBeHex(toBlock),
    topics: [
      TRANSFER_TOPIC,
      paddedAddress,
      null
    ]
  };

  console.log(`Scanning blocks ${fromBlock} to ${toBlock}...`);

  try {
    const [logsTo, logsFrom] = await Promise.all([
      provider.getLogs(filterTo),
      provider.getLogs(filterFrom)
    ]);

    allLogs = [...logsTo, ...logsFrom];
    console.log(`  Found ${allLogs.length} transfer events`);
  } catch (error) {
    console.log(`  Chunk too large, splitting...`);
    const midBlock = Math.floor((fromBlock + toBlock) / 2);
    const [first, second] = await Promise.all([
      getLogsInChunks(address, fromBlock, midBlock, chunkSize),
      getLogsInChunks(address, midBlock + 1, toBlock, chunkSize)
    ]);
    allLogs = [...first, ...second];
  }

  return allLogs;
}

async function getTokenBalances(address) {
  console.log(`\n🔍 Scanning Monad testnet for all token balances of: ${address}\n`);

  // Get current block
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}\n`);

  // Step 1: Get all Transfer logs involving this address
  const CHUNK_SIZE = 100000;
  let allLogs = [];

  // Try to get logs from genesis. If the RPC limits range, we'll chunk it.
  const startBlock = 0;
  console.log('Fetching transfer events... (this may take a while)');

  // Split into chunks of CHUNK_SIZE blocks
  for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
    const chunkLogs = await getLogsInChunks(
      address,
      from,
      to,
      Math.floor(CHUNK_SIZE / 10)
    );
    allLogs = [...allLogs, ...chunkLogs];
  }

  // Step 2: Extract unique token addresses from logs
  const tokenAddresses = [...new Set(allLogs.map(log => log.address))];
  console.log(`\n📊 Found ${tokenAddresses.length} unique token contracts\n`);

  // Step 3: Check balance for each token
  const balances = [];
  for (const tokenAddress of tokenAddresses) {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => '???'),
        contract.name().catch(() => 'Unknown')
      ]);

      // Only include tokens with non-zero balance
      if (balance > 0n) {
        const formattedBalance = ethers.formatUnits(balance, decimals);
        balances.push({
          token: tokenAddress,
          name,
          symbol,
          balance: formattedBalance,
          rawBalance: balance.toString(),
          decimals
        });
      }
    } catch (error) {
      // Skip tokens that revert or don't conform to ERC-20
      continue;
    }
  }

  return balances;
}

async function getNativeBalance(address) {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

// Main execution
async function main() {
  const address = process.argv[2];

  if (!address || !ethers.isAddress(address)) {
    console.log('Usage: node test-token-discovery.cjs <ADDRESS>');
    console.log('Example: node test-token-discovery.cjs 0x...');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Monad Testnet Token Scanner (Pure RPC)');
  console.log('='.repeat(60));

  // Get native MON balance
  const nativeBalance = await getNativeBalance(address);
  console.log(`\n💰 Native MON: ${nativeBalance} MON\n`);

  // Get all token balances
  const tokenBalances = await getTokenBalances(address);

  if (tokenBalances.length === 0) {
    console.log('No ERC-20 tokens found with balance > 0');
  } else {
    console.log('='.repeat(60));
    console.log('ERC-20 TOKEN BALANCES');
    console.log('='.repeat(60));
    tokenBalances.forEach((token, i) => {
      console.log(`\n${i + 1}. ${token.name} (${token.symbol})`);
      console.log(`   Address: ${token.token}`);
      console.log(`   Balance: ${token.balance}`);
      console.log(`   Decimals: ${token.decimals}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Scan complete. No token imports needed. Just RPC.');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});