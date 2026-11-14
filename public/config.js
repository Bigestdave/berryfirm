/* Berry Firm runtime config. Loaded before the app; every key is optional.
   The app reads this once at start. Change a value, refresh the page. */
window.BERRY_CONFIG = {
  demo: true,                // Judge walkthrough helpers are available alongside the live server data.
  api: true,                 // Serve with `npm start`; direct file previews intentionally remain offline.
  user: { name: 'you.near' },// the signed-in trader's NEAR account (set it after wallet sign-in)
  share: 0.8,                // payout rule: share of eligible profit ...
  cap: 5,                    // ... capped per funded account, in USDC
  fees: { 5000: 1, 10000: 2, 25000: 4, 50000: 7 },  // challenge fee in USDC by account size. 0 = free
  treasury: '',              // NEAR account that holds the payout pool. Shown on Ledger; enables "Copy address".
  logos: 'logos/',           // folder filled by scripts/fetch-logos.mjs. Missing files fall back to the glyph disc.
};
