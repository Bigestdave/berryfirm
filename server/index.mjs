import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';
import { BerryStore } from './store.mjs';
import { decideCase } from './agent.mjs';
import { pay } from './rail.mjs';
import { createChallengeQuote, challengeQuoteStatus, validMainnetAccount } from './intents.mjs';
import { pricesAt } from './rules.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
const cookie = (request, name) => Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((value) => value.trim().split('=')))[name];
const json = (response, status, body, headers = {}) => response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }).end(JSON.stringify(body));
const error = (response, status, message) => json(response, status, { error: message });

async function body(request) {
  const parts = [];
  let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > 1_000_000) throw new Error('Request body is too large');
    parts.push(part);
  }
  if (!parts.length) return {};
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new Error('Request body must be valid JSON'); }
}

function setSession(response, token) {
  return { 'set-cookie': `berry_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` };
}

function publicFile(request, response, publicDir) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://berry.local').pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = resolve(publicDir, normalize(requested));
  const root = resolve(publicDir), outside = relative(root, file).startsWith('..');
  if (outside || !existsSync(file) || !statSync(file).isFile()) return false;
  response.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': requested === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
  createReadStream(file).pipe(response);
  return true;
}

export function createBerryServer({ appConfig = config, store = new BerryStore({ dbPath: appConfig.dbPath, config: appConfig }) } = {}) {
  const currentUser = (request) => store.session(cookie(request, 'berry_session'));
  const requireUser = (request, response) => {
    const user = currentUser(request);
    if (!user) { error(response, 401, 'Sign in required'); return null; }
    return user;
  };
  const requireOwner = (request, response) => {
    const user = requireUser(request, response);
    if (user && user.role !== 'owner') { error(response, 403, 'Owner access required'); return null; }
    return user;
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://berry.local');
      const path = url.pathname;
      const method = request.method || 'GET';
      const parts = path.split('/').filter(Boolean);
      if (!path.startsWith('/api/')) {
        if (!publicFile(request, response, appConfig.publicDir)) error(response, 404, 'Not found');
        return;
      }

        if (method === 'GET' && path === '/api/config') return json(response, 200, { rail: appConfig.rail, demoMode: appConfig.authMode === 'demo', freeEvaluation: ['mock', 'testnet'].includes(appConfig.rail) && appConfig.authMode === 'demo' && Object.values(store.settings().challengeFees).every((fee) => Number(fee) === 0), aiReady: Boolean(appConfig.aiBaseUrl && appConfig.aiApiKey && appConfig.aiModel), nearIntentsConfigured: Boolean(appConfig.nearIntentsEnabled && validMainnetAccount(appConfig.nearIntentsReceiver)), settlementNetwork: appConfig.rail === 'testnet' ? 'NEAR testnet' : appConfig.rail === 'mainnet' ? 'NEAR mainnet' : 'Demo treasury', treasury: appConfig.treasuryAccount, settings: store.settings() });
      if (method === 'POST' && path === '/api/auth/session') {
        if (appConfig.authMode !== 'demo') return error(response, 501, 'Wallet signature sign-in is not configured. Use AUTH_MODE=demo for the testnet demo.');
        const wallet = appConfig.demoWallet;
        store.ensureUser(wallet);
        return json(response, 200, { user: store.ensureUser(wallet) }, setSession(response, store.createSession(wallet)));
      }
      if (method === 'POST' && path === '/api/auth/mock') {
        if (appConfig.rail !== 'mock') return error(response, 403, 'Mock sign-in is disabled outside mock mode');
        const input = await body(request);
        const wallet = input.wallet || appConfig.ownerAccount;
        store.ensureUser(wallet);
        return json(response, 200, { user: store.ensureUser(wallet) }, setSession(response, store.createSession(wallet)));
      }
      if (method === 'POST' && path === '/api/auth/challenge') {
        const input = await body(request);
        return json(response, 200, store.createAuthChallenge(input.wallet));
      }
      if (method === 'POST' && path === '/api/auth/verify') return error(response, 501, 'NEAR signature verification is not configured in this build');

      if (method === 'GET' && path === '/api/prices') return json(response, 200, { prices: pricesAt() });
      if (method === 'GET' && path === '/api/pool') return json(response, 200, store.pool());
      if (method === 'GET' && path === '/api/ledger') return json(response, 200, store.ledgerPage(url.searchParams.get('before')));

      if (method === 'GET' && path === '/api/me') {
        const user = requireUser(request, response); if (!user) return;
        return json(response, 200, { ...store.me(user.wallet), rail: appConfig.rail, demoMode: appConfig.authMode === 'demo', freeEvaluation: ['mock', 'testnet'].includes(appConfig.rail) && appConfig.authMode === 'demo' && Object.values(store.settings().challengeFees).every((fee) => Number(fee) === 0), aiReady: Boolean(appConfig.aiBaseUrl && appConfig.aiApiKey && appConfig.aiModel), nearIntentsConfigured: Boolean(appConfig.nearIntentsEnabled && validMainnetAccount(appConfig.nearIntentsReceiver)), settlementNetwork: appConfig.rail === 'testnet' ? 'NEAR testnet' : appConfig.rail === 'mainnet' ? 'NEAR mainnet' : 'Demo treasury' });
      }
      if (method === 'POST' && path === '/api/challenges/payment-quote') {
        const user = requireUser(request, response); if (!user) return;
        if (!appConfig.nearIntentsEnabled || !validMainnetAccount(appConfig.nearIntentsReceiver)) return error(response, 503, 'NEAR Intents checkout is not configured for mainnet.');
        const input = await body(request), size = Number(input.size), fee = Number(store.settings().challengeFees[size] || 0);
        if (!fee) return error(response, 409, 'This evaluation is free in the current demo.');
        const refundTo = String(input.refundTo || '').trim();
        if (!validMainnetAccount(refundTo)) return error(response, 400, 'Enter a NEAR mainnet account you control for refunds.');
        const quoteResult = await createChallengeQuote({ size, fee, refundTo, config: appConfig });
        const payment = store.createChallengePayment(user.wallet, size, refundTo, quoteResult.quote);
        return json(response, 201, { payment: { id: payment.id, size: payment.size, fee: payment.fee, status: payment.status, refundTo: payment.refund_to, depositAddress: payment.quote.depositAddress, depositMemo: payment.quote.depositMemo, amountIn: payment.quote.amountIn, amountInFormatted: payment.quote.amountInFormatted, originAsset: payment.quote.originAsset, amountOut: payment.quote.amountOut, deadline: payment.quote.deadline, explorerUrl: payment.quote.explorerUrl, paymentNetwork: 'NEAR Intents mainnet', evaluationNetwork: appConfig.rail === 'testnet' ? 'NEAR testnet' : 'NEAR mainnet' } });
      }
      if (method === 'GET' && /^\/api\/challenges\/payments\/[^/]+$/.test(path)) {
        const user = requireUser(request, response); if (!user) return;
        let payment = store.challengePayment(parts[3], user.wallet);
        if (!payment) return error(response, 404, 'Payment not found');
        let challenge = payment.challenge_id ? store.challenge(payment.challenge_id) : null;
        if (payment.status === 'pending') {
          const provider = await challengeQuoteStatus({ depositAddress: payment.quote.depositAddress, depositMemo: payment.quote.depositMemo, config: appConfig });
          if (String(provider.status || '').toUpperCase() === 'SUCCESS') {
            const fulfilled = store.fulfillChallengePayment(payment.id, user.wallet, provider);
            payment = fulfilled.payment; challenge = fulfilled.challenge;
          } else payment = store.updateChallengePayment(payment.id, user.wallet, provider);
        }
        return json(response, 200, { payment: { id: payment.id, size: payment.size, fee: payment.fee, status: payment.status, providerStatus: payment.provider_status, refundTo: payment.refund_to, depositAddress: payment.quote.depositAddress, depositMemo: payment.quote.depositMemo, amountIn: payment.quote.amountIn, amountInFormatted: payment.quote.amountInFormatted, originAsset: payment.quote.originAsset, amountOut: payment.quote.amountOut, deadline: payment.quote.deadline, explorerUrl: payment.quote.explorerUrl, paymentNetwork: 'NEAR Intents mainnet', evaluationNetwork: appConfig.rail === 'testnet' ? 'NEAR testnet' : 'NEAR mainnet' }, challenge });
      }
      if (method === 'POST' && path === '/api/challenges') {
        const user = requireUser(request, response); if (!user) return;
        const existing = store.activeChallenge(user.wallet);
        if (existing) return json(response, 200, { challenge: existing, status: existing.status, reused: true });
        const input = await body(request), fee = Number(store.settings().challengeFees[Number(input.size)] || 0);
        if (fee > 0) return error(response, 402, 'A confirmed NEAR Intents payment is required before this challenge can start.');
        const challenge = store.createChallenge(user.wallet, input.size);
        return json(response, 201, { challenge, status: 'active', free: challenge.fee === 0 });
      }
      if (method === 'POST' && /^\/api\/challenges\/[^/]+\/fund$/.test(path)) {
        const user = requireUser(request, response); if (!user) return;
        const challenge = store.fundChallenge(user.wallet, parts[2]);
        return json(response, 200, { challenge });
      }
      if (method === 'POST' && path === '/api/orders') {
        const user = requireUser(request, response); if (!user) return;
        const input = await body(request);
        const challenge = store.activeChallenge(user.wallet);
        if (!challenge) return error(response, 409, 'No active challenge');
        return json(response, 201, store.createOrder(user.wallet, challenge.id, input));
      }
      if (method === 'PATCH' && /^\/api\/positions\/[^/]+$/.test(path)) {
        const user = requireUser(request, response); if (!user) return;
        const input = await body(request);
        return json(response, 200, { position: store.updatePosition(user.wallet, parts[2], input.stopLoss) });
      }
      if (method === 'POST' && /^\/api\/positions\/[^/]+\/close$/.test(path)) {
        const user = requireUser(request, response); if (!user) return;
        return json(response, 200, store.closePosition(user.wallet, parts[2], (await body(request)).fraction));
      }
      if (method === 'POST' && path === '/api/payouts') {
        const user = requireUser(request, response); if (!user) return;
        const input = await body(request);
        const challenge = store.activeChallenge(user.wallet);
        if (!challenge) return error(response, 409, 'No funded account');
        const created = store.createPayout(user.wallet, challenge.id, input.wallet || user.wallet);
        const result = await decideCase({ store, config: appConfig, caseRecord: created.case });
        return json(response, 201, { payout: result.payout, decision: result.decision, case: result.case });
      }
      if (method === 'POST' && /^\/api\/payouts\/[^/]+\/review$/.test(path)) {
        const user = requireUser(request, response); if (!user) return;
        if (!appConfig.aiBaseUrl || !appConfig.aiApiKey || !appConfig.aiModel) return error(response, 503, 'Add the Berry AI API key and restart the server.');
        const caseRecord = store.reopenOfflinePayout(user.wallet, parts[2]);
        const result = await decideCase({ store, config: appConfig, caseRecord });
        return json(response, 200, { payout: result.payout, decision: result.decision, case: result.case });
      }
      if (method === 'GET' && /^\/api\/payouts\/[^/]+$/.test(path)) {
        const user = requireUser(request, response); if (!user) return;
        const payout = store.payout(parts[2]);
        if (!payout || payout.wallet !== user.wallet) return error(response, 404, 'Payout not found');
        return json(response, 200, { id: payout.id, status: payout.status, amount: Number(payout.amount), wallet: payout.requested_wallet, decision: { by: payout.decision_by, reason: payout.reason, at: payout.updated_at }, tx: payout.tx_ref, evidence: store.payoutEvidence(payout.id) });
      }
      if (method === 'POST' && /^\/api\/payouts\/[^/]+\/confirm$/.test(path)) {
        const user = requireUser(request, response); if (!user) return;
        const payout = await store.confirmPayout(user.wallet, parts[2], (args) => pay({ rail: appConfig.rail, signer: appConfig.signer, config: appConfig, ...args }));
        return json(response, 200, { payout });
      }
      if (method === 'POST' && path === '/api/appeals') {
        const user = requireUser(request, response); if (!user) return;
        const input = await body(request);
        store.ledger({ type: 'appeal', label: 'Trader appeal', detail: String(input.message || 'Review requested').slice(0, 300), amount: 0, metadata: { wallet: user.wallet } });
        return json(response, 201, { status: 'received' });
      }
      if (method === 'POST' && path === '/api/ask') {
        const user = requireUser(request, response); if (!user) return;
        const input = await body(request), account = store.activeChallenge(user.wallet);
        const summary = account ? `Your ${account.status} $${Number(account.size).toLocaleString()} account has a server-recorded balance of $${Number(account.balance).toFixed(2)}.` : 'You do not currently have an active Berry Firm account.';
        return json(response, 200, { answer: `${summary} Berry Firm uses a controlled evaluation market and policy-governed treasury settlement.`, quotedQuestion: String(input.question || '').slice(0, 500) });
      }
      if (method === 'POST' && path === '/api/demo/seed') {
        const user = requireUser(request, response); if (!user) return;
        if (!['mock', 'testnet'].includes(appConfig.rail) || appConfig.authMode !== 'demo') return error(response, 403, 'Demo seed is available only for a configured local or testnet demo session');
        return json(response, 200, { challenge: store.seedDemo(user.wallet) });
      }
      if (method === 'POST' && path === '/api/demo/run') {
        const user = requireUser(request, response); if (!user) return;
        if (!['mock', 'testnet'].includes(appConfig.rail) || appConfig.authMode !== 'demo' || user.wallet !== appConfig.demoWallet) return error(response, 403, 'Payout demo is available only to the configured demo account.');
        const challenge = store.seedDemo(user.wallet);
        if (challenge.status !== 'funded') return error(response, 409, 'Reset your current demo run before starting the payout demo.');
        const existing = store.latestPayoutForChallenge(challenge.id);
        if (existing && ['approved', 'sending', 'paid'].includes(existing.status)) {
          const record = store.latestCaseForPayout(existing.id);
          return json(response, 200, { payout: existing, decision: record ? store.caseView(record).decision : null, case: record ? store.caseView(record) : null, resumed: true });
        }
        if (existing?.status === 'requested') {
          const record = store.latestCaseForPayout(existing.id);
          if (record?.status === 'open') {
            const result = await decideCase({ store, config: appConfig, caseRecord: record });
            return json(response, 200, { ...result, resumed: true });
          }
          return json(response, 200, { payout: existing, decision: record ? store.caseView(record).decision : null, case: record ? store.caseView(record) : null, resumed: true });
        }
        const created = store.createPayout(user.wallet, challenge.id, user.wallet);
        return json(response, 201, await decideCase({ store, config: appConfig, caseRecord: created.case }));
      }
      if (method === 'POST' && path === '/api/demo/reset') {
        const user = requireUser(request, response); if (!user) return;
        if (!['mock', 'testnet'].includes(appConfig.rail) || appConfig.authMode !== 'demo' || user.wallet !== appConfig.demoWallet) return error(response, 403, 'Demo reset is available only to the configured demo account.');
        return json(response, 200, { challenge: store.resetDemo(user.wallet) });
      }

      if (path.startsWith('/api/ops/')) {
        const user = requireOwner(request, response); if (!user) return;
        if (method === 'GET' && path === '/api/ops/business') return json(response, 200, store.business(url.searchParams.get('per') || 'all'));
        if (method === 'GET' && /^\/api\/ops\/business\/(sales|payouts|costs|ai|treasury)$/.test(path)) return json(response, 200, store.business('all'));
        if (method === 'GET' && path === '/api/ops/cases') return json(response, 200, store.cases());
        if (method === 'GET' && /^\/api\/ops\/cases\/[^/]+$/.test(path)) { const record = store.case(parts[3]); return record ? json(response, 200, store.caseView(record)) : error(response, 404, 'Case not found'); }
        if (method === 'POST' && /^\/api\/ops\/cases\/[^/]+\/resolve$/.test(path)) { const input = await body(request); return json(response, 200, store.resolveCase(user, parts[3], input.action, input.reason)); }
        if (method === 'GET' && path === '/api/ops/accounts') return json(response, 200, store.accounts(url.searchParams.get('filter')));
        if (method === 'GET' && path === '/api/ops/rules') return json(response, 200, store.settings());
        if (method === 'PATCH' && path === '/api/ops/rules') return json(response, 200, store.updateSettings(await body(request)));
      }
      return error(response, 404, 'API route not found');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unexpected server error';
      const status = /not found|not awaiting|already|invalid|cannot|requires|paused|exceeds|insufficient/i.test(message) ? 409 : 500;
      return error(response, status, message);
    }
  });
  return { server, store };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createBerryServer();
  server.listen(config.port, () => console.log(`Berry Firm listening at http://localhost:${config.port} (RAIL=${config.rail})`));
}
