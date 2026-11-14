import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const demoWallet = process.argv[2];
if (!/^[a-zA-Z0-9._-]{2,64}$/.test(demoWallet || '')) {
  throw new Error('Usage: npm run wallet:testnet -- <your-existing-account.testnet>');
}

const endpoint = 'https://testnet-api.outlayer.ai/register';
const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
const registration = await response.json().catch(() => ({}));
if (!response.ok || !registration.api_key || !registration.near_account_id) {
  throw new Error(`OutLayer testnet registration failed: ${registration.message || registration.error || response.status}`);
}

const envPath = resolve(process.cwd(), '.env');
const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const values = {
  RAIL: 'testnet',
  SIGNER: 'outlayer',
  AUTH_MODE: 'demo',
  DEMO_WALLET: demoWallet,
  OWNER_ACCOUNT: demoWallet,
  OUTLAYER_API: 'https://testnet-api.outlayer.ai',
  OUTLAYER_WALLET_KEY: registration.api_key,
  TREASURY_ACCOUNT: registration.near_account_id,
  USDC_CONTRACT: '3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af'
};
if (registration.handoff_url) values.OUTLAYER_POLICY_URL = registration.handoff_url;

let next = current;
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  next = pattern.test(next) ? next.replace(pattern, `${name}=${value}`) : `${next}${next && !next.endsWith('\n') ? '\n' : ''}${name}=${value}\n`;
}
writeFileSync(envPath, next, { encoding: 'utf8', mode: 0o600 });

console.log(`Berry Firm testnet treasury created: ${registration.near_account_id}`);
console.log('Testnet configuration and the wallet credential were saved to .env; the credential was not printed.');
console.log(`Next: fund the new custody wallet through https://app.outlayer.ai/wallet/fund?to=${registration.near_account_id}&amount=0.1&token=near&msg=Fund+Berry+Firm+testnet+treasury . Select Testnet and Direct transfer, then run npm run wallet:testnet:status.`);
console.log('After its test USDC storage is ready, fund the treasury with test USDC, configure its OutLayer spend policy, start the app, and run the seeded settlement journey.');
