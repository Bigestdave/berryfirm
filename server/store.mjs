import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { challengeRules, classifyChallenge, payoutAmount, priceAt, pricesAt } from './rules.mjs';

const now = () => new Date().toISOString();
const day = () => now().slice(0, 10);
const json = (value) => JSON.stringify(value);
const parse = (value, fallback = {}) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const round = (value) => Number(Number(value).toFixed(6));
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '')}`;

export class BerryStore {
  constructor({ dbPath, config }) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.config = config;
    this.migrate();
    this.ensureSettings();
  }

  migrate() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (wallet TEXT PRIMARY KEY, role TEXT NOT NULL DEFAULT 'trader', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, wallet TEXT NOT NULL REFERENCES users(wallet), expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, wallet TEXT NOT NULL, message TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
      CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY, wallet TEXT NOT NULL REFERENCES users(wallet), size REAL NOT NULL, fee REAL NOT NULL,
        status TEXT NOT NULL, balance REAL NOT NULL, realised_loss REAL NOT NULL DEFAULT 0, trading_days INTEGER NOT NULL DEFAULT 0,
        rules_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES challenges(id), market TEXT NOT NULL, side TEXT NOT NULL,
        size REAL NOT NULL, entry_price REAL NOT NULL, stop_loss REAL, take_profit REAL, status TEXT NOT NULL,
        close_price REAL, pnl REAL, opened_at TEXT NOT NULL, closed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS payouts (
        id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES challenges(id), wallet TEXT NOT NULL, amount REAL NOT NULL,
        requested_wallet TEXT NOT NULL, status TEXT NOT NULL, decision_by TEXT, reason TEXT, tx_ref TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, payout_id TEXT REFERENCES payouts(id), wallet TEXT NOT NULL,
        status TEXT NOT NULL, payload_json TEXT NOT NULL, decision_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS challenge_payments (
        id TEXT PRIMARY KEY, wallet TEXT NOT NULL REFERENCES users(wallet), size REAL NOT NULL, fee REAL NOT NULL,
        refund_to TEXT NOT NULL, deposit_address TEXT NOT NULL UNIQUE, deposit_memo TEXT, status TEXT NOT NULL,
        provider_status TEXT, quote_json TEXT NOT NULL, provider_json TEXT, challenge_id TEXT REFERENCES challenges(id),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL, detail TEXT NOT NULL, amount REAL NOT NULL,
        ref TEXT, metadata_json TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
  }

  ensureSettings() {
    const nearPayments = Boolean(this.config.nearIntentsEnabled && /^[a-z0-9._-]{2,64}\.near$/i.test(this.config.nearIntentsReceiver || ''));
    const freeDemoMode = ['mock', 'testnet'].includes(this.config.rail) && this.config.authMode === 'demo' && !nearPayments;
    const freeChallengeFees = { 5000: 0, 10000: 0, 25000: 0, 50000: 0 };
    const commercialChallengeFees = { 5000: 59, 10000: 89, 25000: 199, 50000: 349 };
    const row = this.db.prepare('SELECT json FROM settings WHERE id = 1').get();
    if (row) {
      const current = parse(row.json);
      if (freeDemoMode && JSON.stringify(current.challengeFees) !== JSON.stringify(freeChallengeFees)) {
        current.challengeFees = freeChallengeFees;
        this.db.prepare('UPDATE settings SET json = ?, updated_at = ? WHERE id = 1').run(json(current), now());
        // Older mock/testnet access rows were not collected revenue.
        this.db.prepare(`UPDATE challenges SET fee=0 WHERE id IN (
          SELECT json_extract(metadata_json,'$.challengeId') FROM ledger
          WHERE type='sale' AND detail IN ('Testnet evaluation access','Demo sale · no payment collected')
        )`).run();
        this.db.prepare(`UPDATE ledger SET type='demo', label='Free test account', detail='No payment collected', amount=0, ref=NULL
          WHERE type='sale' AND detail IN ('Testnet evaluation access','Demo sale · no payment collected')`).run();
      } else if (nearPayments && Object.values(current.challengeFees || {}).every((value) => Number(value) === 0)) {
        current.challengeFees = commercialChallengeFees;
        this.db.prepare('UPDATE settings SET json = ?, updated_at = ? WHERE id = 1').run(json(current), now());
      }
      return;
    }
    const settings = {
      paused: false,
      payoutCap: this.config.dailyPayoutCap,
      aiCap: this.config.dailyAiCap,
      accountPayoutCap: 1000,
      revenueShare: 0.9,
      challengeFees: freeDemoMode ? freeChallengeFees : commercialChallengeFees,
      sizes: { 5000: true, 10000: true, 25000: true, 50000: true },
      markets: Object.fromEntries(Object.keys(pricesAt()).map((market) => [market, true])),
      treasurySeed: 10
    };
    this.db.prepare('INSERT INTO settings (id, json, updated_at) VALUES (1, ?, ?)').run(json(settings), now());
  }

  settings() { return parse(this.db.prepare('SELECT json FROM settings WHERE id = 1').get().json); }
  updateSettings(patch) {
    const allowed = ['paused', 'payoutCap', 'aiCap', 'accountPayoutCap', 'revenueShare', 'challengeFees', 'sizes', 'markets'];
    const current = this.settings();
    for (const [key, value] of Object.entries(patch || {})) if (allowed.includes(key)) current[key] = value;
    if (current.payoutCap < 0 || current.aiCap < 0 || current.accountPayoutCap < 0 || current.revenueShare < 0 || current.revenueShare > 1) throw new Error('Invalid rules settings');
    this.db.prepare('UPDATE settings SET json = ?, updated_at = ? WHERE id = 1').run(json(current), now());
    return current;
  }

  ensureUser(wallet) {
    if (!/^[a-zA-Z0-9._-]{2,64}$/.test(wallet || '')) throw new Error('Enter a valid NEAR account name');
    const role = wallet === this.config.ownerAccount ? 'owner' : 'trader';
    this.db.prepare('INSERT OR IGNORE INTO users (wallet, role, created_at) VALUES (?, ?, ?)').run(wallet, role, now());
    return this.db.prepare('SELECT wallet, role FROM users WHERE wallet = ?').get(wallet);
  }

  createSession(wallet) {
    this.ensureUser(wallet);
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.db.prepare('INSERT INTO sessions (token, wallet, expires_at, created_at) VALUES (?, ?, ?, ?)').run(token, wallet, expires, now());
    return token;
  }

  session(token) {
    if (!token) return null;
    return this.db.prepare(`SELECT u.wallet, u.role FROM sessions s JOIN users u ON u.wallet=s.wallet WHERE s.token=? AND s.expires_at > ?`).get(token, now()) || null;
  }

  createAuthChallenge(wallet) {
    this.ensureUser(wallet);
    const challenge = id('auth');
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const message = `Sign in to Berry Firm\nAccount: ${wallet}\nNonce: ${challenge}\nExpires: ${expires}`;
    this.db.prepare('INSERT INTO auth_challenges (id, wallet, message, expires_at) VALUES (?, ?, ?, ?)').run(challenge, wallet, message, expires);
    return { id: challenge, message, expiresAt: expires };
  }

  ledger({ type, label, detail, amount, ref = null, metadata = {} }) {
    const record = { id: id('evt'), type, label, detail, amount: round(amount), ref, metadata, at: now() };
    this.db.prepare('INSERT INTO ledger (id,type,label,detail,amount,ref,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(record.id, record.type, record.label, record.detail, record.amount, record.ref, json(record.metadata), record.at);
    return record;
  }

  activeChallenge(wallet) {
    return this.db.prepare(`SELECT * FROM challenges WHERE wallet=? AND status IN ('active','passed','funded') ORDER BY created_at DESC LIMIT 1`).get(wallet) || null;
  }

  challenge(idValue) { return this.db.prepare('SELECT * FROM challenges WHERE id = ?').get(idValue) || null; }
  ownedChallenge(wallet, idValue) { const record = this.challenge(idValue); if (!record || record.wallet !== wallet) throw new Error('Challenge not found'); return record; }
  openPositions(challengeId) { return this.db.prepare("SELECT * FROM positions WHERE challenge_id=? AND status='open' ORDER BY opened_at").all(challengeId); }
  allPositions(challengeId) { return this.db.prepare('SELECT * FROM positions WHERE challenge_id=? ORDER BY opened_at DESC').all(challengeId); }

  createChallenge(wallet, size, { feeOverride = null, paymentId = null, paymentConfirmed = false } = {}) {
    const settings = this.settings();
    size = Number(size);
    if (this.activeChallenge(wallet)) throw new Error('You already have an active or funded account');
    const pendingPayment = this.db.prepare("SELECT id FROM challenge_payments WHERE wallet=? AND status='pending' ORDER BY created_at DESC LIMIT 1").get(wallet);
    if (pendingPayment && pendingPayment.id !== paymentId) throw new Error('A challenge payment is already in progress');
    const fee = feeOverride == null ? Number(settings.challengeFees[size] || 0) : Number(feeOverride);
    const payment = paymentId ? this.challengePayment(paymentId, wallet) : null;
    const confirmedPayment = fee > 0 && paymentConfirmed && payment?.status === 'pending' && payment.size === size && payment.fee === fee;
    if (!settings.sizes[size] && !confirmedPayment) throw new Error('This challenge size is unavailable');
    if (settings.paused && !confirmedPayment) throw new Error('New challenges are paused');
    if (fee > 0 && !confirmedPayment) throw new Error('A confirmed challenge payment is required before account creation');
    const record = { id: id('ch'), wallet, size, fee, status: 'active', balance: size, rules: challengeRules(size), at: now() };
    this.db.prepare(`INSERT INTO challenges (id,wallet,size,fee,status,balance,realised_loss,trading_days,rules_json,created_at,updated_at) VALUES (?,?,?,?,?,?,0,0,?,?,?)`)
      .run(record.id, wallet, size, fee, record.status, size, json(record.rules), record.at, record.at);
    return this.challenge(record.id);
  }

  createChallengePayment(wallet, size, refundTo, quote) {
    size = Number(size);
    const settings = this.settings();
    if (!settings.sizes[size] || settings.paused) throw new Error('This challenge is unavailable');
    if (this.activeChallenge(wallet)) throw new Error('You already have an active or funded account');
    if (this.db.prepare("SELECT 1 FROM challenge_payments WHERE wallet=? AND status='pending' LIMIT 1").get(wallet)) throw new Error('A challenge payment is already in progress');
    const fee = Number(settings.challengeFees[size] || 0);
    if (fee <= 0) throw new Error('This account does not require payment');
    const paymentId = id('sale');
    const at = now();
    this.db.prepare(`INSERT INTO challenge_payments (id,wallet,size,fee,refund_to,deposit_address,deposit_memo,status,provider_status,quote_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,'pending','PENDING_DEPOSIT',?,?,?)`)
      .run(paymentId, wallet, size, fee, refundTo, quote.depositAddress, quote.depositMemo, json(quote), at, at);
    return this.challengePayment(paymentId);
  }

  challengePayment(paymentId, wallet = null) {
    const row = wallet
      ? this.db.prepare('SELECT * FROM challenge_payments WHERE id=? AND wallet=?').get(paymentId, wallet)
      : this.db.prepare('SELECT * FROM challenge_payments WHERE id=?').get(paymentId);
    if (!row) return null;
    return { ...row, fee: Number(row.fee), size: Number(row.size), quote: parse(row.quote_json), provider: parse(row.provider_json, null) };
  }

  updateChallengePayment(paymentId, wallet, provider) {
    const record = this.challengePayment(paymentId, wallet);
    if (!record) throw new Error('Payment not found');
    if (record.status === 'paid') return record;
    const providerStatus = String(provider?.status || 'UNKNOWN').toUpperCase();
    const status = providerStatus === 'REFUNDED' ? 'refunded' : providerStatus === 'FAILED' ? 'failed' : 'pending';
    this.db.prepare('UPDATE challenge_payments SET status=?,provider_status=?,provider_json=?,updated_at=? WHERE id=?')
      .run(status, providerStatus, json(provider || {}), now(), paymentId);
    return this.challengePayment(paymentId, wallet);
  }

  fulfillChallengePayment(paymentId, wallet, provider) {
    const record = this.challengePayment(paymentId, wallet);
    if (!record) throw new Error('Payment not found');
    if (record.status === 'paid' && record.challenge_id) return { payment: record, challenge: this.challenge(record.challenge_id) };
    if (String(provider?.status || '').toUpperCase() !== 'SUCCESS') throw new Error('Payment is not confirmed by NEAR Intents');
    if (this.activeChallenge(wallet)) throw new Error('An account is already active for this wallet');
    const at = now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const challenge = this.createChallenge(wallet, record.size, { feeOverride: record.fee, paymentId, paymentConfirmed: true });
      const transaction = provider?.swapDetails?.destinationChainTxHashes?.[0]
        || provider?.swapDetails?.originChainTxHashes?.[0]
        || provider?.swapDetails?.nearTxHashes?.[0]
        || provider?.destinationTxHash || provider?.txHash || null;
      const paymentReference = (typeof transaction === 'string' ? transaction : transaction?.hash || transaction?.txHash)
        || provider?.correlationId || paymentId;
      const evidence = {
        paymentId, challengeId: challenge.id, rail: 'near-intents-mainnet', simulated: false,
        providerStatus: 'SUCCESS', depositAddress: record.deposit_address,
        explorerUrl: `https://explorer.near-intents.org/?search=${encodeURIComponent(record.deposit_address)}`,
        txHash: paymentReference === paymentId ? null : paymentReference
      };
      this.ledger({ type: 'sale', label: `$${record.size / 1000}K challenge`, detail: 'Confirmed through NEAR Intents · Mainnet', amount: record.fee, ref: paymentReference, metadata: evidence });
      this.db.prepare("UPDATE challenge_payments SET status='paid',provider_status='SUCCESS',provider_json=?,challenge_id=?,updated_at=? WHERE id=? AND status='pending'")
        .run(json(provider), challenge.id, at, paymentId);
      const payment = this.challengePayment(paymentId, wallet);
      if (!payment || payment.status !== 'paid') throw new Error('Payment was already claimed');
      this.db.exec('COMMIT');
      return { payment, challenge };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  payoutEconomics(payout) {
    const challenge = this.challenge(payout.challenge_id);
    const grossProfit = round(Math.max(0, Number(challenge.balance) - Number(challenge.size)));
    const traderShare = round(Number(payout.amount));
    return { grossProfit, traderShare, treasuryRetained: round(Math.max(0, grossProfit - traderShare)), traderShareRate: grossProfit ? round(traderShare / grossProfit) : 0 };
  }

  equity(challenge, at = Date.now()) {
    const floating = this.openPositions(challenge.id).reduce((total, position) => total + (priceAt(position.market, at) - position.entry_price) * position.size * (position.side === 'Buy' ? 1 : -1), 0);
    return round(challenge.balance + floating);
  }

  createOrder(wallet, challengeId, input) {
    const challenge = this.ownedChallenge(wallet, challengeId);
    const settings = this.settings();
    if (settings.paused) throw new Error('Trading is paused by the owner');
    if (challenge.status !== 'active' && challenge.status !== 'funded') throw new Error('This account cannot trade');
    const { market, side } = input;
    const size = Number(input.size), stopLoss = input.stopLoss == null ? null : Number(input.stopLoss), takeProfit = input.takeProfit == null ? null : Number(input.takeProfit);
    if (!settings.markets[market] || !['Buy', 'Sell'].includes(side) || !Number.isFinite(size) || size <= 0) throw new Error('Invalid order');
    const entryBase = priceAt(market);
    const entry = round(entryBase * (side === 'Buy' ? 1 + challengeRules(challenge.size).slippageRate : 1 - challengeRules(challenge.size).slippageRate));
    const rules = parse(challenge.rules_json);
    const direction = side === 'Buy' ? 1 : -1;
    if (!Number.isFinite(stopLoss) || (direction === 1 && stopLoss >= entry) || (direction === -1 && stopLoss <= entry)) throw new Error('A protective stop loss is required');
    const positions = this.openPositions(challenge.id);
    const exposure = positions.reduce((total, position) => total + position.size * priceAt(position.market), 0) + size * entry;
    if (exposure > this.equity(challenge) * rules.maxExposureMultiple) throw new Error('Order exceeds the 2× exposure limit');
    const stopRisk = Math.max(0, (entry - stopLoss) * size * direction);
    const usedLoss = Math.max(0, -challenge.realised_loss);
    if (usedLoss + stopRisk > rules.dailyLoss) throw new Error('Stop loss exceeds the daily loss limit');
    const fee = round(size * entry * rules.feeRate);
    const position = { id: id('pos'), challengeId: challenge.id, market, side, size, entry, stopLoss, takeProfit, at: now() };
    this.db.prepare(`INSERT INTO positions (id,challenge_id,market,side,size,entry_price,stop_loss,take_profit,status,opened_at) VALUES (?,?,?,?,?,?,?,?, 'open', ?)`)
      .run(position.id, position.challengeId, market, side, size, entry, stopLoss, takeProfit, position.at);
    this.db.prepare('UPDATE challenges SET balance=balance-?, trading_days=MAX(trading_days,1), updated_at=? WHERE id=?').run(fee, position.at, challenge.id);
    return { position: this.db.prepare('SELECT * FROM positions WHERE id=?').get(position.id), fee, price: entry };
  }

  updatePosition(wallet, positionId, stopLoss) {
    const position = this.db.prepare(`SELECT p.*, c.wallet, c.size AS account_size, c.realised_loss, c.rules_json FROM positions p JOIN challenges c ON c.id=p.challenge_id WHERE p.id=? AND p.status='open'`).get(positionId);
    if (!position || position.wallet !== wallet) throw new Error('Open position not found');
    stopLoss = Number(stopLoss);
    const dir = position.side === 'Buy' ? 1 : -1;
    if (!Number.isFinite(stopLoss) || (dir === 1 && stopLoss >= position.entry_price) || (dir === -1 && stopLoss <= position.entry_price)) throw new Error('Invalid stop loss');
    const loss = Math.max(0, (position.entry_price - stopLoss) * position.size * dir);
    if (Math.max(0, -position.realised_loss) + loss > parse(position.rules_json).dailyLoss) throw new Error('Stop loss exceeds the daily loss limit');
    this.db.prepare('UPDATE positions SET stop_loss=? WHERE id=?').run(stopLoss, positionId);
    return this.db.prepare('SELECT * FROM positions WHERE id=?').get(positionId);
  }

  closePosition(wallet, positionId, fraction = 1) {
    const position = this.db.prepare(`SELECT p.*, c.wallet, c.id AS challenge_ref, c.size AS account_size, c.balance, c.realised_loss, c.trading_days, c.rules_json FROM positions p JOIN challenges c ON c.id=p.challenge_id WHERE p.id=? AND p.status='open'`).get(positionId);
    if (!position || position.wallet !== wallet) throw new Error('Open position not found');
    fraction = Number(fraction);
    if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) throw new Error('Invalid close amount');
    const size = round(position.size * fraction);
    const rules = parse(position.rules_json);
    const marketPrice = priceAt(position.market);
    const closePrice = round(marketPrice * (position.side === 'Buy' ? 1 - rules.slippageRate : 1 + rules.slippageRate));
    const direction = position.side === 'Buy' ? 1 : -1;
    const gross = (closePrice - position.entry_price) * size * direction;
    const fee = size * closePrice * rules.feeRate;
    const pnl = round(gross - fee);
    const updatedBalance = round(position.balance + pnl);
    const updatedLoss = round(position.realised_loss + pnl);
    const at = now();
    if (fraction >= 0.999999 || size >= position.size) {
      this.db.prepare("UPDATE positions SET status='closed', close_price=?, pnl=?, closed_at=? WHERE id=?").run(closePrice, pnl, at, positionId);
    } else {
      this.db.prepare('UPDATE positions SET size=? WHERE id=?').run(round(position.size - size), positionId);
      this.db.prepare(`INSERT INTO positions (id,challenge_id,market,side,size,entry_price,stop_loss,take_profit,status,close_price,pnl,opened_at,closed_at) VALUES (?,?,?,?,?,?,?,?, 'closed',?,?,?,?)`)
        .run(id('pos'), position.challenge_id, position.market, position.side, size, position.entry_price, position.stop_loss, position.take_profit, closePrice, pnl, position.opened_at, at);
    }
    this.db.prepare('UPDATE challenges SET balance=?, realised_loss=?, updated_at=? WHERE id=?').run(updatedBalance, updatedLoss, at, position.challenge_id);
    const challenge = this.challenge(position.challenge_id);
    const status = classifyChallenge({ balance: challenge.balance, startingBalance: challenge.size, dailyLoss: rules.dailyLoss, realisedLoss: challenge.realised_loss, tradingDays: challenge.trading_days, openPositions: this.openPositions(challenge.id).length });
    if (status !== 'active') this.db.prepare('UPDATE challenges SET status=?, updated_at=? WHERE id=?').run(status, at, challenge.id);
    return { position: this.db.prepare('SELECT * FROM positions WHERE id=?').get(positionId), pnl, price: closePrice, challenge: this.challenge(position.challenge_id) };
  }

  fundChallenge(wallet, challengeId) {
    const challenge = this.ownedChallenge(wallet, challengeId);
    if (challenge.status !== 'passed') throw new Error('Only a passed challenge can become funded');
    const at = now();
    this.db.prepare("UPDATE challenges SET status='funded', balance=?, realised_loss=0, trading_days=0, updated_at=? WHERE id=?").run(challenge.size, at, challenge.id);
    return this.challenge(challenge.id);
  }

  dailyPaid() { return Number(this.db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payouts WHERE status='paid' AND substr(updated_at,1,10)=?").get(day()).total); }
  dailyAiCost() { return Math.abs(Number(this.db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE type='cost' AND detail='AI inference' AND substr(created_at,1,10)=?").get(day()).total)); }
  pool() {
    const settings = this.settings();
    const sales = Number(this.db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE type='sale'").get().total);
    const paid = Math.abs(Number(this.db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE type='payout'").get().total));
    const reserved = Number(this.db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payouts WHERE status='approved'").get().total);
    const sending = Number(this.db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payouts WHERE status='sending'").get().total);
    const total = round(settings.treasurySeed + sales - paid);
    const rows = this.db.prepare("SELECT wallet,amount,tx_ref,updated_at FROM payouts WHERE status='paid' ORDER BY updated_at DESC LIMIT 20").all();
    return { inp: total, res: reserved, snd: sending, paid: rows.map((row) => [row.wallet.slice(-4), row.amount, row.tx_ref || '', row.updated_at]) };
  }

  buildPayoutCase(payout) {
    const challenge = this.challenge(payout.challenge_id);
    const settings = this.settings();
    const grossProfit = round(Math.max(0, Number(challenge.balance) - Number(challenge.size)));
    return {
      payoutId: payout.id, wallet: payout.wallet, requestedWallet: payout.requested_wallet, amount: payout.amount,
      challenge: { id: challenge.id, status: challenge.status, size: challenge.size, balance: challenge.balance, openPositions: this.openPositions(challenge.id).length },
      economics: this.payoutEconomics(payout),
      caps: { paidToday: this.dailyPaid(), payoutCap: settings.payoutCap, aiSpendToday: this.dailyAiCost(), aiCap: settings.aiCap },
      requestedAt: payout.created_at
    };
  }

  createPayout(wallet, challengeId, requestedWallet = wallet) {
    const challenge = this.ownedChallenge(wallet, challengeId);
    const settings = this.settings();
    if (settings.paused) throw new Error('Payouts are paused');
    if (challenge.status !== 'funded') throw new Error('A funded account is required');
    if (this.openPositions(challenge.id).length) throw new Error('Close all positions before requesting a payout');
    if (this.db.prepare("SELECT 1 FROM payouts WHERE challenge_id=? AND status NOT IN ('rejected','escalated')").get(challenge.id)) throw new Error('This funded account already has a payout request');
    const amount = payoutAmount({ balance: challenge.balance, startingBalance: challenge.size, share: settings.revenueShare, accountCap: settings.accountPayoutCap });
    if (amount <= 0) throw new Error('This account has no eligible profit');
    const payout = { id: id('po'), challengeId: challenge.id, wallet, amount, requestedWallet, at: now() };
    this.db.prepare(`INSERT INTO payouts (id,challenge_id,wallet,amount,requested_wallet,status,created_at,updated_at) VALUES (?,?,?,?,?,'requested',?,?)`)
      .run(payout.id, payout.challengeId, wallet, amount, requestedWallet, payout.at, payout.at);
    const caseRecord = { id: id('case'), kind: 'payout', payoutId: payout.id, wallet, status: 'open', at: now() };
    this.db.prepare('INSERT INTO cases (id,kind,payout_id,wallet,status,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(caseRecord.id, caseRecord.kind, caseRecord.payoutId, caseRecord.wallet, caseRecord.status, json(this.buildPayoutCase({ ...payout, challenge_id: payout.challengeId, created_at: payout.at })), caseRecord.at, caseRecord.at);
    return { payout: this.payout(payout.id), case: this.case(caseRecord.id) };
  }

  payout(payoutId) { return this.db.prepare('SELECT * FROM payouts WHERE id=?').get(payoutId) || null; }
  case(caseId) { return this.db.prepare('SELECT * FROM cases WHERE id=?').get(caseId) || null; }

  policyCheck(payout) {
    const settings = this.settings();
    const challenge = this.challenge(payout.challenge_id);
    if (settings.paused) return 'The owner kill switch is on';
    if (payout.status !== 'requested' && payout.status !== 'approved') return 'Payout is not awaiting settlement';
    if (payout.requested_wallet !== payout.wallet) return 'The wallet changed after the request';
    const maximum = payoutAmount({ balance: challenge.balance, startingBalance: challenge.size, share: settings.revenueShare, accountCap: settings.accountPayoutCap });
    if (payout.amount <= 0 || payout.amount > maximum) return 'Payout amount exceeds the account cap';
    if (this.dailyPaid() + payout.amount > settings.payoutCap) return 'Daily payout cap would be exceeded';
    if (this.pool().inp - this.pool().res - this.pool().snd < payout.amount) return 'Treasury balance is insufficient';
    return null;
  }

  settleDecision(caseId, decision, { by = 'agent', cost = 0, usage = null } = {}) {
    const caseRecord = this.case(caseId);
    if (!caseRecord || caseRecord.status !== 'open') throw new Error('Case is not open');
    const payout = this.payout(caseRecord.payout_id);
    const valid = ['approve_payout', 'reject_payout', 'escalate'];
    if (!valid.includes(decision.name) || !String(decision.reason || '').trim()) throw new Error('Invalid agent decision');
    const policyProblem = this.policyCheck(payout);
    let status, payoutStatus, reason = String(decision.reason).trim().slice(0, 500);
    if (decision.name === 'approve_payout') {
      if (policyProblem) { status = 'escalated'; payoutStatus = 'escalated'; reason = `Policy gate: ${policyProblem}`; }
      else { status = 'approved'; payoutStatus = 'approved'; }
    } else if (decision.name === 'reject_payout') { status = 'rejected'; payoutStatus = 'rejected'; }
    else { status = 'escalated'; payoutStatus = 'escalated'; }
    const at = now();
    const economics = this.payoutEconomics(payout);
    const settled = { tool: decision.name, reason, by, at, cost: round(cost), policyResult: policyProblem ? 'blocked' : 'passed', policyReason: policyProblem, economics, ...(usage ? { usage } : {}) };
    this.db.prepare('UPDATE cases SET status=?, decision_json=?, updated_at=? WHERE id=?').run(status, json(settled), at, caseId);
    this.db.prepare('UPDATE payouts SET status=?, decision_by=?, reason=?, updated_at=? WHERE id=?').run(payoutStatus, by, reason, at, payout.id);
    if (cost > 0) this.ledger({ type: 'cost', label: 'AI decision', detail: 'AI inference', amount: -Math.abs(cost), ref: caseId, metadata: { caseId, model: by, costUsd: round(cost), billingBasis: usage?.estimated ? 'conservative token limit estimate' : 'provider token usage × published model rates', inputRateUsdPerMillion: this.config.aiInputCostPerMillion, cacheReadRateUsdPerMillion: this.config.aiCacheReadCostPerMillion, outputRateUsdPerMillion: this.config.aiOutputCostPerMillion, ...(usage || {}) } });
    this.ledger({ type: 'decision', label: `Payout ${status}`, detail: reason, amount: 0, ref: payout.id, metadata: { caseId, tool: decision.name, by, policyResult: settled.policyResult, economics } });
    return { case: this.case(caseId), payout: this.payout(payout.id), decision: settled };
  }

  reopenOfflinePayout(wallet, payoutId) {
    const payout = this.payout(payoutId);
    if (!payout || payout.wallet !== wallet) throw new Error('Payout not found');
    if (!['approved', 'escalated'].includes(payout.status) || payout.tx_ref) throw new Error('Only an unsettled payout can be reviewed again');
    const record = this.db.prepare('SELECT * FROM cases WHERE payout_id=? ORDER BY created_at DESC LIMIT 1').get(payoutId);
    const decision = parse(record?.decision_json, null);
    const retryable = record?.status === 'approved' && decision?.by === 'offline-policy'
      || record?.status === 'escalated' && decision?.by === 'agent-error';
    if (!record || !retryable) throw new Error('This payout review cannot be rerun');
    const at = now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare("UPDATE cases SET status='open', decision_json=NULL, updated_at=? WHERE id=?").run(at, record.id);
      this.db.prepare("UPDATE payouts SET status='requested', decision_by=NULL, reason=NULL, updated_at=? WHERE id=?").run(at, payoutId);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.case(record.id);
  }

  confirmPayout(wallet, payoutId, pay) {
    const payout = this.payout(payoutId);
    if (!payout || payout.wallet !== wallet) throw new Error('Payout not found');
    if (payout.status !== 'approved') throw new Error('This payout is not approved');
    const policyError = this.policyCheck(payout);
    if (policyError) throw new Error(`Policy gate: ${policyError}`);
    const at = now();
    this.db.prepare("UPDATE payouts SET status='sending', updated_at=? WHERE id=?").run(at, payoutId);
    return Promise.resolve(pay({ to: payout.requested_wallet, amount: payout.amount, reference: payout.id })).then((result) => {
      if (result.status !== 'paid') throw new Error('Payout rail did not complete');
      const settledAt = now();
      this.db.prepare("UPDATE payouts SET status='paid', tx_ref=?, updated_at=? WHERE id=?").run(result.reference, settledAt, payoutId);
      this.ledger({ type: 'payout', label: 'Trader settlement', detail: result.simulated ? 'Demo treasury settlement' : `USDC settlement on NEAR ${result.network || ''}`.trim(), amount: -payout.amount, ref: result.reference, metadata: { payoutId, wallet: payout.requested_wallet, rail: result.network || this.config.rail, simulated: Boolean(result.simulated), ...this.payoutEconomics(payout), balanceBefore: result.balanceBefore ?? null, balanceAfter: result.balanceAfter ?? null, balanceDelta: result.balanceBefore != null && result.balanceAfter != null ? round(result.balanceAfter - result.balanceBefore) : null, asset: 'USDC', explorerUrl: result.network === 'testnet' && !result.simulated ? `https://testnet.nearblocks.io/txns/${encodeURIComponent(result.reference)}` : null } });
      return this.payout(payoutId);
    }).catch((error) => {
      this.db.prepare("UPDATE payouts SET status='approved', updated_at=? WHERE id=?").run(now(), payoutId);
      throw error;
    });
  }

  resolveCase(owner, caseId, action, reason) {
    if (owner.role !== 'owner') throw new Error('Owner access required');
    if (action === 'approve') return this.settleDecision(caseId, { name: 'approve_payout', reason: reason || 'Approved by owner' }, { by: 'owner' });
    if (action === 'reject') return this.settleDecision(caseId, { name: 'reject_payout', reason: reason || 'Rejected by owner' }, { by: 'owner' });
    return this.settleDecision(caseId, { name: 'escalate', reason: reason || 'Needs owner review' }, { by: 'owner' });
  }

  business(period = 'all') {
    const since = period === 'today' ? `${day()}T00:00:00.000Z` : period === '7d' ? new Date(Date.now() - 7 * 864e5).toISOString() : '1970-01-01T00:00:00.000Z';
    const sum = (type) => Number(this.db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE type=? AND created_at>=?').get(type, since).total);
    const salesByLabel = this.db.prepare('SELECT label, COUNT(*) AS total FROM ledger WHERE type = ? AND created_at >= ? GROUP BY label').all('sale', since);
    const sold = salesByLabel.reduce((total, row) => total + Number(row.total), 0);
    const bySize = Object.fromEntries(salesByLabel.flatMap((row) => {
      const match = String(row.label).match(/^\$(\d+)K challenge$/);
      return match ? [[Number(match[1]) * 1000, Number(row.total)]] : [];
    }));
    const statuses = Object.fromEntries(this.db.prepare('SELECT status, COUNT(*) AS total FROM challenges WHERE created_at>=? GROUP BY status').all(since).map((row) => [row.status, Number(row.total)]));
    const sales = sum('sale'), payouts = Math.abs(sum('payout'));
    const ai = Math.abs(Number(this.db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE type='cost' AND detail='AI inference' AND created_at>=?").get(since).total));
    const costs = Math.abs(sum('cost'));
    const decisions = Number(this.db.prepare('SELECT COUNT(*) AS total FROM cases WHERE updated_at>=? AND status != ?').get(since, 'open').total);
    const net = round(sales - payouts - costs);
    const rows = this.db.prepare("SELECT substr(created_at,1,10) AS day, SUM(amount) AS amount FROM ledger WHERE created_at>=? AND type IN ('sale','payout','cost') GROUP BY day ORDER BY day").all(since);
    let running = 0;
    const series = rows.map((row) => (running = round(running + Number(row.amount))));
    return { per: period, sold, bySize, statuses, sales, payouts: { amount: payouts, count: Number(this.db.prepare("SELECT COUNT(*) AS total FROM payouts WHERE status='paid' AND updated_at>=?").get(since).total) }, ai, hosting: 0, costs, decisions, net, series: series.length ? series : [0] };
  }

  ledgerPage(before) {
    const rows = before ? this.db.prepare('SELECT * FROM ledger WHERE id < ? ORDER BY created_at DESC LIMIT 50').all(before) : this.db.prepare('SELECT * FROM ledger ORDER BY created_at DESC LIMIT 50').all();
    return rows.map((row) => ({ id: row.id, type: row.type, label: row.label, detail: row.detail, amount: Number(row.amount), ref: row.ref, at: row.created_at, metadata: parse(row.metadata_json) }));
  }

  payoutEvidence(payoutId) {
    const payout = this.payout(payoutId);
    if (!payout) return null;
    const caseRow = this.db.prepare('SELECT * FROM cases WHERE payout_id=? ORDER BY created_at DESC LIMIT 1').get(payoutId);
    const decision = parse(caseRow?.decision_json, null);
    const settlementRow = payout.tx_ref ? this.db.prepare("SELECT * FROM ledger WHERE type='payout' AND ref=? ORDER BY created_at DESC LIMIT 1").get(payout.tx_ref) : null;
    const settlement = settlementRow ? parse(settlementRow.metadata_json) : {};
    return {
      decision: decision ? { tool: decision.tool, by: decision.by, reason: decision.reason, at: decision.at, cost: Number(decision.cost || 0), policyResult: decision.policyResult, policyReason: decision.policyReason || null, usage: decision.usage || null } : null,
      economics: decision?.economics || this.payoutEconomics(payout),
      settlement: payout.status === 'paid' ? { status: payout.status, amount: Number(payout.amount), asset: settlement.asset || 'USDC', network: settlement.rail, balanceBefore: settlement.balanceBefore, balanceAfter: settlement.balanceAfter, balanceDelta: settlement.balanceDelta, txHash: payout.tx_ref, explorerUrl: settlement.explorerUrl || null, simulated: Boolean(settlement.simulated) } : { status: payout.status, amount: Number(payout.amount), txHash: payout.tx_ref || null },
      policy: { payoutCap: this.settings().payoutCap, dailyPaid: this.dailyPaid(), aiCap: this.settings().aiCap, aiSpend: this.dailyAiCost() }
    };
  }

  cases() { return this.db.prepare("SELECT * FROM cases WHERE status IN ('open','escalated') ORDER BY updated_at DESC").all().map((row) => this.caseView(row)); }
  caseView(row) { return { id: row.id, type: row.kind, wallet: row.wallet, status: row.status, payload: parse(row.payload_json), decision: parse(row.decision_json, null), createdAt: row.created_at, updatedAt: row.updated_at }; }
  accounts(filter) {
    let sql = 'SELECT id,wallet,size,status,balance,updated_at FROM challenges';
    const args = [];
    if (filter && filter !== 'All') { sql += ' WHERE status=?'; args.push(filter.toLowerCase()); }
    sql += ' ORDER BY updated_at DESC LIMIT 100';
    return this.db.prepare(sql).all(...args).map((row) => ({ ...row, balance: Number(row.balance) }));
  }

  me(wallet) {
    const user = this.ensureUser(wallet);
    const challenge = this.activeChallenge(wallet);
    const pendingPayment = this.db.prepare("SELECT id FROM challenge_payments WHERE wallet=? AND status='pending' ORDER BY created_at DESC LIMIT 1").get(wallet);
    const payment = pendingPayment ? this.challengePayment(pendingPayment.id, wallet) : null;
    const pendingChallengePayment = payment ? {
      id: payment.id, size: payment.size, fee: payment.fee, status: payment.status,
      providerStatus: payment.provider_status, refundTo: payment.refund_to,
      depositAddress: payment.quote.depositAddress, depositMemo: payment.quote.depositMemo,
      amountIn: payment.quote.amountIn, amountInFormatted: payment.quote.amountInFormatted,
      originAsset: payment.quote.originAsset, amountOut: payment.quote.amountOut,
      deadline: payment.quote.deadline, explorerUrl: payment.quote.explorerUrl,
      paymentNetwork: 'NEAR Intents mainnet',
      evaluationNetwork: this.config.rail === 'testnet' ? 'NEAR testnet' : this.config.rail === 'mainnet' ? 'NEAR mainnet' : 'Demo treasury'
    } : null;
    const payout = challenge ? this.db.prepare('SELECT * FROM payouts WHERE challenge_id=? ORDER BY created_at DESC LIMIT 1').get(challenge.id) : null;
    const details = challenge ? { ...challenge, rules: parse(challenge.rules_json), positions: this.openPositions(challenge.id), orders: this.allPositions(challenge.id) } : null;
    return { user, challenge: details, pendingChallengePayment, payout: payout ? { ...payout, amount: Number(payout.amount), evidence: this.payoutEvidence(payout.id) } : null, pool: this.pool(), treasury: this.config.treasuryAccount, settings: this.settings(), prices: pricesAt(), now: now() };
  }

  seedDemo(wallet) {
    this.ensureUser(wallet);
    const existing = this.activeChallenge(wallet);
    if (existing) return existing;
    const record = this.createChallenge(wallet, 5000, { feeOverride: 0 });
    // The commercial terms remain independent of the testnet demo. This
    // deliberately creates a $0.80 qualifying settlement so a $1 test-USDC
    // treasury can prove the complete rail without exceeding its balance.
    this.db.prepare("UPDATE challenges SET status='funded', balance=?, trading_days=3, updated_at=? WHERE id=?").run(5000.89, now(), record.id);
    return this.challenge(record.id);
  }

  resetDemo(wallet) {
    this.ensureUser(wallet);
    if (this.db.prepare("SELECT 1 FROM challenge_payments WHERE wallet=? AND status='pending' LIMIT 1").get(wallet)) throw new Error('Check the pending NEAR Intents payment before resetting the demo');
    const existing = this.activeChallenge(wallet);
    if (existing) {
      const pending = this.db.prepare("SELECT 1 FROM payouts WHERE challenge_id=? AND status IN ('requested','approved','sending') LIMIT 1").get(existing.id);
      if (pending) throw new Error('Settle or close the pending payout before resetting the demo');
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.prepare("UPDATE positions SET status='cancelled',closed_at=? WHERE challenge_id=? AND status='open'").run(now(), existing.id);
        this.db.prepare("UPDATE challenges SET status='archived',updated_at=? WHERE id=?").run(now(), existing.id);
        this.ledger({ type: 'demo', label: 'Demo reset', detail: 'Previous run archived; its ledger evidence is preserved', amount: 0, ref: existing.id, metadata: { wallet, challengeId: existing.id } });
        this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    }
    return null;
  }

  close() { this.db.close(); }
}
