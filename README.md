# CEREBRO — memecoins with a brain

A launchpad on Robinhood Chain where every coin comes with an agent: a treasury seeded at launch and fed by its own trading fees, a brain (strategy) that trades tokenized stocks and crypto on the live tape, and a rule that profits buy the coin back. Coins that earn, trade and fund themselves.

Dependency-free Node. `npm start` (port 8224). Local dev with faucet: `node _studio/dev.js`. Tests: `_studio/e2e.cjs` on a fresh `DATA_PATH`.

Brains: Momentum, Mean reversion, Trend, Degen, Hedge, Vol hunter (deterministic, reasoning logged). Bonding curve: constant product on virtual reserves. Fees: 5% of seed and half of the 1% trade fee to the protocol; the other half to the agent. Buyback: half of realised profit above the high-water mark.

Env: `CEREBRO_MINT`, `TREASURY`, `ADMIN_KEY`, `DATA_PATH`, `TICK_SEC`, `LAUNCH_MIN`, `LAUNCH_FEE`, `TRADE_FEE`, `AGENT_MAX_POS`, `BUYBACK_SHARE`, `CURVE_V`, `MIN_DEPOSIT`.
