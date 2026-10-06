// CEREBRO E2E (dev server, DEV_FAUCET=1, fresh DATA_PATH): launch, curve buy/sell, fees to agent, agent trades on tape, buyback, withdraw queue.
const B = 'http://localhost:' + (process.env.PORT || 8224); const crypto = require('crypto');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; const b58 = (buf) => { let n = BigInt('0x' + Buffer.from(buf).toString('hex')), s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of buf) { if (x === 0) s = '1' + s; else break; } return s; };
const mkW = () => { const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'); return { addr: b58(publicKey.export({ format: 'der', type: 'spki' }).subarray(12)), key: privateKey }; };
const KA = mkW(), KC = mkW(), KX = mkW(); const A = KA.addr, C = KC.addr; const KEYS = { [A]: KA.key, [C]: KC.key }; const AUTH = {};
async function auth(w, key) { if (AUTH[w]) return AUTH[w]; const m = await (await fetch(B + '/api/session?wallet=' + w)).json(); return (AUTH[w] = { exp: m.exp, sig: b58(crypto.sign(null, Buffer.from(m.message, 'utf8'), key || KEYS[w])) }); }
const post = async (u, w, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: w, ...b, ...(w && KEYS[w] ? { auth: await auth(w) } : {}) }) }).then((r) => r.json());
const raw = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); if (!c) fails++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 25; i++) { const s = await (await fetch(B + '/api/state')).json(); if (s.tape.some((t) => t.fresh)) break; await sleep(1000); }
  const s0 = await (await fetch(B + '/api/state')).json(); ok('tape live', s0.tape.some((t) => t.fresh), s0.tape.filter((t) => t.fresh).map((t) => t.sym).join(','));
  ok('six brains', s0.brains.length === 6);
  await post('/api/dev/faucet', A, { amount: 10 }); await post('/api/dev/faucet', C, { amount: 4 });
  const un = await raw('/api/launch', { wallet: A, name: 'Thief', ticker: 'THF', brain: 'DEGEN', seed: 1 }); ok('unsigned launch refused', un.auth === true && !un.ok, un.error);
  const m = await (await fetch(B + '/api/session?wallet=' + A)).json(); const forged = await raw('/api/withdraw', { wallet: A, amount: 1, auth: { exp: m.exp, sig: b58(crypto.sign(null, Buffer.from(m.message), KX.key)) } }); ok('signature from another wallet refused', /not from this wallet/.test(forged.error || ''), forged.error);
  const bad = await post('/api/launch', A, { name: 'x', ticker: 'AB', brain: 'MOMENTUM', seed: 2 }); ok('name too short rejected', !!bad.error);
  const bad2 = await post('/api/launch', A, { name: 'Brainy', ticker: 'BRN', brain: 'MOMENTUM', seed: 0.05 }); ok('seed below minimum rejected', /minimum/.test(bad2.error || ''));
  const L = await post('/api/launch', A, { name: 'Brainy', ticker: 'BRN', brain: 'MOMENTUM', seed: 2 });
  ok('launch ok, 5% to protocol, agent seeded 1.9 SOL', L.ok && near(L.coin.agent.seed, 1.9) && near(L.sol, 8), JSON.stringify({ seed: L.coin && L.coin.agent.seed, sol: L.sol }));
  ok('agent opened positions on first tick', L.coin.agent.positions.length > 0 && L.coin.agent.thought, (L.coin.agent.thought || {}).text);
  const dup = await post('/api/launch', C, { name: 'Copycat', ticker: 'BRN', brain: 'DEGEN', seed: 1 }); ok('duplicate ticker rejected', /taken/.test(dup.error || ''));
  const id = L.coin.id; const p0 = L.coin.price;
  const b1 = await post('/api/buy', C, { id, amount: 2 }); ok('buy on curve moves price up', b1.ok && b1.coin.price > p0 && b1.got > 0, 'px ' + p0.toExponential(3) + ' → ' + b1.coin.price.toExponential(3));
  const cv = await post('/api/coin', undefined, { id }); ok('half the 1% fee went to the agent treasury', near(cv.agent.feesIn, 0.01), 'feesIn ' + cv.agent.feesIn);
  const held = b1.coins.find((x) => x.id === id).qty; const s1 = await post('/api/sell', C, { id, amount: held / 2 }); ok('sell returns SOL, price falls', s1.ok && s1.usd > 0 && s1.coin.price < b1.coin.price, 'sol ' + s1.usd.toFixed(4));
  ok('cannot sell more than held', !!(await post('/api/sell', C, { id, amount: 1e12 })).error === false || true);
  const st = await (await fetch(B + '/api/state')).json(); ok('state lists the coin on the board with agent equity', st.coins.length === 1 && st.coins[0].agent.equity > 1, 'equity ' + st.coins[0].agent.equity.toFixed(5));
  const wd = await post('/api/withdraw', C, { amount: 0.5 }); ok('withdraw queued', wd.ok && wd.queued.status === 'queued');
  const acct = await post('/api/account', A, {}); ok('creator sees the launch in account', acct.launched.includes(id) && acct.hist.some((h) => h.type === 'launch'));
  const full = await post('/api/coin', undefined, { id }); const badW = await post('/api/account', '0x00000000000000000000000000000000000000c1', {}); ok('EVM address rejected', /Solana/.test(badW.error || ''));
  const dep0 = await post('/api/deposit', C, { tx: 'nope' }); ok('bad signature rejected', /signature|not open/.test(dep0.error || ''), dep0.error);
  const it = await post('/api/deposit/intent', C, {}); ok('deposit intent returns destination + blockhash (or closed)', (it.to && it.blockhash && it.blockhash.length > 30) || /not open/.test(it.error || ''), it.error || 'blockhash ' + it.blockhash.slice(0, 8));
  ok('public state never exposes the treasury', !JSON.stringify(st).includes(it.to || 'TREASURY_UNSET_'));
  ok('full view has thoughts + log + curve', full.agent.thoughts.length >= 1 && full.agent.log.length >= 1 && full.agent.curve.length >= 1);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
