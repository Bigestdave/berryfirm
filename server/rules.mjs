/** Deterministic market and challenge rules. The server is authoritative. */
export const MARKET_BASES = Object.freeze({
  BTC: 59200, ETH: 2480.5, SOL: 142.3, XRP: 0.524, EUR: 1.084,
  GBP: 1.291, AUD: 0.662, XAU: 2680.4, XAG: 31.25, SPX: 5830.2,
  NDX: 20410.5, WTI: 71.4
});

const MARKET_SEEDS = Object.freeze(Object.fromEntries(Object.keys(MARKET_BASES).map((key, index) => [key, 19 + index * 17])));
const round = (value, decimals = 6) => Number(value.toFixed(decimals));

// A pure, repeatable price function. Each 15-second candle is stable for both order validation and replay.
export function priceAt(market, timestamp = Date.now()) {
  const base = MARKET_BASES[market];
  if (!base) throw new Error(`Unsupported market: ${market}`);
  const bucket = Math.floor(timestamp / 15_000);
  const seed = MARKET_SEEDS[market];
  const wave = Math.sin((bucket + seed) * 0.31) * 0.004 + Math.sin((bucket + seed) * 0.071) * 0.008;
  return round(base * (1 + wave), base < 2 ? 6 : 4);
}

export const pricesAt = (timestamp = Date.now()) => Object.fromEntries(Object.keys(MARKET_BASES).map((market) => [market, priceAt(market, timestamp)]));

export function challengeRules(size) {
  return Object.freeze({
    startingBalance: size,
    target: round(size * 0.1),
    dailyLoss: round(size * 0.05),
    maxLoss: round(size * 0.1),
    minTradingDays: 3,
    maxExposureMultiple: 2,
    feeRate: 0.0005,
    slippageRate: 0.0002
  });
}

export function payoutAmount({ balance, startingBalance, share = 0.9, accountCap = 1000 }) {
  return round(Math.min(accountCap, Math.max(0, balance - startingBalance) * share));
}

export function classifyChallenge({ balance, startingBalance, dailyLoss, realisedLoss, tradingDays, openPositions }) {
  const rules = challengeRules(startingBalance);
  if (balance <= startingBalance - rules.maxLoss || realisedLoss <= -dailyLoss) return 'failed';
  if (openPositions === 0 && balance >= startingBalance + rules.target && tradingDays >= rules.minTradingDays) return 'passed';
  return 'active';
}
