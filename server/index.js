// CEREBRO — launchpad for memecoins with a brain, on Robinhood Chain.
//   Every coin launched here comes with an AGENT: a treasury seeded at launch and fed by its own trading fees,
//   a BRAIN (strategy) that trades tokenized stocks and crypto on the live exchange tape, and a rule: profits buy
//   back the coin. The coin earns, trades and funds itself. Dependency-free Node.
//   Ledger + curves run off-chain; deposits are real USDG transfers to TREASURY, verified against the chain.
'use strict';
const http = require('http'); const fs = require('fs'); const path = require('path');
const { createHash, randomBytes, randomInt } = require('crypto');

const PORT = process.env.PORT || 8224;
const ROOT = path.join(__dirname, '..');
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
const CEREBRO_MINT = process.env.CEREBRO_MINT || '';   // $CEREBRO on Robinhood Chain — set at launch
const TREASURY = (process.env.TREASURY || '0x580Aa9df627A396F32aE649EC427a4Cb430a5eD2');   // every USDG deposit is verified against this address
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const TICK_SEC = +(process.env.TICK_SEC || 5);           // agent decision cadence
const LAUNCH_MIN = +(process.env.LAUNCH_MIN || 20);      // USDG: minimum seed for a new agent
const LAUNCH_FEE = +(process.env.LAUNCH_FEE || 0.05);    // share of the seed that goes to the protocol
const TRADE_FEE = +(process.env.TRADE_FEE || 0.01);      // 1% on every coin buy/sell: half to the coin's agent treasury, half to the protocol
const AGENT_MAX_POS = +(process.env.AGENT_MAX_POS || 0.35); // an agent never puts more than this share of its treasury in one position
const BUYBACK_SHARE = +(process.env.BUYBACK_SHARE || 0.5); // share of realised profit above high-water mark that buys the coin back
const CURVE_V = +(process.env.CURVE_V || 30);            // virtual USDG reserve at launch (sets the starting price)
const CURVE_SUPPLY = 1_000_000_000;                      // coin supply on the curve

const sha = (s) => createHash('sha256').update(s).digest();
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(buf) { let n = BigInt('0x' + Buffer.from(buf).toString('hex') || '0'), s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } return s || '1'; }
const id8 = () => base58(randomBytes(6));
const isWallet = (s) => /^0x[a-fA-F0-9]{40}$/.test(s);
const num = (v, max) => { const x = Math.floor((+v || 0) * 1e6) / 1e6; return x > 0 ? Math.min(x, max == null ? x : max) : 0; };

// ---------- state ----------
let db = { v: 1, wallets: {}, coins: {}, txs: {}, treasuryIn: { usdg: 0, n: 0 }, queue: [], protocol: { feesUsd: 0, launches: 0, volume: 0, buybackUsd: 0 }, feed: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))); } catch (e) {}
let saveT = null; function save() { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { fs.writeFileSync(DATA_PATH, JSON.stringify(db)); } catch (e) {} }, 800); }
function W(a) { a = a.toLowerCase(); return db.wallets[a] || (db.wallets[a] = { usdg: 0, coins: {}, deposited: 0, hist: [] }); }
const hist = (w, e) => { w.hist.unshift({ ts: Date.now(), ...e }); if (w.hist.length > 100) w.hist.pop(); };
const feed = (e) => { db.feed.unshift({ ts: Date.now(), ...e }); if (db.feed.length > 80) db.feed.pop(); };

