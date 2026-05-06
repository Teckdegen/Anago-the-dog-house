/**
 * Custom token management - allows users to add tokens manually
 */

import type { TokenInfo } from "./tokens";

const STORAGE_KEY = "doghouse_custom_tokens";

/**
 * Get custom tokens from localStorage
 */
export function getCustomTokens(chainId: number): TokenInfo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    return data[chainId] || [];
  } catch {
    return [];
  }
}

/**
 * Add a custom token
 */
export function addCustomToken(chainId: number, token: TokenInfo): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    
    if (!data[chainId]) {
      data[chainId] = [];
    }
    
    // Check if token already exists
    const exists = data[chainId].some((t: TokenInfo) => 
      t.address.toLowerCase() === token.address.toLowerCase()
    );
    
    if (!exists) {
      data[chainId].push(token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error("Failed to save custom token:", error);
  }
}

/**
 * Remove a custom token
 */
export function removeCustomToken(chainId: number, address: `0x${string}`): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const data = JSON.parse(stored);
    if (!data[chainId]) return;
    
    data[chainId] = data[chainId].filter((t: TokenInfo) => 
      t.address.toLowerCase() !== address.toLowerCase()
    );
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to remove custom token:", error);
  }
}

/**
 * Get all tokens (curated + custom)
 */
export function getAllTokens(chainId: number, curatedTokens: TokenInfo[]): TokenInfo[] {
  const customTokens = getCustomTokens(chainId);
  const allTokens = [...curatedTokens];
  
  // Add custom tokens that aren't already in the curated list
  customTokens.forEach(customToken => {
    const exists = allTokens.some(token => 
      token.address.toLowerCase() === customToken.address.toLowerCase()
    );
    if (!exists) {
      allTokens.push(customToken);
    }
  });
  
  return allTokens;
}