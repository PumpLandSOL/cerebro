// capture real CEREBRO pages for the demo video (dev server on :8224 with DEV_FAUCET=1). Seeds six agents first.
'use strict';
const { open, sleep } = require('./cdp.cjs'); const path = require('path'); const fs = require('fs');
const B = 'http://localhost:' + (process.env.PORT || 8224); const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const W = 'Demo1111111111111111111111111111111111111111'.slice(0, 44);
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
(async () => {
  for (let i = 0; i < 30; i++) { const s = await (await fetch(B + '/api/state')).json(); if (s.tape.some((t) => t.fresh)) break; await sleep(1000); }
  let st = await (await fetch(B + '/api/state')).json(); let first = st.coins[0] && st.coins[0].id;
  if (!st.coins.length) {
    await post('/api/dev/faucet', { wallet: W, amount: 40 });
    const L = [['Brainy', 'BRN', 'MOMENTUM', 4], ['Dipper', 'DIP', 'REVERSION', 3], ['Trendy', 'TRND', 'TREND', 2.5], ['Degen Cat', 'DGN', 'DEGEN', 5], ['Hedgehog', 'HDG', 'HEDGE', 3], ['Volt', 'VOL', 'VOLHUNT', 2]];
    for (const [name, ticker, brain, seed] of L) { const r = await post('/api/launch', { wallet: W, name, ticker, brain, seed }); if (r.ok) { if (!first) first = r.coin.id; await post('/api/buy', { wallet: W, id: r.coin.id, amount: 1.5 }); } else console.log(ticker, r.error); }
    await sleep(6500);   // let a tick or two land
  }
  const c = await open(B + '/', 1440, 860, 9541); await sleep(4500);
  const S = async (n, wait = 1200) => { await sleep(wait); await c.shot(path.join(OUT, n + '.png')); console.log(n); };
  const go = async (u) => { await c.send('Page.navigate', { url: B + u }); await sleep(4000); };
  await c.ev("localStorage.setItem('cerebro_w','" + W + "'); 1"); await go('/'); await S('01-ward');
  await c.ev("window.scrollTo(0, 620); 1"); await S('02-agents', 900);
  await go('/c/' + first); await S('03-coin');
  await c.ev("window.scrollTo(0, 560); 1"); await S('04-coin-log', 900);
  await go('/#launch'); await S('05-launch');
  await go('/#desk'); await S('06-desk');
  await go('/docs'); await S('07-docs');
  c.close();
})().catch((e) => { console.error(e); process.exit(1); });