// ---------- chain: real USDG deposits to TREASURY, verified on-chain ----------
const USDG = { addr: (process.env.USDG_ADDR || '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168').toLowerCase(), dec: 6 };
const RPCS = (process.env.RH_RPCS || 'https://rpc.mainnet.chain.robinhood.com').split(',');
const MIN_DEPOSIT = +(process.env.MIN_DEPOSIT || 20);
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHAIN = { ok: false, block: 0, treasuryUsdg: 0, lastRead: 0 };
const hexToNum = (h, dec) => { if (!h || h === '0x') return 0; const bi = BigInt(h); const d = 10n ** BigInt(dec || 18); return Number(bi / d) + Number(bi % d) / Number(d); };
async function rpc(method, params) {
  let err; for (const u of RPCS) { try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ac.signal }); clearTimeout(tm);
    const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; } catch (e) { err = e; } }
  throw err || new Error('rpc');
}
const balOf = (token, dec, who) => rpc('eth_call', [{ to: token, data: '0x70a08231' + who.slice(2).padStart(64, '0') }, 'latest']).then((r) => hexToNum(r, dec));
async function pollChain() { try { CHAIN.block = Number(BigInt(await rpc('eth_blockNumber', []))); CHAIN.treasuryUsdg = await balOf(USDG.addr, USDG.dec, TREASURY); CHAIN.ok = true; CHAIN.lastRead = Date.now(); } catch (e) { CHAIN.ok = false; } }
setInterval(pollChain, 30000); pollChain();
async function creditDeposit(w, txHash) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash || '')) throw 'paste the transaction hash';
  txHash = txHash.toLowerCase(); if (db.txs[txHash]) throw 'already credited';
  const [tx, rc] = await Promise.all([rpc('eth_getTransactionByHash', [txHash]), rpc('eth_getTransactionReceipt', [txHash])]);
  if (!tx) throw 'tx not found'; if (!rc) throw 'pending — try again in a few seconds'; if (rc.status !== '0x1') throw 'tx reverted';
  if ((tx.from || '').toLowerCase() !== w) throw 'tx not from your wallet';
  let amt = 0;
  for (const lg of rc.logs || []) {
    if ((lg.address || '').toLowerCase() !== USDG.addr || lg.topics[0] !== TRANSFER_TOPIC) continue;
    const from = '0x' + lg.topics[1].slice(26), to = '0x' + lg.topics[2].slice(26);
    if (from.toLowerCase() === w && to.toLowerCase() === TREASURY.toLowerCase()) amt += hexToNum(lg.data, USDG.dec);
  }
  if (!(amt > 0)) throw 'no USDG transfer to the treasury in this tx';
  if (amt < MIN_DEPOSIT) throw 'minimum deposit is ' + MIN_DEPOSIT + ' USDG — this transfer (' + amt.toFixed(2) + ') is not credited';
  const u = W(w); u.usdg += amt; u.deposited += amt; db.txs[txHash] = { w, amt, block: Number(BigInt(rc.blockNumber)), ts: Date.now() }; db.treasuryIn.usdg += amt; db.treasuryIn.n++; hist(u, { type: 'deposit', amt }); save();
  return { amt, tx: txHash };
}

// ---------- live tape (Yahoo chart API, keyless) ----------
const YF = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';
const MARKETS = { HOOD: 'HOOD', TSLA: 'TSLA', NVDA: 'NVDA', AAPL: 'AAPL', SPY: 'SPY', COIN: 'COIN', MSTR: 'MSTR', GLD: 'GLD', BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD' };
const TAPE = {};   // sym -> { px, ts, at, hist: [{t,px}] (5d hourly), d1, d30 }
async function pollTape() {
  for (const [sym, q] of Object.entries(MARKETS)) {
    try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 9000);
      const r = await fetch(YF + encodeURIComponent(q) + '?range=1mo&interval=1h&includePrePost=true', { headers: { accept: 'application/json', 'user-agent': UA }, signal: ac.signal }); clearTimeout(tm); if (!r.ok) continue;
      const res = (await r.json()).chart.result[0]; const m = res.meta; let v = +m.regularMarketPrice, ts = m.regularMarketTime * 1000;
      const T = res.timestamp || [], C = (res.indicators.quote[0] && res.indicators.quote[0].close) || [];
      const h = []; for (let i = 0; i < C.length; i++) if (C[i] != null) h.push({ t: T[i] * 1000, px: +C[i] });
      if (h.length && h[h.length - 1].t > ts) { v = h[h.length - 1].px; ts = h[h.length - 1].t; }
      if (v > 0) { const back = (hrs) => { const cut = ts - hrs * 36e5; let p = h[0] && h[0].px; for (const x of h) { if (x.t <= cut) p = x.px; else break; } return p || v; };
        TAPE[sym] = { px: v, ts, at: Date.now(), hist: h.slice(-160), d1: v / back(24) - 1, d5: v / back(120) - 1, d30: v / (h[0] ? h[0].px : v) - 1, vol: volOf(h) }; }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 120));
  }
}
function volOf(h) { if (h.length < 10) return 0; const rets = []; for (let i = 1; i < h.length; i++) rets.push(Math.log(h[i].px / h[i - 1].px)); const m = rets.reduce((a, b) => a + b, 0) / rets.length; return Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length) * Math.sqrt(24 * 365); }
setInterval(pollTape, 60000); pollTape();
const fresh = (sym) => { const t = TAPE[sym]; return !!t && (Date.now() - t.ts) < 15 * 60e3; };

