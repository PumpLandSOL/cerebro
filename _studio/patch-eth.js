// one-shot: USDG ledger -> native ETH ledger. Deposits are value transfers to TREASURY; everything (seed, curve, agent cash, fees) is in ETH. Already applied; do not re-run.
const fs = require('fs'), path = require('path'); const R = path.join(__dirname, '..');
let s = fs.readFileSync(path.join(R, 'server/index.js'), 'utf8');
const rep = (a, b, t) => { if (!s.includes(a)) throw new Error('missing ' + t); s = s.split(a).join(b); };

// ---- header + constants ----
rep('//   Ledger + curves run off-chain; deposits are real USDG transfers to TREASURY, verified against the chain.', '//   Ledger + curves run off-chain in ETH; deposits are real ETH transfers to TREASURY on Robinhood Chain, verified against the receipt.', 'hdr');
rep("// every USDG deposit is verified against this address", "// every ETH deposit is verified against this address", 'c1');
rep("const LAUNCH_MIN = +(process.env.LAUNCH_MIN || 20);      // USDG: minimum seed for a new agent", "const LAUNCH_MIN = +(process.env.LAUNCH_MIN || 0.01);    // ETH: minimum seed for a new agent", 'c2');
rep("const CURVE_V = +(process.env.CURVE_V || 30);            // virtual USDG reserve at launch (sets the starting price)", "const CURVE_V = +(process.env.CURVE_V || 0.01);          // virtual ETH reserve at launch (sets the starting price)", 'c3');
rep("const num = (v, max) => { const x = Math.floor((+v || 0) * 1e6) / 1e6;", "const num = (v, max) => { const x = Math.floor((+v || 0) * 1e9) / 1e9;", 'num');
rep("db = { v: 1, wallets: {}, coins: {}, txs: {}, treasuryIn: { usdg: 0, n: 0 }, queue: [], protocol: { feesUsd: 0,", "db = { v: 2, wallets: {}, coins: {}, txs: {}, treasuryIn: { eth: 0, n: 0 }, queue: [], protocol: { feesEth: 0,", 'db');
rep("db.wallets[a] = { usdg: 0, coins: {}, deposited: 0, hist: [] }", "db.wallets[a] = { eth: 0, coins: {}, deposited: 0, hist: [] }", 'W');

// ---- chain layer: native ETH ----
rep(`// ---------- chain: real USDG deposits to TREASURY, verified on-chain ----------
const USDG = { addr: (process.env.USDG_ADDR || '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168').toLowerCase(), dec: 6 };
const RPCS = (process.env.RH_RPCS || 'https://rpc.mainnet.chain.robinhood.com').split(',');
const MIN_DEPOSIT = +(process.env.MIN_DEPOSIT || 20);
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHAIN = { ok: false, block: 0, treasuryUsdg: 0, lastRead: 0 };`, `// ---------- chain: real ETH deposits to TREASURY (native value transfers), verified on-chain ----------
const RPCS = (process.env.RH_RPCS || 'https://rpc.mainnet.chain.robinhood.com').split(',');
const MIN_DEPOSIT = +(process.env.MIN_DEPOSIT || 0.005);   // ETH — smaller transfers are NOT credited
const CHAIN = { ok: false, block: 0, treasuryEth: 0, lastRead: 0 };`, 'chain consts');
rep(`const balOf = (token, dec, who) => rpc('eth_call', [{ to: token, data: '0x70a08231' + who.slice(2).padStart(64, '0') }, 'latest']).then((r) => hexToNum(r, dec));
async function pollChain() { try { CHAIN.block = Number(BigInt(await rpc('eth_blockNumber', []))); CHAIN.treasuryUsdg = await balOf(USDG.addr, USDG.dec, TREASURY); CHAIN.ok = true; CHAIN.lastRead = Date.now(); } catch (e) { CHAIN.ok = false; } }`, `async function pollChain() { try { CHAIN.block = Number(BigInt(await rpc('eth_blockNumber', []))); CHAIN.treasuryEth = hexToNum(await rpc('eth_getBalance', [TREASURY, 'latest']), 18); CHAIN.ok = true; CHAIN.lastRead = Date.now(); } catch (e) { CHAIN.ok = false; } }`, 'poll');
rep(`  let amt = 0;
  for (const lg of rc.logs || []) {
    if ((lg.address || '').toLowerCase() !== USDG.addr || lg.topics[0] !== TRANSFER_TOPIC) continue;
    const from = '0x' + lg.topics[1].slice(26), to = '0x' + lg.topics[2].slice(26);
    if (from.toLowerCase() === w && to.toLowerCase() === TREASURY.toLowerCase()) amt += hexToNum(lg.data, USDG.dec);
  }
  if (!(amt > 0)) throw 'no USDG transfer to the treasury in this tx';
  if (amt < MIN_DEPOSIT) throw 'minimum deposit is ' + MIN_DEPOSIT + ' USDG — this transfer (' + amt.toFixed(2) + ') is not credited';
  const u = W(w); u.usdg += amt; u.deposited += amt; db.txs[txHash] = { w, amt, block: Number(BigInt(rc.blockNumber)), ts: Date.now() }; db.treasuryIn.usdg += amt; db.treasuryIn.n++;`, `  if ((tx.to || '').toLowerCase() !== TREASURY.toLowerCase()) throw 'tx is not a transfer to the treasury';
  const amt = hexToNum(tx.value, 18);
  if (!(amt > 0)) throw 'no ETH sent to the treasury in this tx';
  if (amt < MIN_DEPOSIT) throw 'minimum deposit is ' + MIN_DEPOSIT + ' ETH — this transfer (' + amt.toFixed(5) + ') is not credited';
  const u = W(w); u.eth += amt; u.deposited += amt; db.txs[txHash] = { w, amt, block: Number(BigInt(rc.blockNumber)), ts: Date.now() }; db.treasuryIn.eth += amt; db.treasuryIn.n++;`, 'credit');

