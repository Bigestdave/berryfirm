# Berry Firm: the plan to a working AI-run business

*Snapshot of the build brief, written 10-12 November 2026. The front end in this package is finished; the backend is what remains.*

## Where you stand

The design is finished enough to build on; the product behind it is not built yet. Every number in the app today comes from a simulator inside the page, so nothing is stored, nobody signs in and no money moves.

| Piece | Today | For the hackathon |
| --- | --- | --- |
| Screens and flows | Complete: start, home, markets, order, manage, payouts, help, operator | Keep. Change copy and data only |
| Prices | Fixed example numbers for 12 markets | One price function shared by the page and the server |
| Rule engine (profit target, daily loss, max loss) | JavaScript in the page | A server that checks every fill and is the source of truth |
| Accounts and history | Reset on reload | A database |
| Sign-in | Skipped | Sign-in; a NEAR wallet is the natural fit |
| Payouts | An animation | USDC sent from a treasury on NEAR |
| Operator console | Overview with net profit and a page each for sales, payouts, costs, Berry AI and treasury; a public ledger; limits and a kill switch; all on sample data | Reads the real ledger and the agent's decisions |
| The AI | Not there yet; the console says "handled by Rules v1" | The agent that approves, rejects and explains |

The last row is the product. The rest is the shop window.

## What wins this track

The track rewards a business that visibly runs itself, and the organisers' own sample prompt spells out what that means. [Track 04, Autonomous Business](https://nearhackathon.com/), is "the company of one, or none": an AI-native business with its own treasury, sales and purchasing, where "humans only set the constraints". The [track's sample prompt](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/04-business.md) asks for four things:

- The agent has its own NEAR account, and no full-access key sits in plain text. Use OutLayer custody or a scoped function-call key.
- The owner's rules live in one config: a daily spend cap, a minimum price, the revenue split and a kill switch.
- Every sale, cost and payout appears on a public ledger page.
- A demo mode runs one full loop on testnet, from sale to payout, in under two minutes.

Berry Firm maps onto that brief cleanly:

| The track asks for | Berry Firm's answer |
| --- | --- |
| Treasury | The payout pool in USDC, held by the agent's own account |
| Sales | Challenge fees, paid in any token through NEAR Intents |
| Purchasing | The agent buys its own AI inference, with a daily cap |
| Revenue split | 80% of profit to the trader, up to $5; the rest stays in the treasury |
| Humans set constraints | Operator rules, limits and a kill switch |
| Public ledger | A Business tab and a ledger page of every sale, cost and payout |

