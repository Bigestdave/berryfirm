const ACCOUNT = /^[a-z0-9._-]{2,64}\.near$/i;
const MINUTES = 10;

async function requestJson(url, options = {}, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`NEAR Intents returned ${response.status}: ${payload.message || payload.error || 'request failed'}`);
    return payload;
  } finally { clearTimeout(timer); }
}

export const validMainnetAccount = value => ACCOUNT.test(String(value || ''));

export async function createChallengeQuote({ size, fee, refundTo, config, fetchImpl = fetch }) {
  if (!config.nearIntentsEnabled || !validMainnetAccount(config.nearIntentsReceiver)) throw new Error('NEAR Intents checkout is not configured');
  if (!validMainnetAccount(refundTo)) throw new Error('Enter a NEAR mainnet account for refunds');
  if (!Number.isFinite(Number(fee)) || Number(fee) <= 0) throw new Error('Challenge fee is not available');
  const deadline = new Date(Date.now() + MINUTES * 60_000).toISOString();
  const request = {
    dry: false,
    swapType: 'EXACT_OUTPUT',
    slippageTolerance: 100,
    originAsset: config.nearIntentsOriginAsset,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: config.nearIntentsUsdcAsset,
    amount: String(Math.round(Number(fee) * 1_000_000)),
    recipient: config.nearIntentsReceiver,
    recipientType: 'DESTINATION_CHAIN',
    refundTo,
    refundType: 'ORIGIN_CHAIN',
    deadline
  };
  const payload = await requestJson(`${config.nearIntentsApi.replace(/\/$/, '')}/v0/quote`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(config.nearIntentsApiKey ? { 'X-API-Key': config.nearIntentsApiKey } : {}) }, body: JSON.stringify(request)
  }, fetchImpl);
  const quote = payload.quote || payload;
  if (!quote.depositAddress) throw new Error('NEAR Intents did not return a deposit address');
  const amountInFormatted = quote.amountInFormatted || quote.swapView?.amountInFormatted || quote.swapView?.maxAmountInFormatted || null;
  if (!amountInFormatted) throw new Error('NEAR Intents did not return a readable exact input amount');
  return {
    request,
    payload,
    quote: {
      depositAddress: quote.depositAddress,
      depositMemo: quote.depositMemo || null,
      amountIn: quote.amountIn || quote.swapView?.amountIn || quote.swapView?.maxAmountIn || null,
      amountInFormatted,
      originAsset: request.originAsset,
      destinationAsset: request.destinationAsset,
      amountOut: request.amount,
      deadline: quote.deadline || deadline,
      explorerUrl: 'https://explorer.near-intents.org/'
    }
  };
}

export async function challengeQuoteStatus({ depositAddress, depositMemo, config, fetchImpl = fetch }) {
  const query = new URLSearchParams({ depositAddress });
  if (depositMemo) query.set('depositMemo', depositMemo);
  return requestJson(`${config.nearIntentsApi.replace(/\/$/, '')}/v0/status?${query}`, {
    headers: config.nearIntentsApiKey ? { 'X-API-Key': config.nearIntentsApiKey } : {}
  }, fetchImpl);
}

export function paymentExplorerUrl(depositAddress) {
  return `https://explorer.near-intents.org/?search=${encodeURIComponent(depositAddress)}`;
}