// ---- agents: book is marked in ETH; sizes use ETH cash ----
rep("if (notional < 2) continue;", "if (notional < 0.0005) continue;", 'minpos');
rep("const eq2 = agentEquity(c); if (A.cash > A.hwm + 1) {", "const eq2 = agentEquity(c); if (A.cash > A.hwm + 0.0002) {", 'hwm');
rep("function fee(c, usd) { const f = usd * TRADE_FEE; c.agent.cash += f / 2; c.agent.feesIn += f / 2; db.protocol.feesUsd += f / 2; return f; }", "function fee(c, eth) { const f = eth * TRADE_FEE; c.agent.cash += f / 2; c.agent.feesIn += f / 2; db.protocol.feesEth += f / 2; return f; }", 'fee');
rep("db.protocol.buybackUsd += spend;", "db.protocol.buybackEth += spend;", 'bb1');
rep("protocol: { feesEth: 0, launches: 0, volume: 0, buybackUsd: 0 }", "protocol: { feesEth: 0, launches: 0, volume: 0, buybackEth: 0 }", 'bb0');
rep("A.log.unshift({ ts: now, kind: 'buyback', usd: spend, coins: got, px: curvePrice(c) }); feed({ type: 'buyback', coin: c.ticker, usd: spend });", "A.log.unshift({ ts: now, kind: 'buyback', eth: spend, coins: got, px: curvePrice(c) }); feed({ type: 'buyback', coin: c.ticker, eth: spend });", 'bb2');

// ---- views ----
rep("return { wallet: addr.toLowerCase(), usdg: w.usdg, deposited: w.deposited,", "return { wallet: addr.toLowerCase(), eth: w.eth, deposited: w.deposited,", 'acct');
rep("chain: { ok: CHAIN.ok, block: CHAIN.block, treasuryUsdg: CHAIN.treasuryUsdg, usdg: USDG.addr },", "chain: { ok: CHAIN.ok, block: CHAIN.block, treasuryEth: CHAIN.treasuryEth, ethUsd: TAPE.ETH ? TAPE.ETH.px : null },", 'state');