// ---------- brains ----------
//   each brain looks at the tape and returns a target book: { sym: weight (-1..1 of treasury) }. The agent moves toward it.
const BRAINS = {
  MOMENTUM: { name: 'Momentum', line: 'Buys what is already moving. Rides winners, cuts losers.', color: '#00c805',
    think: (T) => { const r = rank(T, (t) => t.d5); const top = r.slice(0, 3), bot = r.slice(-2); const book = {}; top.forEach(([s], i) => book[s] = AGENT_MAX_POS * (1 - i * .25)); bot.forEach(([s]) => book[s] = -AGENT_MAX_POS * .5); return [book, `5-day leaders ${top.map(([s, t]) => s + ' ' + pct(t.d5)).join(', ')}. Long the leaders, short the tail ${bot.map(([s]) => s).join('/')}.`]; } },
  REVERSION: { name: 'Mean reversion', line: 'Buys what just fell, sells what just spiked. Bets on the rubber band.', color: '#7dff8a',
    think: (T) => { const r = rank(T, (t) => -t.d1); const top = r.slice(0, 3); const book = {}; top.forEach(([s], i) => book[s] = AGENT_MAX_POS * (1 - i * .3)); const hot = rank(T, (t) => t.d1)[0]; if (hot) book[hot[0]] = -AGENT_MAX_POS * .4; return [book, `Biggest 24h dips ${top.map(([s, t]) => s + ' ' + pct(t.d1)).join(', ')}. Buying the dip, fading ${hot ? hot[0] + ' ' + pct(hot[1].d1) : 'nothing'}.`]; } },
  TREND: { name: 'Trend', line: 'Only holds names above their 30-day trend. Patient. Rarely trades.', color: '#c9ffb0',
    think: (T) => { const up = rank(T, (t) => t.d30).filter(([, t]) => t.d30 > 0.02).slice(0, 4); const book = {}; up.forEach(([s]) => book[s] = AGENT_MAX_POS * .8 / Math.max(1, up.length) * 2); return [book, up.length ? `In a 30-day uptrend: ${up.map(([s, t]) => s + ' ' + pct(t.d30)).join(', ')}. Holding the trend, nothing else.` : 'Nothing is trending up on a 30-day view. Sitting in cash.']; } },
  DEGEN: { name: 'Degen', line: 'Crypto only. Max size. Flips direction on every 24h move.', color: '#ffb36b',
    think: (T) => { const cs = ['BTC', 'ETH', 'SOL'].filter((s) => T[s]); const book = {}; cs.forEach((s) => book[s] = Math.sign(T[s].d1 || 1) * AGENT_MAX_POS); return [book, cs.map((s) => (T[s].d1 >= 0 ? 'long ' : 'short ') + s + ' ' + pct(T[s].d1)).join(', ') + '. Size: all of it.']; } },
  HEDGE: { name: 'Hedge', line: 'Long the strongest, short the weakest, dollar-neutral. Sleeps well.', color: '#ffe27b',
    think: (T) => { const r = rank(T, (t) => t.d5); const L = r.slice(0, 2), S = r.slice(-2); const book = {}; L.forEach(([s]) => book[s] = AGENT_MAX_POS * .5); S.forEach(([s]) => book[s] = -AGENT_MAX_POS * .5); return [book, `Pair book: long ${L.map(([s]) => s).join('+')}, short ${S.map(([s]) => s).join('+')}. Net exposure zero.`]; } },
  VOLHUNT: { name: 'Vol hunter', line: 'Goes where the volatility is. Small size, many names.', color: '#5ad8ff',
    think: (T) => { const r = rank(T, (t) => t.vol).slice(0, 5); const book = {}; r.forEach(([s, t]) => book[s] = Math.sign(t.d1 || 1) * AGENT_MAX_POS * .4); return [book, `Loudest tape: ${r.map(([s, t]) => s + ' ' + (t.vol * 100).toFixed(0) + '% vol').join(', ')}. Small bets in the direction of the day.`]; } },
};
const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
function rank(T, f) { return Object.entries(T).filter(([s]) => fresh(s)).sort((a, b) => f(b[1]) - f(a[1])); }

