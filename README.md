# Berry Firm

## The autonomous prop firm

Berry Firm turns the prop-firm operating model into autonomous capital infrastructure. A trader enters an evaluation, trades within clear risk rules, qualifies for funded capital, and requests a settlement. Berry AI evaluates the case; a policy gate enforces the owner's limits; the treasury executes only approved settlements; and the public ledger shows the operating record.

This is the prop-firm experience rebuilt as a company of one: no manual review desk for routine cases, no opaque settlement queue, and no agent access to treasury keys.

## Why it matters

The modern prop-firm model proves that traders will pay for access to a disciplined evaluation and capital-allocation pathway. Its bottleneck is operations: monitoring rules, reviewing payouts, protecting treasury liquidity, answering support questions, and keeping a credible audit trail.

Berry Firm makes that operating loop autonomous. The owner defines the commercial policy—risk limits, payout ceiling, treasury reserve, AI budget, enabled markets, and kill switch. The platform takes it from there.

| Capability | Berry Firm |
| --- | --- |
| Evaluation engine | Deterministic, server-owned prices and replayable risk rules |
| AI operations | One constrained decision per payout: approve, reject, or escalate |
| Treasury | Policy-gated USDC settlement on NEAR testnet through an OutLayer custody wallet |
| Owner control | Live limits, spend caps, market availability, and a kill switch |
| Trust layer | Public ledger for revenue, AI costs, decisions, and settlements |

## The operating loop

1. A trader chooses an evaluation account and accepts Berry Rules.
2. The server owns pricing, fills, exposure, loss limits, and qualification status. The client never chooses the fill price.
3. A qualified trader starts a funded account and requests a settlement.
4. Berry AI reads the bounded case record and makes exactly one tool call: `approve_payout`, `reject_payout`, or `escalate`.
5. The policy gate independently verifies the payout ceiling, daily treasury cap, AI-spend cap, account status, wallet consistency, reserve, and kill switch; the settlement boundary then rechecks the on-chain wallet balance before a transfer.
6. The settlement rail executes only after those checks. Each decision and movement lands on the public ledger.

The evaluation market is a controlled environment, not an exchange or brokerage. That is what lets the platform reproduce every result and guarantee that the rules shown to a trader are the rules that determine the outcome.

## Product terms

Berry Firm is positioned as a one-step evaluation: a 10% target, 5% daily loss limit, 10% maximum loss, three qualifying trading days, and a 90% trader profit share. The initial commercial schedule is $59 for $5K, $89 for $10K, $199 for $25K, and $349 for $50K evaluation accounts; the policy starts with a $1,000 per-account and daily settlement ceiling, adjustable only by the operator.

The schedule describes the commercial product. In the hackathon demo (`RAIL=testnet`, `AUTH_MODE=demo`), evaluation access is free and no challenge payment is collected.

Those are commercial product terms, not a claim that a faucet must hold matching real value. The testnet proof deliberately settles a small qualifying payout in test USDC; the rail refuses any amount that the testnet treasury does not actually hold.

## Run the platform

Node 24+ is required. There are no third-party runtime dependencies.

```sh
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000). In the demo setup, the app signs into the configured demo account automatically. Open **Profile → Operator console** for owner tools; the public ledger is at `/#ledger` and policy controls are at `/#rules`.

For a fast local walkthrough, seed an eligible funded account:

```sh
npm run seed:demo
```

The seeded account is a free test account. Open **Payouts**, request a settlement, and confirm it to send the configured rail's payout. Testnet confirmations send test USDC; local mock confirmations are labelled as a demo. The full operating record appears on the ledger.

With `RAIL=testnet` and `AUTH_MODE=demo`, evaluation access is free: no challenge payment is collected or shown as revenue. Judges can use **Start free test account** for a fresh evaluation or **Run payout demo** for the prequalified settlement journey. The demo account is shared and resumes its existing state on later visits.

## Activate the NEAR testnet treasury

Berry Firm includes an OutLayer-powered NEAR testnet rail. It sends six-decimal test USDC from an agent custody wallet using an NEP-141 `ft_transfer`; recipient token storage is registered before the transfer when required.

```sh
npm run wallet:testnet -- <your-existing-account.testnet>
```

The setup command creates a dedicated OutLayer testnet treasury wallet, writes the wallet credential and treasury account to `.env`, sets `RAIL=testnet`, and never prints the credential. It uses Circle's official NEAR Testnet USDC contract (`3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af`). A newly generated implicit account may not yet exist on-chain, so fund native NEAR through OutLayer's funding page rather than sending directly from Meteor: use the URL printed by the setup command, select **Testnet**, choose **Direct transfer** (never Intents on testnet), and send 0.05–0.1 testnet NEAR for gas. Then prepare its USDC storage:

```sh
npm run wallet:testnet:status
npm run wallet:testnet:prepare
```

The status command is read-only: it confirms the generated treasury address and reports its native testnet NEAR and test-USDC balances without displaying its credential. The preparation command is the first action that can spend a small amount of free testnet NEAR on token storage, so run it only after the status check shows gas is available. You can then send or request test USDC to that treasury before running the app.