// ---- routes ----
rep("if (u === '/api/dev/faucet' && process.env.DEV_FAUCET === '1') { w.usdg += num(d.amount) || 0;", "if (u === '/api/dev/faucet' && process.env.DEV_FAUCET === '1') { w.eth += num(d.amount) || 0;", 'faucet');
rep("const seed = num(d.seed, w.usdg); if (seed < LAUNCH_MIN) return json(res, 200, { error: 'minimum seed is ' + LAUNCH_MIN + ' USDG' + (w.usdg < LAUNCH_MIN ? ' — deposit first' : '') });", "const seed = num(d.seed, w.eth); if (seed < LAUNCH_MIN) return json(res, 200, { error: 'minimum seed is ' + LAUNCH_MIN + ' ETH' + (w.eth < LAUNCH_MIN ? ' — deposit first' : '') });", 'launch1');
rep("w.usdg -= seed; const proto = seed * LAUNCH_FEE; db.protocol.feesUsd += proto;", "w.eth -= seed; const proto = seed * LAUNCH_FEE; db.protocol.feesEth += proto;", 'launch2');
rep("feed({ type: 'launch', coin: ticker, brain, usd: cash });", "feed({ type: 'launch', coin: ticker, brain, eth: cash });", 'launch3');
rep("const usd = num(d.amount, w.usdg); if (usd < 1) return json(res, 200, { error: 'minimum 1 USDG' });", "const usd = num(d.amount, w.eth); if (usd < 0.0002) return json(res, 200, { error: 'minimum 0.0002 ETH' });", 'buy1');
rep("w.usdg -= usd; const f = fee(c, usd);", "w.eth -= usd; const f = fee(c, usd);", 'buy2');
rep("w.coins[c.id] -= q; const gross = sellOnCurve(c, q); const f = fee(c, gross); w.usdg += gross - f;", "w.coins[c.id] -= q; const gross = sellOnCurve(c, q); const f = fee(c, gross); w.eth += gross - f;", 'sell');
rep("if (u === '/api/withdraw') { const x = num(d.amount, w.usdg); if (x < 1) return json(res, 200, { error: 'minimum 1 USDG' }); w.usdg -= x; const q = { id: id8(), wallet: addr, amt: x, asset: 'USDG',", "if (u === '/api/withdraw') { const x = num(d.amount, w.eth); if (x < 0.001) return json(res, 200, { error: 'minimum 0.001 ETH' }); w.eth -= x; const q = { id: id8(), wallet: addr, amt: x, asset: 'ETH',", 'wd');
rep("// ---------- state ----------", "// ---------- state (all balances in ETH) ----------", 'st');
fs.writeFileSync(path.join(R, 'server/index.js'), s);