// ---------- coins + agents ----------
//   bonding curve: constant product on virtual reserves. price = R / S where R = virtual USDG, S = virtual supply.
function coinView(c, full) {
  const price = c.r / c.s; const mcap = price * CURVE_SUPPLY; const eq = agentEquity(c);
  const v = { id: c.id, name: c.name, ticker: c.ticker, brain: c.brain, brainName: BRAINS[c.brain].name, color: BRAINS[c.brain].color, creator: c.creator.slice(0, 6) + '…' + c.creator.slice(-4), ts: c.ts,
    price, mcap, sold: CURVE_SUPPLY - c.s, reserve: c.r - c.r0, volume: c.volume, holders: Object.values(db.wallets).filter((w) => (w.coins[c.id] || 0) > 0).length,
    agent: { cash: c.agent.cash, equity: eq, seed: c.agent.seed, hwm: c.agent.hwm, pnl: eq - c.agent.seed - c.agent.feesIn + c.agent.boughtBack, feesIn: c.agent.feesIn, boughtBack: c.agent.boughtBack, boughtCoins: c.agent.boughtCoins, trades: c.agent.trades, wins: c.agent.wins, positions: c.agent.pos.map(posView), thought: c.agent.thoughts[0] || null, curve: c.agent.curve.slice(-120) } };
  if (full) { v.agent.thoughts = c.agent.thoughts.slice(0, 20); v.agent.log = c.agent.log.slice(0, 30); v.trades = c.trades.slice(0, 30); }
  return v;
}
function posView(p) { const t = TAPE[p.sym]; const px = t ? t.px : p.entry; const pnl = (px / p.entry - 1) * (p.side === 'long' ? 1 : -1) * p.notional; return { sym: p.sym, side: p.side, notional: p.notional, entry: p.entry, px, pnl, ts: p.ts }; }
function agentEquity(c) { return c.agent.cash + c.agent.pos.reduce((a, p) => a + p.notional + posView(p).pnl, 0); }
function curvePrice(c) { return c.r / c.s; }
function buyOnCurve(c, usd) { const k = c.r * c.s; const r2 = c.r + usd; const out = c.s - k / r2; c.r = r2; c.s -= out; return out; }
function sellOnCurve(c, coins) { const k = c.r * c.s; const s2 = c.s + coins; const out = c.r - k / s2; c.s = s2; c.r -= out; return out; }
function fee(c, usd) { const f = usd * TRADE_FEE; c.agent.cash += f / 2; c.agent.feesIn += f / 2; db.protocol.feesUsd += f / 2; return f; }

function agentTick(c, now) {
  const A = c.agent; const T = {}; for (const s of Object.keys(MARKETS)) if (fresh(s)) T[s] = TAPE[s]; if (!Object.keys(T).length) return;
  // mark and manage open positions: close anything the brain no longer wants, or that hit ±12%
  const [book, why] = BRAINS[c.brain].think(T);
  const eq = agentEquity(c); let acted = false;
  for (const p of A.pos.slice()) { const v = posView(p); const want = book[p.sym] || 0; const wrongWay = Math.sign(want) !== (p.side === 'long' ? 1 : -1); const move = v.pnl / p.notional;
    if (wrongWay || move > 0.12 || move < -0.08) { closePos(c, p, v, wrongWay ? 'brain flipped' : move > 0 ? 'took profit' : 'stopped out'); acted = true; } }
  // open toward the target book
  for (const [sym, wgt] of Object.entries(book)) { if (!wgt || A.pos.some((p) => p.sym === sym)) continue; const notional = Math.min(A.cash * 0.95, Math.abs(wgt) * eq); if (notional < 2) continue;
    A.cash -= notional; A.pos.push({ sym, side: wgt > 0 ? 'long' : 'short', notional, entry: TAPE[sym].px, ts: now }); A.trades++; A.log.unshift({ ts: now, kind: 'open', sym, side: wgt > 0 ? 'long' : 'short', notional, px: TAPE[sym].px }); if (A.log.length > 200) A.log.pop(); acted = true; }
  if (acted || !A.thoughts.length || now - A.thoughts[0].ts > 20 * 60e3) { A.thoughts.unshift({ ts: now, text: why, equity: agentEquity(c) }); if (A.thoughts.length > 60) A.thoughts.pop(); }
  // fund itself: realised profit above the high-water mark buys the coin back from the curve
  const eq2 = agentEquity(c); if (A.cash > A.hwm + 1) { const gain = A.cash - A.hwm; const spend = gain * BUYBACK_SHARE; A.cash -= spend; const got = buyOnCurve(c, spend); A.boughtBack += spend; A.boughtCoins += got; db.protocol.buybackUsd += spend; A.hwm = A.cash; c.volume += spend;
    A.log.unshift({ ts: now, kind: 'buyback', usd: spend, coins: got, px: curvePrice(c) }); feed({ type: 'buyback', coin: c.ticker, usd: spend }); }
  A.curve.push([now, eq2]); if (A.curve.length > 400) A.curve.shift();
}
function closePos(c, p, v, why) { const A = c.agent; A.cash += p.notional + v.pnl; A.pos = A.pos.filter((x) => x !== p); A.trades++; if (v.pnl > 0) A.wins++; A.log.unshift({ ts: Date.now(), kind: 'close', sym: p.sym, side: p.side, notional: p.notional, pnl: v.pnl, why }); if (A.log.length > 200) A.log.pop(); }

