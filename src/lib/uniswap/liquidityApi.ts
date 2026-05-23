/**
 * Uniswap Liquidity Provisioning API
 * https://liquidity.api.uniswap.org/
 *
 * Browser: set VITE_UNISWAP_API_KEY (never commit real keys).
 * Node/scripts: set UNISWAP_API_KEY in .env.local
 */

const LP_API_BASE = "https://liquidity.api.uniswap.org";

export const MONAD_MAINNET_CHAIN_ID = 143;
export const MONAD_TESTNET_CHAIN_ID = 10143;

export type LpProtocol = "V2" | "V3" | "V4";
export type LpAction = "CREATE" | "INCREASE" | "DECREASE" | "MIGRATE";

export type LpTokenInput = {
  tokenAddress: string;
  amount: string;
};

export type PoolReference = {
  poolReferenceIdentifier: string;
};

export type PoolParameters = {
  token0Address: string;
  token1Address: string;
  fee?: string;
  tickSpacing?: string;
  hooks?: string;
};

export type PoolInfoRequest = {
  protocol: LpProtocol[];
  chainId: number;
  poolParameters?: PoolParameters;
  poolReferences?: PoolReference[];
  pageSize?: number;
  currentPage?: number;
};

export type LpApprovalRequest = {
  walletAddress: string;
  protocol: LpProtocol;
  chainId: number;
  lpTokens: LpTokenInput[];
  action: LpAction;
  includeGasInfo?: boolean;
  simulateTransaction?: boolean;
  generatePermitAsTransaction?: boolean;
  urgency?: "NORMAL" | "FAST" | "URGENT";
  v3NftTokenId?: number;
};

export type LpTransaction = {
  to: string;
  from?: string;
  data: string;
  value?: string;
  gasLimit?: string;
  chainId?: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
};

export type LpApiError = {
  errorCode?: string;
  detail?: string;
  message?: string;
};

function getApiKey(explicit?: string): string {
  const key =
    explicit ??
    (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_UNISWAP_API_KEY?: string } }).env?.VITE_UNISWAP_API_KEY) ??
    (typeof process !== "undefined" ? process.env.UNISWAP_API_KEY : undefined);
  if (!key || key === "your_key_here") {
    throw new Error(
      "Missing Uniswap API key. Set UNISWAP_API_KEY in .env.local (scripts) or VITE_UNISWAP_API_KEY (Vite).",
    );
  }
  return key;
}

export async function lpApiPost<T>(
  path: string,
  body: unknown,
  apiKey?: string,
): Promise<T> {
  const res = await fetch(`${LP_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(apiKey),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: T & LpApiError;
  try {
    json = JSON.parse(text) as T & LpApiError;
  } catch {
    throw new Error(`LP API ${path} ${res.status}: ${text.slice(0, 400)}`);
  }

  if (!res.ok) {
    const msg = json.detail ?? json.message ?? json.errorCode ?? text.slice(0, 400);
    throw new Error(`LP API ${path} ${res.status}: ${msg}`);
  }

  return json;
}

/** POST /lp/pool_info */
export function fetchLpPoolInfo(req: PoolInfoRequest, apiKey?: string) {
  return lpApiPost<{
    requestId: string;
    pools: Array<{
      poolReferenceIdentifier: string;
      poolProtocol?: string[];
      tokenAddressA: string;
      tokenAddressB: string;
      tickSpacing?: number;
      fee?: string;
      hookAddress?: string;
      chainId: number;
      tokenAmountA?: string;
      tokenAmountB?: string;
      tokenDecimalsA?: number;
      tokenDecimalsB?: number;
      poolLiquidity?: string;
      sqrtRatioX96?: string;
      currentTick?: number;
      tokenAReserves?: string;
      tokenBReserves?: string;
    }>;
    pageSize?: number;
    currentPage?: number;
  }>("/lp/pool_info", req, apiKey);
}

/** POST /lp/check_approval */
export function checkLpApproval(req: LpApprovalRequest, apiKey?: string) {
  return lpApiPost<{
    requestId: string;
    transactions: Array<{
      transaction: LpTransaction;
      cancelApproval?: boolean;
      action?: string;
      gasFee?: string;
    }>;
    v4BatchPermitData?: unknown;
    v3NftPermitData?: unknown;
  }>("/lp/check_approval", req, apiKey);
}

/** POST /lp/create */
export function createLpPosition(body: Record<string, unknown>, apiKey?: string) {
  return lpApiPost<{
    requestId: string;
    token0: { tokenAddress: string; amount: string };
    token1: { tokenAddress: string; amount: string };
    adjustedMinPrice: string;
    adjustedMaxPrice: string;
    tickLower: number;
    tickUpper: number;
    create: LpTransaction;
    gasFee?: string;
  }>("/lp/create", body, apiKey);
}

/** POST /lp/increase */
export function increaseLpPosition(body: Record<string, unknown>, apiKey?: string) {
  return lpApiPost<{
    requestId: string;
    token0: { tokenAddress: string; amount: string };
    token1: { tokenAddress: string; amount: string };
    increase: LpTransaction;
    gasFee?: string;
  }>("/lp/increase", body, apiKey);
}

/** POST /lp/claim_fees */
export function claimLpFees(
  body: {
    protocol: LpProtocol;
    walletAddress: string;
    chainId: number;
    tokenId: string;
    simulateTransaction?: boolean;
    collectAsWeth?: boolean;
  },
  apiKey?: string,
) {
  return lpApiPost<{
    requestId: string;
    token0: { tokenAddress: string; amount: string };
    token1: { tokenAddress: string; amount: string };
    claim: LpTransaction;
    gasFee?: string;
  }>("/lp/claim_fees", body, apiKey);
}