// ---- client ----
let a = fs.readFileSync(path.join(R, 'client/src/app.js'), 'utf8');
const ar = (x, y, t) => { if (!a.includes(x)) throw new Error('client missing ' + t); a = a.split(x).join(y); };
ar("const fmt = (n, d = 2) =>", "const E = (n) => (n == null || !isFinite(n)) ? '—' : (Math.abs(n) >= 100 ? (+n).toFixed(2) : Math.abs(n) >= 1 ? (+n).toFixed(4) : (+n).toFixed(5)) + ' ETH';\nconst fmt = (n, d = 2) =>", 'E');
ar("$('s-agents').textContent = P.agents; $('s-eq').textContent = '$' + fmt(P.agentsEquity, 2); $('s-bb').textContent = '$' + fmt(P.buybackUsd, 2); $('s-vol').textContent = '$' + big(P.volume);", "$('s-agents').textContent = P.agents; $('s-eq').textContent = E(P.agentsEquity); $('s-bb').textContent = E(P.buybackEth); $('s-vol').textContent = E(P.volume);", 'strip');
ar("<div><small>equity</small>$${fmt(c.agent.equity, 2)}</div>", "<div><small>equity</small>${E(c.agent.equity)}</div>", 'card eq');
ar("<div><small>mcap</small>$${big(c.mcap)}</div>", "<div><small>mcap</small>${E(c.mcap)}</div>", 'card mcap');
ar("`<b>${e.coin}</b> launched with a ${e.brain} brain and $${fmt(e.usd, 2)}` : e.type === 'buyback' ? `<b>${e.coin}</b> agent bought back $${fmt(e.usd, 2)} of its coin`", "`<b>${e.coin}</b> launched with a ${e.brain} brain and ${E(e.eth)}` : e.type === 'buyback' ? `<b>${e.coin}</b> agent bought back ${E(e.eth)} of its coin`", 'feed');
ar("$('c-eq').textContent = '$' + fmt(a.equity, 2);", "$('c-eq').textContent = E(a.equity);", 'ceq');
ar("$('c-bb').textContent = '$' + fmt(a.boughtBack, 2);", "$('c-bb').textContent = E(a.boughtBack);", 'cbb');
ar("<small>${new Date(t.ts).toISOString().replace('T', ' ').slice(0, 19)}Z · equity $${fmt(t.equity, 2)}</small>", "<small>${new Date(t.ts).toISOString().replace('T', ' ').slice(0, 19)}Z · equity ${E(t.equity)}</small>", 'thought');
ar("<span style=\"color:var(--mut)\">$${fmt(p.notional, 2)} @ ${fmt(p.entry, 2)} → ${fmt(p.px, 2)}</span><span class=\"pnl ${p.pnl >= 0 ? 'up' : 'dn'}\">${sgn(p.pnl, 2)}</span>", "<span style=\"color:var(--mut)\">${E(p.notional)} @ $${fmt(p.entry, 2)} → $${fmt(p.px, 2)}</span><span class=\"pnl ${p.pnl >= 0 ? 'up' : 'dn'}\">${sgn(p.pnl, 5)}</span>", 'pos');
ar("`opened ${l.side} ${l.sym} $${fmt(l.notional, 2)} @ ${fmt(l.px, 2)}` : l.kind === 'close' ? `closed ${l.side} ${l.sym} <span class=\"${l.pnl >= 0 ? 'up' : 'dn'}\">${sgn(l.pnl, 2)}</span> · ${l.why}` : `<span class=\"v\">bought back</span> $${fmt(l.usd, 2)} → ${big(l.coins)} ${c.ticker}`", "`opened ${l.side} ${l.sym} ${E(l.notional)} @ $${fmt(l.px, 2)}` : l.kind === 'close' ? `closed ${l.side} ${l.sym} <span class=\"${l.pnl >= 0 ? 'up' : 'dn'}\">${sgn(l.pnl, 5)}</span> · ${l.why}` : `<span class=\"v\">bought back</span> ${E(l.eth)} → ${big(l.coins)} ${c.ticker}`", 'log');
ar("$('a-seed').textContent = '$' + fmt(a.seed, 2); $('a-cash').textContent = '$' + fmt(a.cash, 2); $('a-fees').textContent = '$' + fmt(a.feesIn, 2);", "$('a-seed').textContent = E(a.seed); $('a-cash').textContent = E(a.cash); $('a-fees').textContent = E(a.feesIn);", 'agent');
ar("$('a-hwm').textContent = '$' + fmt(a.hwm, 2);", "$('a-hwm').textContent = E(a.hwm);", 'hwm');
ar("<span>$${fmt(t.usd, 2)} · ${big(t.coins)} @ ${px(t.px)}</span>", "<span>${E(t.usd)} · ${big(t.coins)} @ ${px(t.px)}</span>", 'trades');
ar("const px = (p) => p >= 1 ? '$' + fmt(p, 4) : '$' + (+p).toPrecision(3);", "const px = (p) => (+p).toExponential(2) + ' ETH';", 'px');
ar("$('c-px').textContent = px(c.price); $('c-mc').textContent = '$' + big(c.mcap);", "$('c-px').textContent = px(c.price); $('c-mc').textContent = E(c.mcap);", 'cpx');
ar("$('c-usdg').textContent = A ? fmt(A.usdg, 2) : '—';", "$('c-usdg').textContent = A ? E(A.eth) : '—';", 'cusdg');
ar("$('c-unit').textContent = side === 'buy' ? 'USDG' : c.ticker;", "$('c-unit').textContent = side === 'buy' ? 'ETH' : c.ticker;", 'unit');
ar("$('c-out').textContent = side === 'buy' ? big(v * 0.99 / c.price) + ' ' + c.ticker + ' (est.)' : '$' + fmt(v * c.price * 0.99, 2) + ' (est.)';", "$('c-out').textContent = side === 'buy' ? big(v * 0.99 / c.price) + ' ' + c.ticker + ' (est.)' : E(v * c.price * 0.99) + ' (est.)';", 'out');
ar("$('c-in').value = side === 'buy' ? A.usdg :", "$('c-in').value = side === 'buy' ? A.eth :", 'max');
ar("toast(side === 'buy' ? `bought ${big(r.got)} ${coin.ticker}` : `sold for $${fmt(r.usd, 2)}`);", "toast(side === 'buy' ? `bought ${big(r.got)} ${coin.ticker}` : `sold for ${E(r.usd)}`);", 'toast');
ar("$('l-usdg').textContent = A ? fmt(A.usdg, 2) + ' USDG' : '—'; const s = +$('l-seed').value || 0; $('l-tre').textContent = s ? '$' + fmt(s * 0.95, 2) + ' (after 5% protocol fee)' : '—';", "$('l-usdg').textContent = A ? E(A.eth) : '—'; const s = +$('l-seed').value || 0; $('l-tre').textContent = s ? E(s * 0.95) + ' (after 5% protocol fee)' : '—';", 'launch');
ar("$('l-seed').value = Math.floor(A.usdg * 100) / 100;", "$('l-seed').value = Math.floor(A.eth * 1e5) / 1e5;", 'lmax');
ar("$('d-min').textContent = S ? S.minDeposit : 20;", "$('d-min').textContent = S ? S.minDeposit : 0.005;", 'dmin');
ar("$('d-usdg').textContent = A ? fmt(A.usdg, 2) : '—'; $('d-dep').textContent = A ? fmt(A.deposited, 2) + ' USDG' : '—'; $('d-val').textContent = A ? '$' + fmt(A.coins.reduce((a, c) => a + c.value, 0), 2) : '—';", "$('d-usdg').textContent = A ? E(A.eth) : '—'; $('d-dep').textContent = A ? E(A.deposited) : '—'; $('d-val').textContent = A ? E(A.coins.reduce((a, c) => a + c.value, 0)) : '—';", 'desk');
ar("<b>${big(c.qty)} · $${fmt(c.value, 2)}</b>", "<b>${big(c.qty)} · ${E(c.value)}</b>", 'hold');
ar("<b>$${fmt(c.agent.equity, 2)}</b>", "<b>${E(c.agent.equity)}</b>", 'launched');
ar("<span>${h.type}${h.coin ? ' ' + h.coin : ''} · $${fmt(h.amt, 2)}</span>", "<span>${h.type}${h.coin ? ' ' + h.coin : ''} · ${E(h.amt)}</span>", 'hist');
ar("<span>withdraw ${fmt(q.amt, 2)} USDG · ${q.id}</span>", "<span>withdraw ${E(q.amt)} · ${q.id}</span>", 'queue');
ar("toast(`credited ${fmt(r.amt, 2)} USDG`); };", "toast(`credited ${E(r.amt)}`); };", 'credit');
// native ETH send: value transfer, no calldata
ar("if (!amount || amount < minDep) return toast('minimum deposit is ' + minDep + ' USDG', true);", "if (!amount || amount < minDep) return toast('minimum deposit is ' + minDep + ' ETH', true);", 'send1');
ar("const eth = evm(); if (!eth) return toast('open a wallet to send USDG, or paste a tx hash', true); if (!S || !S.chain.usdg || !S.treasury) return toast('treasury not configured', true);", "const eth = evm(); if (!eth) return toast('open a wallet to send ETH, or paste a tx hash', true); if (!S || !S.treasury) return toast('treasury not configured', true);", 'send2');
ar("const units = BigInt(Math.round(amount * 1e6)).toString(16).padStart(64, '0'); const data = '0xa9059cbb' + S.treasury.slice(2).toLowerCase().padStart(64, '0') + units;\n    const tx = await eth.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: S.chain.usdg, data }] });", "const value = '0x' + BigInt(Math.round(amount * 1e18)).toString(16);\n    const tx = await eth.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: S.treasury, value }] });", 'send3');
ar("return toast(`credited ${fmt(r.amt, 2)} USDG`); }", "return toast(`credited ${E(r.amt)}`); }", 'send4');
fs.writeFileSync(path.join(R, 'client/src/app.js'), a);

