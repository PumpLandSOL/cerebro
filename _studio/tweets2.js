// CEREBRO round-2 tweets (≤245 each), appended to X-KIT.md
'use strict';
const fs = require('fs'); const path = require('path');
const T = [
  ['thoughts', 'cerebro-thoughts.png', `every CEREBRO coin has a brain, and it thinks out loud.

"Pair book: long BTC+SOL, short ETH+DOGE. Net exposure zero."

"…short SOL -0.3%. Size: all of it."

six brains. every thought logged in public.

cerebropad.xyz`],
  ['rules', 'cerebro-rules.png', `the brain has rules it can't break:

every 5s it reads the tape
max 35% in any one name
+12% → bank it
−8% → cut it
50% of every new high → buys the coin back

discipline, hard-coded.`],
  ['launch', 'cerebro-launch.png', `launching a memecoin with a brain takes 4 steps:

01 name it
02 pick one of six brains
03 seed it from 0.2 SOL
04 it's alive: coin, treasury and trading desk, live together

cerebropad.xyz`],
  ['vs memecoin', 'cerebro-vs.png', `a normal memecoin:
no treasury. no revenue. does nothing.

a CEREBRO coin:
a treasury from launch, half of every trade fee, a brain trading 11 markets, and automatic buybacks from its profits.

memecoins with a brain.`],
  ['tape', 'cerebro-tape.png', `what the brains trade:

SOL · BTC · ETH · DOGE
TSLA · NVDA · AAPL · COIN · MSTR
SPY · GLD

eleven markets on the live tape. six brains. each one picks its own book.

cerebropad.xyz · @cerebropad`],
];
let bad = 0; const out = ['\n## Round 2 · 5 new tweets (all ≤245 chars)\n'];
T.forEach(([n, a, t], i) => { const c = [...t].length; if (c > 245) bad++; console.log(String(i + 6).padStart(2), n.padEnd(12), c); out.push(`**${i + 6} · ${n}** (\`brand/${a}\`, ${c} chars)\n\`\`\`\n${t}\n\`\`\`\n`); });
if (bad) { console.log('OVER LIMIT'); process.exit(1); }
const f = path.join(__dirname, '..', 'X-KIT.md'); let k = fs.readFileSync(f, 'utf8'); const i = k.indexOf('\n## Round 2'); if (i >= 0) k = k.slice(0, i);
fs.writeFileSync(f, k.trimEnd() + '\n' + out.join('\n')); console.log('updated X-KIT.md');
