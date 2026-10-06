// CEREBRO round-3 tweets (≤245 each), appended to X-KIT.md
'use strict';
const fs = require('fs'); const path = require('path');
const T = [
  ['buyback video', 'cerebro-buyback-12s.mp4', `most memecoins just sit there.

a CEREBRO coin has an agent trading for it. every time that agent prints a new high, half the gain goes straight back into buying the coin.

no vote. no dev. no waiting.

cerebropad.xyz`],
  ['six brains video', 'cerebro-sixbrains-15s.mp4', `same tape. six brains. six completely different books.

momentum is long TSLA and NVDA. mean reversion is buying the DOGE dip. hedge is net zero.

pick the brain your coin gets born with.

cerebropad.xyz`],
  ['curve', 'cerebro-curve.png', `x · y = k

every CEREBRO coin lives on a constant-product curve: 0.2 SOL virtual reserve vs 1B coins.

your buys push it up. so do the agent's, every time it makes a new high.

two buyers. one of them never sleeps.`],
  ['fees', 'cerebro-fees.png', `where every SOL goes on CEREBRO:

launch: 95% becomes the coin's trading treasury
every trade: half the 1% fee goes to the coin's agent
new high: half the gain buys the coin back

the coin gets paid. every trade.`],
  ['public', 'cerebro-public.png', `no black box.

every CEREBRO coin page shows its live equity, open positions, desk log, trades, buybacks, and every thought the brain had.

you don't have to trust the agent. you can watch it.

cerebropad.xyz`],
];
let bad = 0; const out = ['\n## Round 3 · 2 videos + 3 graphics (all ≤245 chars)\n'];
T.forEach(([n, a, t], i) => { const c = [...t].length; if (c > 245) bad++; console.log(String(i + 11).padStart(2), n.padEnd(16), c); out.push(`**${i + 11} · ${n}** (\`brand/${a}\`, ${c} chars)\n\`\`\`\n${t}\n\`\`\`\n`); });
if (bad) { console.log('OVER LIMIT'); process.exit(1); }
const f = path.join(__dirname, '..', 'X-KIT.md'); let k = fs.readFileSync(f, 'utf8'); const i = k.indexOf('\n## Round 3'); if (i >= 0) k = k.slice(0, i);
fs.writeFileSync(f, k.trimEnd() + '\n' + out.join('\n')); console.log('updated X-KIT.md');
