import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readDotEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line) => {
    const text = line.trim();
    if (!text || text.startsWith('#')) return [];
    const index = text.indexOf('=');
    if (index < 1) return [];
    const raw = text.slice(index + 1).trim();
    const quoted = /^['"].*['"]$/.test(raw);
    const value = (quoted ? raw : raw.replace(/\s+#.*$/, '')).trim().replace(/^['"]|['"]$/g, '');
    return [[text.slice(0, index).trim(), value]];
  }));
}

const dotenv = readDotEnv(resolve(process.cwd(), '.env'));
const env = { ...dotenv, ...process.env };
const number = (name, fallback) => Number.isFinite(Number(env[name])) ? Number(env[name]) : fallback;

export const config = Object.freeze({
  port: number('PORT', 3000),
  rail: env.RAIL || 'mock',
  signer: env.SIGNER || 'outlayer',
  ownerAccount: env.OWNER_ACCOUNT || 'you.near',
  demoWallet: env.DEMO_WALLET || env.OWNER_ACCOUNT || 'you.near',
  authMode: env.AUTH_MODE || 'demo',
  treasuryAccount: env.TREASURY_ACCOUNT || 'berry-treasury.mock.near',
  outlayerApi: env.OUTLAYER_API || (env.RAIL === 'testnet' ? 'https://testnet-api.outlayer.ai' : 'https://api.outlayer.ai'),
  outlayerWalletKey: env.OUTLAYER_WALLET_KEY || '',
  outlayerPolicyUrl: env.OUTLAYER_POLICY_URL || '',
  usdcContract: env.USDC_CONTRACT || (env.RAIL === 'testnet' ? '3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af' : '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1'),
  outlayerTimeoutMs: number('OUTLAYER_TIMEOUT_MS', 20_000),
  captureBalanceProof: String(env.CAPTURE_BALANCE_PROOF || 'true').toLowerCase() === 'true',
  dailyPayoutCap: number('DAILY_PAYOUT_CAP', 1000),
  dailyAiCap: number('DAILY_AI_CAP', 5),
  aiBaseUrl: env.AI_BASE_URL || 'https://cloud-api.near.ai/v1',
  aiApiKey: env.AI_API_KEY || '',
  aiModel: env.AI_MODEL || 'z-ai/glm-5.3-flash',
  aiInputCostPerMillion: Math.max(0, number('AI_INPUT_COST_PER_1M', 0.08)),
  aiCacheReadCostPerMillion: Math.max(0, number('AI_CACHE_READ_COST_PER_1M', 0.012)),
  aiOutputCostPerMillion: Math.max(0, number('AI_OUTPUT_COST_PER_1M', 0.5)),
  aiMaxInputTokens: Math.max(1, Math.floor(number('AI_MAX_INPUT_TOKENS', 8192))),
  aiMaxOutputTokens: Math.max(1, Math.floor(number('AI_MAX_OUTPUT_TOKENS', 1024))),
  nearIntentsApi: env.NEAR_INTENTS_API || 'https://1click.chaindefuser.com',
  nearIntentsApiKey: env.NEAR_INTENTS_API_KEY || '',
  nearIntentsEnabled: String(env.NEAR_INTENTS_ENABLED || '').toLowerCase() === 'true',
  nearIntentsReceiver: env.NEAR_INTENTS_RECEIVER || '',
  nearIntentsOriginAsset: env.NEAR_INTENTS_ORIGIN_ASSET || 'nep141:wrap.near',
  nearIntentsUsdcAsset: env.NEAR_INTENTS_USDC_ASSET || 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  dbPath: resolve(process.cwd(), env.BERRY_DB_PATH || 'data/berry.sqlite'),
  publicDir: resolve(process.cwd(), 'public')
});
