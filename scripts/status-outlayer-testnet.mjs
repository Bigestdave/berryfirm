import { config } from '../server/config.mjs';

if (config.rail !== 'testnet' || !config.outlayerWalletKey || !config.treasuryAccount) {
  throw new Error('Run `npm run wallet:testnet -- berryfirm.testnet` first.');
}

const baseUrl = config.outlayerApi.replace(/\/$/, '');
const headers = { authorization: `Bearer ${config.outlayerWalletKey}` };
const get = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OutLayer status check failed: ${result.message || result.error || response.status}`);
  return result;
};
const displayUnits = (value, decimals) => {
  const atomic = String(value ?? '0');
  if (!/^\d+$/.test(atomic)) return 'unknown';
  const digits = atomic.padStart(decimals + 1, '0');
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
};

const [address, near, usdc] = await Promise.all([
  get('/wallet/v1/address?chain=near'),
  get('/wallet/v1/balance?chain=near'),
  get(`/wallet/v1/balance?chain=near&token=${encodeURIComponent(config.usdcContract)}`)
]);
const reportedAccount = address.account_id || address.address || config.treasuryAccount;
if (reportedAccount !== config.treasuryAccount) {
  throw new Error('The OutLayer wallet address does not match TREASURY_ACCOUNT. Stop and inspect .env before moving funds.');
}

console.log('Berry Firm testnet treasury is reachable.');
console.log(`Treasury: ${reportedAccount}`);
console.log(`Native NEAR: ${displayUnits(near.balance, 24)} NEAR`);
console.log(`Test USDC: ${displayUnits(usdc.balance, 6)} USDC`);
console.log(`Network: NEAR testnet · token: ${config.usdcContract}`);
