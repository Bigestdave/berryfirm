import { randomUUID } from 'node:crypto';

/**
 * All money movement goes through this boundary. The agent can never call this
 * module directly: `store.confirmPayout` invokes it only after the policy gate.
 */
const atomicUsdc = amount => {
  const units = Math.round(Number(amount) * 1_000_000);
  if (!Number.isSafeInteger(units) || units <= 0) throw new Error('Invalid USDC payout amount');
  return String(units);
};

const outlayerRequest = async ({ baseUrl, walletKey, path, method = 'POST', body, timeoutMs, fetchImpl }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method,
      signal: controller.signal,
      headers: { authorization: `Bearer ${walletKey}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`OutLayer ${response.status}: ${payload.message || payload.error || 'request failed'}`);
    return payload;
  } finally { clearTimeout(timeout); }
};

async function outlayerTestnetPayout({ to, amount, reference, config, fetchImpl }) {
  if (!config.outlayerWalletKey) throw new Error('Testnet wallet is not configured. Run `npm run wallet:testnet -- <your-account.testnet>` first.');
  if (!/^[a-zA-Z0-9._-]{2,64}$/.test(to || '')) throw new Error('A valid NEAR testnet payout account is required');
  const request = ({ path, body }) => outlayerRequest({ baseUrl: config.outlayerApi, walletKey: config.outlayerWalletKey, path, body, timeoutMs: config.outlayerTimeoutMs, fetchImpl });
  const required = BigInt(atomicUsdc(amount));
  const balance = await outlayerRequest({
    baseUrl: config.outlayerApi,
    walletKey: config.outlayerWalletKey,
    path: `/wallet/v1/balance?chain=near&token=${encodeURIComponent(config.usdcContract)}`,
    method: 'GET',
    timeoutMs: config.outlayerTimeoutMs,
    fetchImpl
  });
  if (!/^\d+$/.test(String(balance.balance || ''))) throw new Error('OutLayer returned an invalid USDC balance');
  if (BigInt(balance.balance) < required) throw new Error('OutLayer treasury USDC balance is insufficient');
  const storage = await request({ path: '/wallet/v1/storage-deposit', body: { token: config.usdcContract, account_id: to } });
  if (storage.status === 'pending_approval') throw new Error(`OutLayer policy approval is pending${storage.request_id ? ` (${storage.request_id})` : ''}`);
  if (storage.status && storage.status !== 'success') throw new Error(`Could not register recipient storage: ${storage.status}`);
  const transfer = await request({
    path: '/wallet/v1/call',
    body: {
      receiver_id: config.usdcContract,
      method_name: 'ft_transfer',
      args: { receiver_id: to, amount: required.toString(), memo: `Berry Firm settlement ${reference}` },
      gas: '30000000000000',
      deposit: '1'
    }
  });
  if (transfer.status === 'pending_approval') throw new Error(`OutLayer policy approval is pending${transfer.request_id ? ` (${transfer.request_id})` : ''}`);
  if (transfer.status !== 'success' || !transfer.tx_hash) throw new Error(`OutLayer transfer was not confirmed${transfer.status ? ` (${transfer.status})` : ''}`);
  return { status: 'paid', reference: transfer.tx_hash, simulated: false, network: 'testnet' };
}

export async function pay({ rail, signer, to, amount, reference, config, fetchImpl = fetch }) {
  if (rail === 'mock') {
    return { status: 'paid', reference: `mock_${randomUUID().replaceAll('-', '').slice(0, 20)}`, simulated: true, network: 'mock' };
  }
  if (rail === 'testnet') {
    if (signer !== 'outlayer') throw new Error('Only the OutLayer testnet signer is implemented.');
    return outlayerTestnetPayout({ to, amount, reference, config, fetchImpl });
  }
  if (rail === 'mainnet') {
    throw new Error('Mainnet settlement is disabled. Verify the testnet rail first.');
  }
  throw new Error(`Unsupported RAIL: ${rail}`);
}