If a faucet UI rejects the generated 64-character treasury address, first claim native testnet NEAR to the named owner account (`berryfirm.testnet` in this setup). Open the OutLayer funding URL printed by the setup command, select **Testnet** and **Direct transfer**, and fund the treasury from that account; do not retry Meteor's normal transfer to an uncreated implicit account. Once the treasury has gas, run the preparation command and request the supported test-USDC asset to the treasury. This uses only free testnet assets.

Set the treasury policy in the OutLayer dashboard before demonstrating it: match the Berry daily cap, permit the USDC contract call and recipient-storage registration, and set an approval threshold only if you want to demonstrate an owner-held settlement. A policy-held request remains approved in Berry Firm and is never represented as settled until OutLayer returns a transaction hash.

Once funded, run `npm run seed:demo`, then use the seeded account to produce a real NEAR **testnet** settlement. The test journey calibrates its qualifying payout to $0.80, so a $1 test-USDC treasury can complete the proof; it does not change the commercial product schedule or operator payout policy. A confirmed settlement exposes a **Verify on NEAR testnet** link directly in Berry Firm's public ledger. The seed route is available only with the explicit `AUTH_MODE=demo` testnet setup. Testnet assets have no cash value; mainnet settlement remains intentionally locked until this treasury path is fully exercised.

## AI decisioning and hard limits

Berry Firm is preconfigured for NEAR AI Cloud's OpenAI-compatible chat endpoint and the `z-ai/glm-5.3-flash` model. Create an API key in the [NEAR AI Cloud console](https://cloud.near.ai/), set a small spend limit on the key, add `AI_API_KEY=<your-key>` to the local `.env`, and restart the server. Keep the key in `.env`; it is used by the server and never sent to the browser. GLM Flash supports tool use. Berry's cost guard uses NEAR AI's published rates of $0.15 per million input tokens and $0.50 per million output tokens; it records provider token usage and estimates cost from those rates.

The model receives a bounded case summary and has no treasury key, payment credential, or direct rail access. It can call exactly one of three decisions. The deterministic policy gate remains the authority and independently checks the payout before settlement. The previously approved offline demo payout can be re-reviewed with Berry AI from its payout screen after the key is configured; that action does not send funds.

The policy gate in `server/store.mjs` remains the authority. It enforces:

- one payout per funded account;
- 90% of eligible profit, capped at $1,000 per funded account by default;
- daily payout cap and daily AI-spend cap;
- kill switch;
- no open positions;
- unchanged destination wallet; and
- treasury reserve before and immediately before settlement.

If any AI setting is missing, the walkthrough uses a deterministic policy decision labelled as such in its audit record. This preserves a reproducible demo without presenting the fallback as a model call.

## Treasury rails

| Rail | Use | Settlement behaviour |
| --- | --- | --- |
| `mock` (default) | Local walkthrough | Creates an auditable demonstration settlement; no external transaction. |
| `testnet` | Hackathon proof | OutLayer-custodied test USDC transfer on NEAR testnet, with transaction hash. |
| `mainnet` | Future rollout | Locked. |

`SIGNER=outlayer` is the supported testnet signer. The server retains only the OutLayer `wk_` credential in `.env`; the agent never sees it. The custody key remains in OutLayer's TEE-backed wallet service.

## Environment

Copy `.env.example` to `.env` to customise a deployment. Do not commit `.env`, its OutLayer wallet credential, or the policy handoff URL.

Key settings:

```ini
RAIL=testnet
AUTH_MODE=demo
AI_BASE_URL=https://cloud-api.near.ai/v1
AI_API_KEY=your-key
AI_MODEL=z-ai/glm-5.3-flash
DEMO_WALLET=your-account.testnet
OWNER_ACCOUNT=your-account.testnet
USDC_CONTRACT=3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af
OUTLAYER_API=https://testnet-api.outlayer.ai
```

`AUTH_MODE=demo` is deliberately scoped to the hackathon testnet journey. NEAR wallet-signature login is the next production authentication milestone.

## Verify

```sh
npm run build
npm test
```

The test suite covers the end-to-end local operating loop, daily payout-cap escalation, deterministic pricing/rules, and the OutLayer testnet request shape.

## Architecture

```
src/                 Trader experience, owner console, and public ledger
src/80-api.js        Browser adapter for persistent API state
server/rules.mjs     Deterministic evaluation pricing and rules
server/store.mjs     SQLite ledger, business state, and policy gate
server/agent.mjs     Constrained AI decision layer
server/rail.mjs      Treasury boundary: local walkthrough + OutLayer testnet
server/index.mjs     API and static application host
scripts/             Demo seed plus testnet-treasury setup and USDC preparation
test/                Business-loop, policy, and rail tests
```

## Roadmap to production capital

- NEAR wallet-signature authentication for traders and owners
- NEAR Intents-powered evaluation payments
- OutLayer testnet policy and settlement evidence in the public ledger
- Mainnet treasury activation after testnet operational validation

## Licence

MIT. See [LICENSE](LICENSE).