function tick() { const now = Date.now(); for (const c of Object.values(db.coins)) { try { agentTick(c, now); } catch (e) {} } save(); }
setInterval(tick, TICK_SEC * 1000);

// ---------- views ----------
function account(addr) { const w = W(addr); const coins = Object.entries(w.coins).filter(([, q]) => q > 0).map(([id, qty]) => { const c = db.coins[id]; return c ? { id, ticker: c.ticker, name: c.name, qty, value: qty * curvePrice(c) } : null; }).filter(Boolean);
  return { wallet: addr.toLowerCase(), usdg: w.usdg, deposited: w.deposited, coins, launched: Object.values(db.coins).filter((c) => c.creator === addr.toLowerCase()).map((c) => c.id), hist: w.hist.slice(0, 40), queue: db.queue.filter((q) => q.wallet === addr.toLowerCase()).slice(0, 10) }; }
function state() { const coins = Object.values(db.coins).map((c) => coinView(c)); const board = coins.slice().sort((a, b) => (b.agent.equity / b.agent.seed) - (a.agent.equity / a.agent.seed));
  return { gov: 'CEREBRO', mint: CEREBRO_MINT, treasury: TREASURY, chain: { ok: CHAIN.ok, block: CHAIN.block, treasuryUsdg: CHAIN.treasuryUsdg, usdg: USDG.addr }, minDeposit: MIN_DEPOSIT, launchMin: LAUNCH_MIN, tradeFee: TRADE_FEE, brains: Object.entries(BRAINS).map(([k, b]) => ({ id: k, name: b.name, line: b.line, color: b.color })),
    tape: Object.keys(MARKETS).map((s) => ({ sym: s, px: TAPE[s] ? TAPE[s].px : null, d1: TAPE[s] ? TAPE[s].d1 : 0, fresh: fresh(s) })), coins: board, protocol: { ...db.protocol, agents: coins.length, agentsEquity: coins.reduce((a, c) => a + c.agent.equity, 0), deposits: db.treasuryIn }, feed: db.feed.slice(0, 30), t: Date.now() }; }

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4' };
function serve(req, res) { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/' || /^\/c\/[A-Za-z0-9]+$/.test(u)) u = '/client/index.html'; const f = path.normalize(path.join(ROOT, u)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); } fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); }
function json(res, c, o) { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); }
function body(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }

