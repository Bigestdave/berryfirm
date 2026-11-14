import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createBerryServer } from '../server/index.mjs';
import { config as baseConfig } from '../server/config.mjs';
import { challengeRules, priceAt, payoutAmount } from '../server/rules.mjs';
import { pay } from '../server/rail.mjs';
import { prepareOutlayerTestnet } from '../scripts/prepare-outlayer-testnet.mjs';

async function app(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'berry-firm-'));
  const appConfig = { ...baseConfig, dbPath: join(dir, 'berry.sqlite'), ownerAccount: 'owner.near', demoWallet: 'owner.near', authMode: 'demo', rail: 'mock', aiBaseUrl: '', aiModel: '', ...overrides };
  const instance = createBerryServer({ appConfig });
  await new Promise((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${instance.server.address().port}`;
  let session = '';
  const request = async (path, options = {}) => {
    const response = await fetch(origin + path, { ...options, headers: { cookie: session, 'content-type': 'application/json', ...(options.headers || {}) } });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) session = setCookie.split(';')[0];
    return { response, body: await response.json() };
  };
  return { ...instance, dir, request, close: async () => { await new Promise((resolve) => instance.server.close(resolve)); instance.store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('mock loop records sale, agent decision, and payout on the public ledger', async () => {
  const instance = await app();
  try {
    let result = await instance.request('/api/auth/mock', { method: 'POST', body: JSON.stringify({ wallet: 'owner.near' }) });
    assert.equal(result.response.status, 200);
    result = await instance.request('/api/demo/seed', { method: 'POST' });
    assert.equal(result.response.status, 200);
    result = await instance.request('/api/payouts', { method: 'POST', body: JSON.stringify({ wallet: 'owner.near' }) });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.payout.status, 'approved');
    assert.equal(result.body.decision.by, 'offline-policy');
    result = await instance.request(`/api/payouts/${result.body.payout.id}/confirm`, { method: 'POST' });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.payout.status, 'paid');
    result = await instance.request('/api/ledger');
    assert.equal(result.response.status, 200);
    assert.ok(result.body.some((entry) => entry.type === 'sale'));
    assert.ok(result.body.some((entry) => entry.type === 'decision'));
    assert.ok(result.body.some((entry) => entry.type === 'payout' && entry.metadata.simulated));
  } finally { await instance.close(); }
});

test('the policy gate escalates a payout that exceeds the daily cap', async () => {
  const instance = await app();
  try {
    await instance.request('/api/auth/mock', { method: 'POST', body: JSON.stringify({ wallet: 'owner.near' }) });
    await instance.request('/api/demo/seed', { method: 'POST' });
    instance.store.updateSettings({ payoutCap: 0 });
    const result = await instance.request('/api/payouts', { method: 'POST', body: JSON.stringify({ wallet: 'owner.near' }) });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.payout.status, 'escalated');
    assert.match(result.body.payout.reason, /Daily payout cap/);
  } finally { await instance.close(); }
});

test('price and payout rules are deterministic and retain the hard payout cap', () => {
  const at = Date.UTC(2026, 10, 13, 12, 0, 0);
  assert.equal(priceAt('BTC', at), priceAt('BTC', at));
  assert.deepEqual(challengeRules(10_000), {
    startingBalance: 10_000, target: 1_000, dailyLoss: 500, maxLoss: 1_000,
    minTradingDays: 3, maxExposureMultiple: 2, feeRate: 0.0005, slippageRate: 0.0002
  });
  assert.equal(payoutAmount({ balance: 11_000, startingBalance: 10_000 }), 900);
});

test('OutLayer testnet rail registers recipient storage then submits six-decimal USDC transfer', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, body: options.body ? JSON.parse(options.body) : null, authorization: options.headers.authorization });
    const payload = requests.length === 1 ? { balance: '5000000' } : requests.length === 2 ? { status: 'success' } : { status: 'success', tx_hash: 'testnet-tx-123' };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await pay({
    rail: 'testnet', signer: 'outlayer', to: 'trader.testnet', amount: 4.8, reference: 'po_123', fetchImpl,
    config: { outlayerWalletKey: 'wk_test', outlayerApi: 'https://testnet-api.outlayer.ai', usdcContract: 'usdc.fakes.testnet', outlayerTimeoutMs: 500 }
  });
  assert.deepEqual(result, { status: 'paid', reference: 'testnet-tx-123', simulated: false, network: 'testnet' });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, 'https://testnet-api.outlayer.ai/wallet/v1/balance?chain=near&token=usdc.fakes.testnet');
  assert.equal(requests[0].authorization, 'Bearer wk_test');
  assert.equal(requests[1].url, 'https://testnet-api.outlayer.ai/wallet/v1/storage-deposit');
  assert.deepEqual(requests[1].body, { token: 'usdc.fakes.testnet', account_id: 'trader.testnet' });
  assert.equal(requests[2].url, 'https://testnet-api.outlayer.ai/wallet/v1/call');
  assert.deepEqual(requests[2].body, {
    receiver_id: 'usdc.fakes.testnet', method_name: 'ft_transfer',
    args: { receiver_id: 'trader.testnet', amount: '4800000', memo: 'Berry Firm settlement po_123' },
    gas: '30000000000000', deposit: '1'
  });
  assert.equal(requests[2].authorization, 'Bearer wk_test');
});

test('a configured testnet demo session can seed the qualifying account for the settlement proof', async () => {
  const instance = await app({ rail: 'testnet', ownerAccount: 'owner.testnet', demoWallet: 'owner.testnet' });
  try {
    let result = await instance.request('/api/auth/session', { method: 'POST', body: '{}' });
    assert.equal(result.response.status, 200);
    result = await instance.request('/api/demo/seed', { method: 'POST', body: '{}' });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.challenge.status, 'funded');
    assert.equal(Number(result.body.challenge.balance), 5000.89);
  } finally { await instance.close(); }
});

test('testnet funding preparation refuses unconfigured wallets and targets only the configured test USDC contract', async () => {
  await assert.rejects(
    () => prepareOutlayerTestnet({ appConfig: { rail: 'mock', outlayerWalletKey: '', treasuryAccount: '' } }),
    /wallet:testnet/
  );
  const requests = [];
  const prepared = await prepareOutlayerTestnet({
    appConfig: { rail: 'testnet', outlayerWalletKey: 'wk_test', treasuryAccount: 'berry.testnet', outlayerApi: 'https://testnet-api.outlayer.ai', usdcContract: 'usdc.fakes.testnet' },
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body), authorization: options.headers.authorization });
      return new Response(JSON.stringify({ status: 'success', already_registered: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  assert.deepEqual(prepared, { treasury: 'berry.testnet', token: 'usdc.fakes.testnet', alreadyRegistered: true });
  assert.deepEqual(requests, [{
    url: 'https://testnet-api.outlayer.ai/wallet/v1/storage-deposit',
    body: { token: 'usdc.fakes.testnet' }, authorization: 'Bearer wk_test'
  }]);
});