// ---- page copy ----
let h = fs.readFileSync(path.join(R, 'client/index.html'), 'utf8');
const hr = (x, y) => { h = h.split(x).join(y); };
hr('placeholder="seed USDG (min 20)" min="20"><span class="u">USDG</span>', 'placeholder="seed ETH (min 0.01)" min="0.01" step="0.001"><span class="u">ETH</span>');
hr('<div class="row"><span>your USDG</span><b id="l-usdg">—</b></div>', '<div class="row"><span>your ETH</span><b id="l-usdg">—</b></div>');
hr('Seed USDG becomes the agent\'s treasury (5% to the protocol).', 'Seed ETH becomes the agent\'s treasury (5% to the protocol).');
hr('No USDG yet? <a href="#" data-go="desk">Deposit on your desk →</a>', 'No ETH on your desk? <a href="#" data-go="desk">Deposit →</a>');
hr('<h3>Deposit USDG</h3><p style="font-size:13.5px;color:var(--dim)">Send USDG on Robinhood Chain to the treasury. It is credited to your desk once the receipt confirms. Minimum <b id="d-min">20</b> USDG.</p>', '<h3>Deposit ETH</h3><p style="font-size:13.5px;color:var(--dim)">Send ETH on Robinhood Chain to the treasury. It is credited to your desk once the receipt confirms. Minimum <b id="d-min">0.005</b> ETH.</p>');
hr('<div class="field"><input id="d-in" type="number" placeholder="amount" min="20"><span class="u">USDG</span></div>', '<div class="field"><input id="d-in" type="number" placeholder="amount" min="0.005" step="0.001"><span class="u">ETH</span></div>');
hr('<button class="btn fill wide" id="d-send" style="margin-top:10px">Send USDG from wallet</button>', '<button class="btn fill wide" id="d-send" style="margin-top:10px">Send ETH from wallet</button>');
hr('<h3>Withdraw USDG</h3><div class="field"><input id="d-wd" type="number" placeholder="amount" min="1"><span class="u">USDG</span></div>', '<h3>Withdraw ETH</h3><div class="field"><input id="d-wd" type="number" placeholder="amount" min="0.001" step="0.001"><span class="u">ETH</span></div>');
hr('<div class="st"><div class="l">USDG</div><div class="n" id="d-usdg">—</div></div>', '<div class="st"><div class="l">ETH</div><div class="n" id="d-usdg">—</div></div>');
hr('<div class="row"><span>your USDG</span><b id="c-usdg">—</b></div>', '<div class="row"><span>your ETH</span><b id="c-usdg">—</b></div>');
hr('Your USDG seed becomes the agent\'s trading capital (5% to the protocol).', 'Your ETH seed becomes the agent\'s trading capital (5% to the protocol).');
hr('<h3>Deposits verified on-chain</h3><p>Every USDG on the ward arrived as a real transfer on Robinhood Chain that the server verified against the receipt. Withdrawals are paid from a cold wallet. There is no hot key on the server.</p>', '<h3>Deposits verified on-chain</h3><p>Every ETH on the ward arrived as a real transfer on Robinhood Chain that the server verified against the receipt. Withdrawals are paid from a cold wallet. There is no hot key on the server.</p>');
hr('<i>06 · REAL USDG</i>', '<i>06 · REAL ETH</i>');
hr('<details><summary>Is my USDG actually deposited?</summary><div class="a">Yes. A deposit is a real <b>USDG transfer on Robinhood Chain to the treasury</b>. The server reads the receipt, checks the Transfer log runs from your wallet to the treasury, and only then credits your desk.</div></details>', '<details><summary>Is my ETH actually deposited?</summary><div class="a">Yes. A deposit is a real <b>ETH transfer on Robinhood Chain to the treasury</b>. The server reads the transaction, checks it was sent from your wallet to the treasury address and confirmed, and only then credits your desk.</div></details>');
hr('<details><summary>How do I get USDG out?</summary><div class="a">Sell coins for USDG on the curve, then', '<details><summary>How do I get ETH out?</summary><div class="a">Sell coins for ETH on the curve, then');
hr('USDG is the only asset that moves.', 'ETH, the native gas token, is the only asset that moves.');
hr('one billion coins against a virtual USDG reserve.', 'one billion coins against a virtual ETH reserve.');
hr('The agent trades tokenized stocks and crypto on the live tape, earns fees on every trade of its coin, and <b>buys the coin back with its profits</b>.', 'The agent trades tokenized stocks and crypto on the live tape, earns fees on every trade of its coin, and <b>buys the coin back with its profits</b>. Seeded and settled in ETH.');
fs.writeFileSync(path.join(R, 'client/index.html'), h);
if (/USDG/.test(h)) console.log('WARN: USDG still in index.html:', (h.match(/[^.\n]*USDG[^.\n]*/g) || []).slice(0, 5));
console.log('eth patched');