http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  if (req.method === 'GET') { if (u === '/api/state') return json(res, 200, state()); const m = /^\/api\/coin\/([A-Za-z0-9]+)$/.exec(u); if (m) { const c = db.coins[m[1]]; return c ? json(res, 200, coinView(c, true)) : json(res, 404, { error: 'no such coin' }); } return serve(req, res); }
  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
  const d = await body(req);
  if (u === '/api/coin') { const c = db.coins[d.id]; return c ? json(res, 200, coinView(c, true)) : json(res, 200, { error: 'no such coin' }); }
  if (!isWallet(d.wallet || '')) return json(res, 200, { error: 'connect a Robinhood Chain wallet' });
  const addr = d.wallet.toLowerCase(); const w = W(addr);
  if (u === '/api/account') return json(res, 200, account(addr));
  if (u === '/api/deposit') { try { const r = await creditDeposit(addr, d.tx); return json(res, 200, { ok: true, ...r, ...account(addr) }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
  if (u === '/api/dev/faucet' && process.env.DEV_FAUCET === '1') { w.usdg += num(d.amount) || 0; save(); return json(res, 200, { ok: true, ...account(addr) }); }   // LOCAL TESTING ONLY
  if (u === '/api/launch') {
    const name = String(d.name || '').trim().slice(0, 32), ticker = String(d.ticker || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); const brain = String(d.brain || '').toUpperCase();
    if (name.length < 2) return json(res, 200, { error: 'give it a name' }); if (ticker.length < 2) return json(res, 200, { error: 'give it a ticker' }); if (!BRAINS[brain]) return json(res, 200, { error: 'pick a brain' });
    if (Object.values(db.coins).some((c) => c.ticker === ticker)) return json(res, 200, { error: ticker + ' is taken' });
    const seed = num(d.seed, w.usdg); if (seed < LAUNCH_MIN) return json(res, 200, { error: 'minimum seed is ' + LAUNCH_MIN + ' USDG' + (w.usdg < LAUNCH_MIN ? ' — deposit first' : '') });
    w.usdg -= seed; const proto = seed * LAUNCH_FEE; db.protocol.feesUsd += proto; const cash = seed - proto;
    const c = { id: id8(), name, ticker, brain, creator: addr, ts: Date.now(), r0: CURVE_V, r: CURVE_V, s: CURVE_SUPPLY, volume: 0, trades: [], agent: { seed: cash, cash, hwm: cash, pos: [], trades: 0, wins: 0, feesIn: 0, boughtBack: 0, boughtCoins: 0, thoughts: [], log: [], curve: [[Date.now(), cash]] } };
    db.coins[c.id] = c; db.protocol.launches++; hist(w, { type: 'launch', amt: seed, coin: ticker }); feed({ type: 'launch', coin: ticker, brain, usd: cash }); agentTick(c, Date.now()); save();
    return json(res, 200, { ok: true, coin: coinView(c, true), ...account(addr) });
  }
  if (u === '/api/buy') { const c = db.coins[d.id]; if (!c) return json(res, 200, { error: 'no such coin' }); const usd = num(d.amount, w.usdg); if (usd < 1) return json(res, 200, { error: 'minimum 1 USDG' });
    w.usdg -= usd; const f = fee(c, usd); const got = buyOnCurve(c, usd - f); w.coins[c.id] = (w.coins[c.id] || 0) + got; c.volume += usd; db.protocol.volume += usd; c.trades.unshift({ ts: Date.now(), side: 'buy', usd, coins: got, px: curvePrice(c) }); if (c.trades.length > 200) c.trades.pop(); hist(w, { type: 'buy', amt: usd, coin: c.ticker }); save();
    return json(res, 200, { ok: true, got, coin: coinView(c), ...account(addr) }); }
  if (u === '/api/sell') { const c = db.coins[d.id]; if (!c) return json(res, 200, { error: 'no such coin' }); const q = num(d.amount, w.coins[c.id] || 0); if (!q) return json(res, 200, { error: 'nothing to sell' });
    w.coins[c.id] -= q; const gross = sellOnCurve(c, q); const f = fee(c, gross); w.usdg += gross - f; c.volume += gross; db.protocol.volume += gross; c.trades.unshift({ ts: Date.now(), side: 'sell', usd: gross, coins: q, px: curvePrice(c) }); if (c.trades.length > 200) c.trades.pop(); hist(w, { type: 'sell', amt: gross - f, coin: c.ticker }); save();
    return json(res, 200, { ok: true, usd: gross - f, coin: coinView(c), ...account(addr) }); }
  if (u === '/api/withdraw') { const x = num(d.amount, w.usdg); if (x < 1) return json(res, 200, { error: 'minimum 1 USDG' }); w.usdg -= x; const q = { id: id8(), wallet: addr, amt: x, asset: 'USDG', ts: Date.now(), status: 'queued', tx: null }; db.queue.unshift(q); if (db.queue.length > 500) db.queue.pop(); hist(w, { type: 'withdraw', amt: x }); save(); return json(res, 200, { ok: true, queued: q, ...account(addr) }); }
  if (u === '/api/admin/queue') { if (!ADMIN_KEY || d.key !== ADMIN_KEY) return json(res, 200, { error: 'no' }); return json(res, 200, { ok: true, queue: db.queue.slice(0, 100), deposits: Object.entries(db.txs).map(([tx, t]) => ({ tx, ...t })).slice(-50) }); }
  if (u === '/api/admin/paid') { if (!ADMIN_KEY || d.key !== ADMIN_KEY) return json(res, 200, { error: 'no' }); const q = db.queue.find((x) => x.id === d.id); if (!q) return json(res, 200, { error: 'no such item' }); q.status = 'paid'; q.tx = d.tx || null; q.paidTs = Date.now(); save(); return json(res, 200, { ok: true, q }); }
  json(res, 404, { error: 'unknown route' });
}).listen(PORT, () => console.log('CEREBRO · memecoins with a brain · Robinhood Chain · :' + PORT));
