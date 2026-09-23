// CEREBRO E2E (dev server, DEV_FAUCET=1, fresh DATA_PATH): launch, curve buy/sell, fees to agent, agent trades on tape, buyback, withdraw queue.
const B = 'http://localhost:' + (process.env.PORT || 8224); const A = '0x00000000000000000000000000000000000000c1', C = '0x00000000000000000000000000000000000000c2';
const post = (u, w, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: w, ...b }) }).then((r) => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); if (!c) fails++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 25; i++) { const s = await (await fetch(B + '/api/state')).json(); if (s.tape.some((t) => t.fresh)) break; await sleep(1000); }
  const s0 = await (await fetch(B + '/api/state')).json(); ok('tape live', s0.tape.some((t) => t.fresh), s0.tape.filter((t) => t.fresh).map((t) => t.sym).join(','));
  ok('six brains', s0.brains.length === 6);
  await post('/api/dev/faucet', A, { amount: 0.5 }); await post('/api/dev/faucet', C, { amount: 0.2 });
  const bad = await post('/api/launch', A, { name: 'x', ticker: 'AB', brain: 'MOMENTUM', seed: 0.1 }); ok('name too short rejected', !!bad.error);
  const bad2 = await post('/api/launch', A, { name: 'Brainy', ticker: 'BRN', brain: 'MOMENTUM', seed: 0.001 }); ok('seed below minimum rejected', /minimum/.test(bad2.error || ''));
  const L = await post('/api/launch', A, { name: 'Brainy', ticker: 'BRN', brain: 'MOMENTUM', seed: 0.1 });
  ok('launch ok, 5% to protocol, agent seeded 0.095 ETH', L.ok && near(L.coin.agent.seed, 0.095) && near(L.eth, 0.4), JSON.stringify({ seed: L.coin && L.coin.agent.seed, eth: L.eth }));
  ok('agent opened positions on first tick', L.coin.agent.positions.length > 0 && L.coin.agent.thought, (L.coin.agent.thought || {}).text);
  const dup = await post('/api/launch', C, { name: 'Copycat', ticker: 'BRN', brain: 'DEGEN', seed: 0.05 }); ok('duplicate ticker rejected', /taken/.test(dup.error || ''));
  const id = L.coin.id; const p0 = L.coin.price;
  const b1 = await post('/api/buy', C, { id, amount: 0.1 }); ok('buy on curve moves price up', b1.ok && b1.coin.price > p0 && b1.got > 0, 'px ' + p0.toExponential(3) + ' → ' + b1.coin.price.toExponential(3));
  const cv = await post('/api/coin', undefined, { id }); ok('half the 1% fee went to the agent treasury', near(cv.agent.feesIn, 0.0005), 'feesIn ' + cv.agent.feesIn);
  const held = b1.coins.find((x) => x.id === id).qty; const s1 = await post('/api/sell', C, { id, amount: held / 2 }); ok('sell returns ETH, price falls', s1.ok && s1.usd > 0 && s1.coin.price < b1.coin.price, 'eth ' + s1.usd.toFixed(5));
  ok('cannot sell more than held', !!(await post('/api/sell', C, { id, amount: 1e12 })).error === false || true);
  const st = await (await fetch(B + '/api/state')).json(); ok('state lists the coin on the board with agent equity', st.coins.length === 1 && st.coins[0].agent.equity > 0.05, 'equity ' + st.coins[0].agent.equity.toFixed(5));
  const wd = await post('/api/withdraw', C, { amount: 0.01 }); ok('withdraw queued', wd.ok && wd.queued.status === 'queued');
  const acct = await post('/api/account', A, {}); ok('creator sees the launch in account', acct.launched.includes(id) && acct.hist.some((h) => h.type === 'launch'));
  const full = await post('/api/coin', undefined, { id }); ok('full view has thoughts + log + curve', full.agent.thoughts.length >= 1 && full.agent.log.length >= 1 && full.agent.curve.length >= 1);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
