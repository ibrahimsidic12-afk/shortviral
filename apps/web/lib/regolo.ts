import { RegoloClient } from '@clip-ai/regolo-client';

/**
 * Singleton Regolo client instance for server-side use.
 * Never import this in client components - it uses the API key.
 */
let regoloClient: RegoloClient | null = null;

export function getRegoloClient(): RegoloClient {
  if (!regoloClient) {
    const apiKey = process.env.REGOLO_API_KEY;
    if (!apiKey) {
      throw new Error('REGOLO_API_KEY environment variable is required');
    }

    regoloClient = new RegoloClient({
      apiKey,
      baseURL: process.env.REGOLO_BASE_URL || 'https://api.regolo.ai/v1',
      maxRetries: 3,
      timeout: 120_000,
    });
  }

  return regoloClient;
}