**How it is judged.** [Claude Code and Codex screen every project](https://nearhackathon.com/) to check that it runs and does what the README says. Human judges decide after that. The FAQ says earlier NEAR hackathons were judged on technical implementation, design, impact, originality and sustainability, and calls that a good guide; this event lists no formal criteria.

**My read.** Your design is a real advantage on design and on the story. The risk is the first gate. A repo whose "business" is a simulator inside an HTML file will run, but it will not do what an autonomous business claims. One real loop beats ten more screens: a sale, a challenge, a rule decision, an agent decision, a USDC payout on NEAR, a ledger line.

The grand prize is one $55K award across all 13 tracks. Each track also pays $10K, $3K and $2K for first to third place, in NEAR. Aim to win the track, and treat the grand prize as what a complete, honest loop and a clean demo make possible. Nobody can promise it, including me.

## The minimum real system

Six parts make the loop real, and the AI runs only one of them. Rules code judges the trading, the agent decides payouts and exceptions inside hard caps, and NEAR moves the money.

Architecture, read clockwise from NEAR:

- **NEAR rail** (fees come in via 1Click, USDC goes out to traders) sends "fee paid" to the **Rules server**.
- **Rules server** (rules code and prices; judges pass, fail, breach) sends a "case" to the **AI agent**. It also reads and writes every event in the **Database and ledger** (every sale, cost and payout with the reason for it), and it is the only thing the **Browser app** (trader and owner screens) talks to.
- **AI agent** (one tool call per case: approve, reject or escalate) is the only part run by the AI. It sends its "tool call" to the **Policy gate and signer**.
- **Policy gate and signer** (caps checked in code; the agent holds no key) sends the USDC out through the NEAR rail.

| Decision | Decided by | Why |
| --- | --- | --- |
| Pass, fail or breach a challenge | Rules code | The same inputs always give the same answer, and the server can replay any order log |
| Approve or reject a payout | The agent, inside limits | It reads the case, calls one tool and writes its reason to the ledger |
| Send the USDC | Policy gate and signer | Caps are checked in code, and the agent never holds a key |
| Change limits, pause the business | You, on the Rules page | Humans set the constraints |
| Settle what the agent escalates | You, from the Queue | Exceptions only, such as a bad price or a wallet changed after approval |

Trading stays simulated, but the server owns it. Make every price a pure function of market and time, so the browser and the server agree and there is no feed to run. The server fills at its own clock, so a trader cannot pick a price.

## Connect the app to a backend

The operator screens, the ledger and the pool are read-only views and wire in an afternoon. The trader side holds a trading simulator in the browser, and that has to move to the server before it counts as real.

**Host the app yourself.** The preview link cannot call a server, because artifact pages block network requests. The source package builds one static page with `node build.mjs`. Serve it from any static host, or from your own API so the browser makes no cross-origin calls.

**One config file.** `public/config.js` sets `window.BERRY_CONFIG` before the app starts. `demo:false` removes the example account, the screen jumper and the ready-made routes. `fees`, `share`, `cap`, `treasury` and `user` replace the sample values wherever the copy shows them.

**A few functions are the seam.** `biz()`, `trend()` and `ledger()` produce every number on the Overview and the Ledger. `POOL0()` seeds the pool, `OW` and `S.own` the Queue, and `ACC` the Accounts list. Replace each body with a read from your API and return the same shape. The README in the package lists them.

| Screen | Reads | Writes |
| --- | --- | --- |
| Sign in | | `POST /api/auth/challenge` and `POST /api/auth/verify`: the wallet signs a message, the server returns a session |
| Start | `GET /api/config`: fees, sizes, markets, paused flag | `POST /api/challenges` with a size returns a deposit address and amount; poll `GET /api/challenges/:id` until it is `active` |
| Home and Trade | `GET /api/me`, `GET /api/prices` | `POST /api/orders`, `PATCH /api/positions/:id`, `POST /api/positions/:id/close` |
| Passed and Failed | `GET /api/me` | `POST /api/challenges/:id/fund`, `POST /api/appeals` |
| Payouts | `GET /api/payouts/:id` | `POST /api/payouts` with the wallet, then `POST /api/payouts/:id/confirm` |
| Help | | `POST /api/ask`: the agent answers from the trader's own data |
| Pool and Ledger | `GET /api/pool`, `GET /api/ledger?before=` | |
| Overview | `GET /api/ops/business?per=7d`, also `today` and `all` | |
| Queue and Case | `GET /api/ops/cases`, `GET /api/ops/cases/:id` | `POST /api/ops/cases/:id/resolve` |
| Accounts | `GET /api/ops/accounts?filter=` | `POST /api/ops/accounts/:id/pause` |
| Rules | `GET /api/ops/rules` | `PATCH /api/ops/rules`: paused flag, limits, sizes, markets |

Guard every `/api/ops` route with the owner's wallet. In the preview, `#owner` opens for anyone.

The Overview opens five pages: Sales, Payouts, Costs, Berry AI and Treasury. Each is one function in `OBZ`, in `src/70-operator.js`. Feed it from `GET /api/ops/business/:page`, where the page is `sales`, `payouts`, `costs`, `ai` or `treasury`.

The operator views need three response shapes. The rest are plain records.

```jsonc
// GET /api/ops/business?per=7d   (the shape biz() and trend() return today)
{ "per": "7d", "sold": 171, "sales": 415, "payouts": { "amount": 4.2, "count": 1 },
  "ai": 14.6, "hosting": 3, "series": [0.6, 1.1, 1.8, 2.4] }

// GET /api/ledger?before=evt_9f0   (newest first; the shape ledger() returns today)
[ { "id": "evt_9f2", "type": "sale", "label": "$10K challenge", "detail": "Paid in NEAR", "amount": 2, "ref": "7Hq2…m9Zc", "at": "2026-11-11T05:12:00Z" },
  { "id": "evt_9f1", "type": "cost", "label": "AI decisions · 38 calls", "detail": "Inference", "amount": -0.31, "at": "2026-11-11T04:50:00Z" } ]

// GET /api/payouts/po_41
{ "id": "po_41", "status": "approved", "amount": 4.8, "wallet": "you.near",
  "decision": { "by": "agent", "reason": "Target met, 3 trading days, no breach", "at": "2026-11-11T05:20:00Z" }, "tx": null }
```

`series` is cumulative net profit, oldest first. Costs and payouts carry a negative `amount`.

## The AI operator

The agent is one model call in a loop, and its power is whatever tools you hand it. Give it three actions, make each one check the caps in code, and write every decision to the ledger.

**What it decides.** For each payout request, appeal or wallet change, the server builds a case record. It holds the rule results, a trade summary, past payouts and the caps left today. The model reads it and makes exactly one tool call with a reason. A malformed reply, a timeout or an error becomes an escalation to your Queue.

| Tool | What it does | Checked in code, not in the prompt |
| --- | --- | --- |
| `approve_payout(case, amount, reason)` | Queues a USDC transfer to the wallet on file | At most 80% of profit and $5 per account; under today's payout cap; treasury balance covers it; wallet unchanged since the request; one payout per request |
| `reject_payout(case, reason)` | Declines and tells the trader why | A reason is required, and the trader sees it |
| `escalate(case, question)` | Puts the case in your Queue | Nothing. It is the safe default for anything unclear |

**Guardrails.** A policy gate sits between the agent and every side effect. Before a tool runs, it checks the kill switch and the daily payout and AI-spend caps from the Rules page. It refuses any call that breaks them. Trader text, such as an appeal, goes into the prompt as quoted data. A hostile message can then cause at worst a rejection or an escalation, inside the caps.

**The model call.** Use any OpenAI-compatible endpoint through `AI_BASE_URL`. The [NEAR AI Cloud](https://cloud-stg.near.ai/) page I read describes one with per-token prices, and OutLayer's credits form lists "NEAR AI: private inference". I could not see how either is billed. If the skill files show the call and its price, use it and book the cost on the ledger. Credits are a grant, so the README must not say the business earned them. Check that your model supports tool calls; if not, ask for a JSON reply and validate it. Record each call's tokens and cost as an "AI decisions" line on the ledger, which feeds the Overview.

**Audit.** Every decision writes one ledger row: the case, the tool call, the reason, the model, the cost and, once it lands, the transaction hash. The Ledger and Case screens read those rows, so nothing the agent does is off the books.

## The money rail

Money comes in through NEAR Intents and goes out as USDC on NEAR. Each leg has one catch worth knowing before you build.

**In: sales.** The [1Click API](https://docs.near-intents.org/near-intents/1click-api) is the "pay in any token" part. Request a quote with `dry` set to false and the fee as an exact USDC output. Set the treasury as `recipient` and the trader's wallet as `refundTo`. The reply carries a `depositAddress`. Store it against the challenge, show it to the trader, and poll `GET /v0/status` until the [status](https://docs.near-intents.org/api-reference/oneclick/check-swap-execution-status) is `SUCCESS`. Then start the challenge and write the sale row.

`REFUNDED`, `FAILED` and a passed `deadline` mean no challenge. The docs recommend an API token and apply a 0.1% fee without one. They never mention testnet and give only a time estimate, so keep this leg out of the two-minute demo.

**Out: payouts.** USDC on NEAR is an NEP-141 token, and [`ft_transfer` must carry exactly one yoctoNEAR](https://docs.near.org/primitives/ft). NEAR's docs say [a function-call key cannot attach it](https://docs.near.org/smart-contracts/security/one_yocto), so signing a payout takes more than that kind of key. Amounts are integers: USDC has six decimals, so $4.80 is `4800000`.

The receiving wallet must also be registered with the token contract. [NEP-145](https://github.com/near/NEPs/blob/master/neps/nep-0145.md) defines `storage_deposit` with `registration_only` for this, and a third party can pay for it. NEP-145 does not say what `ft_transfer` does for an unregistered account, so register the wallet before its first payout.

**Who holds the key.** Try OutLayer first, because the track names it and its wallet skill describes a one-call setup. Keep the server key as the fallback.

| Option | How it works | Weak spot | Effort |
| --- | --- | --- | --- |
| OutLayer wallet (first choice) | `POST /register` creates a wallet whose key lives in an Intel TDX enclave. Your server holds only a `wk_` API key. You set a cap or an approval threshold on the owner dashboard, and the enclave enforces it | The skill pages I could read do not show the USDC call or how the cap is counted | Two hours to one testnet transfer, then stop |
| Server key behind the gate (fallback) | One account's key in the host's secret store, never in the repo. The policy gate enforces the caps | A full-access key, and the caps exist only in your server code | Hours |
| Treasury contract (dropped) | A contract holds the USDC and exposes one `pay` method, with ceilings on-chain | You write and test a contract, and need a test token on testnet | About a day |

**The decision.** Give OutLayer a two-hour limit, ending at one successful testnet transfer. If you get it, mainnet runs the same code on another host. If you do not, switch to the server key and move on. Put payouts behind one `pay` function with three implementations (`mock`, `outlayer`, `serverkey`), so the switch costs minutes. Test two unknowns first: the USDC call, and whether the wallet cap covers token transfers. The in-code caps stay either way, because a screener reads the gate. Say in the README which signer you shipped.

**Three modes, one switch.** Set `RAIL` to choose how real the money is.

| `RAIL` | Sale leg | Payout leg | Needs |
| --- | --- | --- | --- |
| `mock` (default) | A "simulate deposit" call marks the quote paid | A ledger row with a mock reference | Nothing, so a screener can run the repo with no secrets |
| `testnet` | The same simulated deposit | A real testnet transfer | A testnet account and token |
| `mainnet` | A real 1Click quote and deposit | A real USDC `ft_transfer` | API token, funded treasury, signing key |

`testnet` is the demo mode the track asks for. Label the simulated deposit on screen and in the README, rather than let a judge discover it.

## What is still missing

Seven pieces stand between the design and a loop a screener can run. They are ranked by what a judge would miss first. The hours are my rough guesses for one person working with a coding assistant.

| Piece | Without it, a judge sees | Hours |
| --- | --- | --- |
| The agent and its policy gate | No AI running the business, which is the track's premise | 4-5 |
| Server, database, rules and prices | A business whose state lives in a browser tab | 8-10 |
| Payout rail, `mock` and `testnet` first | The loop ending at an animation, with no money moved | 4-5 |
| Public repo, README, deploy and video | Nothing to screen and nothing to watch | 4-5 |
| Wiring the app to the API | A design that shows sample numbers | 3-4 |
| Sale rail and wallet sign-in | Sales and accounts that belong to no one | 5-7 |
| Demo mode, seed script and tests | No clean two-minute demo and no proof the caps hold | 3-4 |

That is 31 to 40 hours of work. From Thursday morning to Saturday midday UTC is about 52 hours, and two nights of sleep take around 14 of them. It fits only if you work most of your waking hours, so the plan below has cut lines.

**Sign-in.** NEAR's [backend login docs](https://docs.near.org/web3-apps/backend) describe the flow. The server makes a random challenge, the wallet signs it with `signMessage`, and the server verifies the signature with a helper from `near-api-js`. The docs do not cover expiry or replay, so make each challenge single-use and short-lived.

**Smaller gaps.** Allow one active challenge and one funded account per wallet, so the $5 cap cannot be farmed. Limit Help questions per trader, because each one costs a model call. Add a short terms page saying that trading is simulated and payouts follow the caps.

## The plan: Thursday to Saturday

Make the loop run on `mock` first, make the money real second, and record the video on Friday. Saturday is only for submitting.

The deadline is Saturday 14 November, 23:59 UTC, which is 00:59 on Sunday in Lagos. Aim to submit by 12:00 UTC on Saturday, and treat the rest as spare time.

**Do this today, by hand.** Open Payment Keys in the OutLayer dashboard and create a new mainnet key with the 0.01 minimum deposit and nothing more. Note its number, then submit the OutLayer credits form. Credits pay OutLayer calls such as wallet operations. They cannot pay the USDC you send traders, so you still fund the treasury yourself. The page does not say how fast grants arrive, so ask now.

| Day | Build | Done when |
| --- | --- | --- |
| Thursday 12 | Server, database, shared rules and prices. `src/80-api.js` wires the app with `demo:false`. The agent and policy gate on `RAIL=mock`. A ledger row for every event. By hand: the OutLayer payment key and the credits form | A trader can buy a challenge, trade, pass and request a payout, and the agent's decision with its reason shows in the Queue and on the Ledger |
| Friday 13 | Payout rail through the OutLayer wallet on testnet, with a two-hour limit, then a small mainnet payout. Wallet sign-in. The 1Click sale leg. Demo mode and tests. Deploy. Record the video in the afternoon | One real transfer shows its transaction link on the Ledger, the app has a public URL, and the video is recorded |
| Saturday 14 | Fill the README with true statements, make the repo public, post on X, submit the form | Submitted by 12:00 UTC, which is 13:00 in Lagos |

**If you fall behind, cut in this order.** First the OutLayer wallet: stay on the server key and say so in the README. Then wallet sign-in: use a cookie session and a wallet typed at payout time. Then the live 1Click sale: keep the `mock` sale and say so on screen.

Never cut the agent with its policy gate, one real transfer, the public ledger, the kill switch or a README that matches the code.

## Hand-off: the prompt, the video and the submission

**The prompt for your coding AI.** Give it this document (the package has it as `BUILD_BRIEF.md`) and the source package, then send this.

```text
You are building the backend for Berry Firm, an AI-run prop firm, for the NEAR hackathon (Autonomous Business track). The deadline is Saturday 14 November 2026, 23:59 UTC. Keep the scope tight and keep working without me where you can.

Read in this order: BUILD_BRIEF.md, README.md, then the files in src/. Then read the OutLayer skills at https://skills.outlayer.ai/outlayer/SKILL.md and https://skills.outlayer.ai/agent-custody/SKILL.md, and the reference files they link to (wallet-ops and funding-and-payment-keys). Where a skill file and the brief disagree about OutLayer, the skill file wins.

The front end is finished and approved. Do not redesign it. Change it only through public/config.js and a new file src/80-api.js, which you add to build.mjs before 90-boot.js. That file replaces the sample-data functions named in the brief (biz, trend, ledger, POOL0, OW, S.own, ACC, OBZ) with reads from the API and sends the trader's actions to the API routes.

Build in this order, and run the whole loop after each step:
1. Server, database, and one shared module for prices and rules that the browser and the server both use.
2. The agent and the policy gate, with RAIL=mock.
3. Payouts behind one function, pay(to, amount, ref), with three implementations: mock, outlayer and serverkey. RAIL says how real the money is (mock, testnet or mainnet). SIGNER says who signs (outlayer or serverkey).
4. The OutLayer wallet on testnet. You have two hours to one working transfer. If you reach the limit, set SIGNER=serverkey, say so in the README and move on. Do not build a treasury contract.
5. One small mainnet payout, the 1Click sale leg, wallet sign-in, demo mode and tests.

What I could read about OutLayer (verify each point in the skill files):
- POST /register needs no auth. It returns a wk_ API key (shown once), a wallet id and a NEAR account id. Send the key as a Bearer token. The host picks the network: https://testnet-api.outlayer.ai or https://api.outlayer.ai. A key from one network fails on the other.
- The owner sets a cap, an address list or an approval threshold on the dashboard, at https://app.outlayer.ai/wallet?key=<the wk_ key>. When the wallet exists, tell me exactly what to set there. Never print the key.
- A transfer can return pending_approval. Treat it as an escalation to the owner and write a ledger row.
- POST /wallet/v1/transfer moves native NEAR. USDC is an NEP-141 token, so find the call endpoint in wallet-ops: ft_transfer needs exactly one yoctoNEAR, and USDC has six decimals. The treasury and every trader wallet must be registered with the USDC contract before they receive it. The skill lists a storage-deposit endpoint.
- Test the wallet cap. Set a small cap, request a bigger payout and record whether the wallet refuses it or holds it. Put the result in the README.

Rules you must keep:
- The caps live in code in the policy gate. The prompt never enforces them. Mirror them in the wallet policy where it allows, and never rely on that.
- The agent has three tools (approve_payout, reject_payout, escalate) and holds no key.
- A reply you cannot parse, a timeout or any error becomes an escalation.
- Every decision and every money movement writes a ledger row with a reason.
- With no secrets set, npm install && npm start runs the whole loop on RAIL=mock.
- Secrets live in environment variables (see .env.example). Never commit, log or print them, and never ask me to paste one into chat. Write each to .env yourself.
- README.md describes only what the code does. Replace every TODO(builder) with a true statement or delete the line.
- If you could not verify something (the USDC call, the cap's units, how inference is billed), list it under Not verified in the README instead of guessing.

Ask me only for: setting the wallet cap on the OutLayer dashboard, sending USDC and a little NEAR to the treasury address, and any API token you need. When you finish, print the commands I run, what is real and what is simulated, and which signer shipped.
```

**The two-minute video.** Record it on Friday, once the loop runs. Say only what the demo shows: if the sale is still `mock`, drop "in any token".

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | The Overview and its net profit | Berry Firm is a prop firm that runs itself. An AI agent decides every payout, and I only set the limits |
| 0:15 | A trader pays the challenge fee and starts trading | A trader pays in any token through NEAR Intents, and the challenge starts |
| 0:40 | The trader passes and asks for a payout | Rules code judges the trading. A payout request becomes a case |
| 1:00 | The agent's decision and reason, then the transaction link | The agent reads the case and calls one tool. The policy gate checks the caps, and the USDC moves on NEAR |
| 1:30 | The Ledger with the sale, the cost and the payout | Every sale, cost and payout is public, with the agent's reason |
| 1:50 | The Rules page: limits and the kill switch | I set the limits and hold the kill switch. Everything else runs without me |

**Submission checklist.** The form details come from a third-party summary of the official page, so check [nearhackathon.com](https://nearhackathon.com/) when you submit.

- [ ] The OutLayer payment key exists on mainnet with only the 0.01 deposit, and the credits form is submitted
- [ ] The OutLayer wallet exists, its cap is set on the dashboard, and the treasury holds about $20 USDC and a little NEAR
- [ ] The repo is public, and the README runs with no secrets
- [ ] The README says what is simulated (trading and prices) and what is real (the payouts)
- [ ] The README says which signer you shipped, the OutLayer wallet or the server key, and what the wallet cap did in your test
- [ ] The public ledger opens without a login
- [ ] One real transfer with a transaction link is on the ledger
- [ ] The video is recorded and posted on X, tagging @NEARProtocol and #NEARHackathon
- [ ] The description is written (20 to 2,000 characters)
- [ ] Your NEAR wallet address is ready for the prize
- [ ] The form is submitted by Saturday 12:00 UTC, and you kept the confirmation

## Sources

- [NEAR Hackathon, official page](https://nearhackathon.com/): the rules and dates as I read them on Tuesday. My tools could not open it on Thursday.
- [A third-party summary of the hackathon](https://www.startupgrantsindia.com/near-hackathon-2026): the deadline, the form fields, the X post and the description length.
- [Track 04 sample prompt](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/04-business.md)
- [1Click API](https://docs.near-intents.org/near-intents/1click-api) and [swap status](https://docs.near-intents.org/api-reference/oneclick/check-swap-execution-status)
- [Fungible tokens on NEAR](https://docs.near.org/primitives/ft), [one yoctoNEAR](https://docs.near.org/smart-contracts/security/one_yocto) and [NEP-145](https://github.com/near/NEPs/blob/master/neps/nep-0145.md)
- [Backend login with a NEAR wallet](https://docs.near.org/web3-apps/backend)
- [NEAR AI Cloud](https://cloud-stg.near.ai/): the staging site, the only page I could read
- [OutLayer skill index](https://skills.outlayer.ai/outlayer/SKILL.md) and [agent-custody skill](https://skills.outlayer.ai/agent-custody/SKILL.md): the register call, the transfer call, the owner policy and the two hosts. The reference files they link to were not reachable from here, so your coding AI reads them.
- The OutLayer homepage, getting-started docs and hackathon credits page: the text you pasted on Thursday. My tools could not open app.outlayer.ai.
