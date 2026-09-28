// one-shot: port server + client from Robinhood Chain (EVM/ETH) to Solana (SOL, Phantom). Run once.
const fs = require('fs'), path = require('path'); const R = path.join(__dirname, '..');
const rw = (f, fn) => { const p = path.join(R, f); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
const rep = (s, pairs) => { for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); s = s.split(a).join(b); } return s; };

rw('server/index.js', (s) => {
  const start = s.indexOf('// ---------- chain:'), end = s.indexOf('// ---------- live tape');
  const chain = `// ---------- chain: real SOL deposits to TREASURY (system transfers), verified on-chain ----------
//   TREASURY comes from the environment only. It is never written into this repo and never returned by a public read.
const RPCS = (process.env.SOL_RPCS || 'https://api.mainnet-beta.solana.com').split(',');
const MIN_DEPOSIT = +(process.env.MIN_DEPOSIT || 0.1);   // SOL — smaller transfers are NOT credited
const CHAIN = { ok: false, slot: 0, treasurySol: 0, lastRead: 0 };
const LAM = 1e9; const isSig = (s) => /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s || '');
async function rpc(method, params) {
  let err; for (const u of RPCS) { try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 9000);
    const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ac.signal }); clearTimeout(tm);
    const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; } catch (e) { err = e; } }
  throw err || new Error('rpc');
}
async function pollChain() { try { CHAIN.slot = await rpc('getSlot', [{ commitment: 'confirmed' }]); if (TREASURY) CHAIN.treasurySol = (await rpc('getBalance', [TREASURY, { commitment: 'confirmed' }])).value / LAM; CHAIN.ok = true; CHAIN.lastRead = Date.now(); } catch (e) { CHAIN.ok = false; } }
setInterval(pollChain, 30000); pollChain();
async function creditDeposit(w, sig) {
  if (!TREASURY) throw 'deposits are not open yet';
  if (!isSig(sig)) throw 'paste the transaction signature';
  if (db.txs[sig]) throw 'already credited';
  const tx = await rpc('getTransaction', [sig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]);
  if (!tx) throw 'tx not found yet — try again in a few seconds'; if (tx.meta && tx.meta.err) throw 'tx failed on-chain';
  const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === 'string' ? { pubkey: k, signer: false } : k));
  if (!keys.some((k) => k.signer && k.pubkey === w)) throw 'tx not signed by your wallet';
  const ti = keys.findIndex((k) => k.pubkey === TREASURY); if (ti < 0) throw 'tx is not a transfer to the treasury';
  const amt = (tx.meta.postBalances[ti] - tx.meta.preBalances[ti]) / LAM;
  if (!(amt > 0)) throw 'no SOL sent to the treasury in this tx';
  if (amt < MIN_DEPOSIT) throw 'minimum deposit is ' + MIN_DEPOSIT + ' SOL — this transfer (' + amt.toFixed(4) + ') is not credited';
  const u = W(w); u.sol += amt; u.deposited += amt; db.txs[sig] = { w, amt, slot: tx.slot, ts: Date.now() }; db.treasuryIn.sol += amt; db.treasuryIn.n++; hist(u, { type: 'deposit', amt }); save();
  return { amt, tx: sig };
}
// the wallet asks for its transfer destination + a fresh blockhash only at the moment it builds the transaction
async function depositIntent() { if (!TREASURY) throw 'deposits are not open yet'; const bh = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]); return { to: TREASURY, blockhash: bh.value.blockhash }; }

`;
  s = s.slice(0, start) + chain + s.slice(end);
  return rep(s, [
    ['launchpad for memecoins with a brain, on Robinhood Chain.', 'launchpad for memecoins with a brain, on Solana.'],
    ['//   Ledger + curves run off-chain in ETH; deposits are real ETH transfers to TREASURY on Robinhood Chain, verified against the receipt.', '//   Ledger + curves run off-chain in SOL; deposits are real SOL transfers to TREASURY on Solana, verified against the confirmed transaction.'],
    ["// $CEREBRO on Robinhood Chain — set at launch", "// $CEREBRO mint on Solana — set at launch"],
    ["const TREASURY = (process.env.TREASURY || '0x580Aa9df627A396F32aE649EC427a4Cb430a5eD2');   // every ETH deposit is verified against this address", "const TREASURY = process.env.TREASURY || '';   // Solana pubkey, env only (never committed, never shown); every SOL deposit is verified against it"],
    ["// ETH: minimum seed for a new agent", "// SOL: minimum seed for a new agent"],
    ["+(process.env.LAUNCH_MIN || 0.01)", "+(process.env.LAUNCH_MIN || 0.2)"],
    ["+(process.env.CURVE_V || 0.01);          // virtual ETH reserve", "+(process.env.CURVE_V || 0.2);           // virtual SOL reserve"],
    ["const isWallet = (s) => /^0x[a-fA-F0-9]{40}$/.test(s);", "const isWallet = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);"],
    ["// ---------- state (all balances in ETH) ----------", "// ---------- state (all balances in SOL) ----------"],
    ["let db = { v: 2, wallets: {}, coins: {}, txs: {}, treasuryIn: { eth: 0, n: 0 }, queue: [], protocol: { feesEth: 0, launches: 0, volume: 0, buybackEth: 0 }, feed: [] };", "let db = { v: 3, wallets: {}, coins: {}, txs: {}, treasuryIn: { sol: 0, n: 0 }, queue: [], protocol: { feesSol: 0, launches: 0, volume: 0, buybackSol: 0 }, feed: [] };"],
    ["if (old.v === 2) db = Object.assign(db, old); else console.log('ledger v' + old.v + ' predates the ETH ledger; starting fresh');", "if (old.v === 3) db = Object.assign(db, old); else console.log('ledger v' + old.v + ' predates the Solana ledger; starting fresh');"],
    ["function W(a) { a = a.toLowerCase(); return db.wallets[a] || (db.wallets[a] = { eth: 0, coins: {}, deposited: 0, hist: [] }); }", "function W(a) { return db.wallets[a] || (db.wallets[a] = { sol: 0, coins: {}, deposited: 0, hist: [] }); }"],
    ["const MARKETS = { HOOD: 'HOOD', TSLA: 'TSLA', NVDA: 'NVDA', AAPL: 'AAPL', SPY: 'SPY', COIN: 'COIN', MSTR: 'MSTR', GLD: 'GLD', BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD' };", "const MARKETS = { SOL: 'SOL-USD', BTC: 'BTC-USD', ETH: 'ETH-USD', DOGE: 'DOGE-USD', TSLA: 'TSLA', NVDA: 'NVDA', AAPL: 'AAPL', SPY: 'SPY', COIN: 'COIN', MSTR: 'MSTR', GLD: 'GLD' };"],
    ["'#00c805'", "'#14f195'"], ["'#7dff8a'", "'#9945ff'"], ["'#c9ffb0'", "'#c7b3ff'"],
    ["R = virtual ETH", "R = virtual SOL"],
    ["function fee(c, eth) { const f = eth * TRADE_FEE; c.agent.cash += f / 2; c.agent.feesIn += f / 2; db.protocol.feesEth += f / 2; return f; }", "function fee(c, sol) { const f = sol * TRADE_FEE; c.agent.cash += f / 2; c.agent.feesIn += f / 2; db.protocol.feesSol += f / 2; return f; }"],
    ["if (notional < 0.0005) continue;", "if (notional < 0.01) continue;"],
    ["if (A.cash > A.hwm + 0.0002)", "if (A.cash > A.hwm + 0.004)"],
    ["db.protocol.buybackEth += spend;", "db.protocol.buybackSol += spend;"],
    ["A.log.unshift({ ts: now, kind: 'buyback', eth: spend, coins: got, px: curvePrice(c) }); feed({ type: 'buyback', coin: c.ticker, eth: spend });", "A.log.unshift({ ts: now, kind: 'buyback', sol: spend, coins: got, px: curvePrice(c) }); feed({ type: 'buyback', coin: c.ticker, sol: spend });"],
    ["return { wallet: addr.toLowerCase(), eth: w.eth, deposited: w.deposited, coins, launched: Object.values(db.coins).filter((c) => c.creator === addr.toLowerCase()).map((c) => c.id), hist: w.hist.slice(0, 40), queue: db.queue.filter((q) => q.wallet === addr.toLowerCase()).slice(0, 10) };", "return { wallet: addr, sol: w.sol, deposited: w.deposited, coins, launched: Object.values(db.coins).filter((c) => c.creator === addr).map((c) => c.id), hist: w.hist.slice(0, 40), queue: db.queue.filter((q) => q.wallet === addr).slice(0, 10) };"],
    ["return { gov: 'CEREBRO', mint: CEREBRO_MINT, treasury: TREASURY, chain: { ok: CHAIN.ok, block: CHAIN.block, treasuryEth: CHAIN.treasuryEth, ethUsd: TAPE.ETH ? TAPE.ETH.px : null },", "return { gov: 'CEREBRO', mint: CEREBRO_MINT, depositsOpen: !!TREASURY, chain: { ok: CHAIN.ok, slot: CHAIN.slot, treasurySol: CHAIN.treasurySol, solUsd: TAPE.SOL ? TAPE.SOL.px : null },"],
    ["return json(res, 200, { error: 'connect a Robinhood Chain wallet' });", "return json(res, 200, { error: 'connect a Solana wallet' });"],
    ["const addr = d.wallet.toLowerCase(); const w = W(addr);", "const addr = d.wallet; const w = W(addr);"],
    ["if (u === '/api/deposit') {", "if (u === '/api/deposit/intent') { try { return json(res, 200, await depositIntent()); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }\n  if (u === '/api/deposit') {"],
    ["w.eth += num(d.amount) || 0;", "w.sol += num(d.amount) || 0;"],
    ["const seed = num(d.seed, w.eth); if (seed < LAUNCH_MIN) return json(res, 200, { error: 'minimum seed is ' + LAUNCH_MIN + ' ETH' + (w.eth < LAUNCH_MIN ? ' — deposit first' : '') });", "const seed = num(d.seed, w.sol); if (seed < LAUNCH_MIN) return json(res, 200, { error: 'minimum seed is ' + LAUNCH_MIN + ' SOL' + (w.sol < LAUNCH_MIN ? ' — deposit first' : '') });"],
    ["w.eth -= seed; const proto = seed * LAUNCH_FEE; db.protocol.feesEth += proto;", "w.sol -= seed; const proto = seed * LAUNCH_FEE; db.protocol.feesSol += proto;"],
    ["feed({ type: 'launch', coin: ticker, brain, eth: cash });", "feed({ type: 'launch', coin: ticker, brain, sol: cash });"],
    ["const usd = num(d.amount, w.eth); if (usd < 0.0002) return json(res, 200, { error: 'minimum 0.0002 ETH' });", "const usd = num(d.amount, w.sol); if (usd < 0.005) return json(res, 200, { error: 'minimum 0.005 SOL' });"],
    ["w.eth -= usd; const f = fee(c, usd);", "w.sol -= usd; const f = fee(c, usd);"],
    ["w.eth += gross - f;", "w.sol += gross - f;"],
    ["const x = num(d.amount, w.eth); if (x < 0.001) return json(res, 200, { error: 'minimum 0.001 ETH' }); w.eth -= x; const q = { id: id8(), wallet: addr, amt: x, asset: 'ETH',", "const x = num(d.amount, w.sol); if (x < 0.02) return json(res, 200, { error: 'minimum 0.02 SOL' }); w.sol -= x; const q = { id: id8(), wallet: addr, amt: x, asset: 'SOL',"],
    ["console.log('CEREBRO · memecoins with a brain · Robinhood Chain · :' + PORT)", "console.log('CEREBRO · memecoins with a brain · Solana · :' + PORT + (TREASURY ? '' : ' · TREASURY unset, deposits closed'))"],
  ]);
});

rw('client/src/app.js', (s) => {
  const a = s.indexOf("const CHAIN_HEX"), b = s.indexOf("const needWallet");
  const wal = `// ---------- Solana wallet (Phantom / Solflare / Backpack via window.solana) ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58dec(s) { let n = 0n; for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) throw new Error('b58'); n = n * 58n + BigInt(i); } const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; } for (const ch of s) { if (ch === '1') out.unshift(0); else break; } return new Uint8Array(out); }
function b58enc(bytes) { let n = 0n; for (const x of bytes) n = n * 256n + BigInt(x); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of bytes) { if (x === 0) s = '1' + s; else break; } return s; }
const isSolAddr = (v) => { if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return false; try { return b58dec(v).length === 32; } catch (e) { return false; } };
const sol = () => (window.phantom && window.phantom.solana) || window.solana || null;
function setConnected() { $('connect').textContent = wallet ? wallet.slice(0, 4) + '…' + wallet.slice(-4) : 'Connect'; }
async function connect() { const p = sol(); if (!p) { $('wmodal').classList.add('on'); return; } try { const r = await p.connect(); const pk = (r && r.publicKey ? r.publicKey : p.publicKey).toString(); if (!isSolAddr(pk)) throw 0; wallet = pk; localStorage.setItem('cerebro_w', wallet); setConnected(); toast('connected · Solana'); await loadAccount(); } catch (e) { toast('connection cancelled', true); } }
(function () { const p = sol(); if (p && p.on) p.on('accountChanged', (pk) => { if (pk) { wallet = pk.toString(); localStorage.setItem('cerebro_w', wallet); setConnected(); loadAccount(); } }); })();
$('connect').onclick = () => { if (wallet) { wallet = ''; localStorage.removeItem('cerebro_w'); A = null; setConnected(); renderAccount(); try { const p = sol(); if (p && p.disconnect) p.disconnect(); } catch (e) {} toast('disconnected'); } else connect(); };
$('wmodal').onclick = (e) => { if (e.target.id === 'wmodal') $('wmodal').classList.remove('on'); };
$('wsave').onclick = async () => { const v = $('waddr').value.trim(); if (!isSolAddr(v)) return toast('invalid Solana address', true); wallet = v; localStorage.setItem('cerebro_w', wallet); setConnected(); $('wmodal').classList.remove('on'); await loadAccount(); };
// build a legacy SystemProgram.transfer message by hand (no SDK): header, 3 keys, blockhash, one instruction
function transferMessage(from, to, blockhash, lamports) {
  const F = b58dec(from), T = b58dec(to), P = b58dec('11111111111111111111111111111111'), H = b58dec(blockhash);
  const data = new Uint8Array(12); new DataView(data.buffer).setUint32(0, 2, true); let v = BigInt(lamports); for (let i = 0; i < 8; i++) { data[4 + i] = Number(v & 255n); v >>= 8n; }
  return new Uint8Array([1, 0, 1, 3, ...F, ...T, ...P, ...H, 1, 2, 2, 0, 1, data.length, ...data]);
}
async function sendSol(to, blockhash, amount) {
  const p = sol(); const msg = transferMessage(wallet, to, blockhash, Math.round(amount * 1e9));
  const r = await p.request({ method: 'signAndSendTransaction', params: { message: b58enc(msg) } }); return r.signature;
}
`;
  s = s.slice(0, a) + wal + s.slice(b);
  return rep(s, [
    ["const E = (n) => (n == null || !isFinite(n)) ? '—' : (Math.abs(n) >= 100 ? (+n).toFixed(2) : Math.abs(n) >= 1 ? (+n).toFixed(4) : (+n).toFixed(5)) + ' ETH';", "const E = (n) => (n == null || !isFinite(n)) ? '—' : (Math.abs(n) >= 100 ? (+n).toFixed(2) : Math.abs(n) >= 1 ? (+n).toFixed(3) : (+n).toFixed(4)) + ' SOL';"],
    ["const px = (p) => (+p).toExponential(2) + ' ETH';", "const px = (p) => (+p).toExponential(2) + ' SOL';"],
    ["$('s-bb').textContent = E(P.buybackEth);", "$('s-bb').textContent = E(P.buybackSol);"],
    ["launched with a ${e.brain} brain and ${E(e.eth)}", "launched with a ${e.brain} brain and ${E(e.sol)}"],
    ["agent bought back ${E(e.eth)} of its coin", "agent bought back ${E(e.sol)} of its coin"],
    ["${E(l.eth)} → ${big(l.coins)}", "${E(l.sol)} → ${big(l.coins)}"],
    ["$('c-usdg').textContent = A ? E(A.eth) : '—';", "$('c-usdg').textContent = A ? E(A.sol) : '—';"],
    ["$('c-unit').textContent = side === 'buy' ? 'ETH' : c.ticker;", "$('c-unit').textContent = side === 'buy' ? 'SOL' : c.ticker;"],
    ["$('c-in').value = side === 'buy' ? A.eth :", "$('c-in').value = side === 'buy' ? A.sol :"],
    ["$('l-usdg').textContent = A ? E(A.eth) : '—';", "$('l-usdg').textContent = A ? E(A.sol) : '—';"],
    ["$('l-seed').value = Math.floor(A.eth * 1e5) / 1e5;", "$('l-seed').value = Math.floor(A.sol * 1e4) / 1e4;"],
    ["$('d-w').textContent = wallet || 'not connected'; $('d-min').textContent = S ? S.minDeposit : 0.005; $('d-tre').textContent = S ? S.treasury.slice(0, 8) + '…' + S.treasury.slice(-6) : '—';", "$('d-w').textContent = wallet || 'not connected'; $('d-min').textContent = S ? S.minDeposit : 0.1; $('d-open').textContent = S && S.depositsOpen ? 'open' : 'opening soon';"],
    ["$('d-usdg').textContent = A ? E(A.eth) : '—';", "$('d-usdg').textContent = A ? E(A.sol) : '—';"],
    ["q.tx.slice(0, 10) + '…'", "q.tx.slice(0, 8) + '…'"],
    ["const minDep = (S && S.minDeposit) || 20; if (!amount || amount < minDep) return toast('minimum deposit is ' + minDep + ' ETH', true);", "const minDep = (S && S.minDeposit) || 0.1; if (!amount || amount < minDep) return toast('minimum deposit is ' + minDep + ' SOL', true);"],
    ["const eth = evm(); if (!eth) return toast('open a wallet to send ETH, or paste a tx hash', true); if (!S || !S.treasury) return toast('treasury not configured', true);", "const p = sol(); if (!p) return toast('open a Solana wallet to send SOL, or paste a signature', true); if (!S || !S.depositsOpen) return toast('deposits are not open yet', true);"],
    ["try { await ensureChain(eth); const value = '0x' + BigInt(Math.round(amount * 1e18)).toString(16);\n    const tx = await eth.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: S.treasury, value }] }); toast('sent · waiting for the receipt…');", "try { const it = await api('/api/deposit/intent', { wallet }); if (it.error) return toast(it.error, true);\n    const tx = await sendSol(it.to, it.blockhash, amount); toast('sent · waiting for confirmation…');"],
    ["toast('still pending — paste the hash to credit later', true); } catch (e) { toast('transaction cancelled', true); }", "toast('still pending — paste the signature to credit later', true); } catch (e) { toast('transaction cancelled', true); }"],
  ]);
});

rw('client/index.html', (s) => rep(s, [
  ["On Robinhood Chain.", "On Solana."],
  ["--a:#00c805; --b:#19d81f; --c:#7dff8a; --red:#ff5c5c; --ok:#00c805; --v:#19d81f;", "--a:#14f195; --b:#9945ff; --c:#dc1fff; --red:#ff5c5c; --ok:#14f195; --v:#14f195;"],
  ["Launchpad · Robinhood Chain", "Launchpad · Solana"],
  ["Seeded and settled in ETH.", "Seeded and settled in SOL."],
  ['<span class="u" id="c-unit">ETH</span>', '<span class="u" id="c-unit">SOL</span>'],
  ['<span>your ETH</span><b id="c-usdg">', '<span>your SOL</span><b id="c-usdg">'],
  ["Seed ETH becomes the agent's treasury", "Seed SOL becomes the agent's treasury"],
  ['placeholder="seed ETH (min 0.01)" min="0.01" step="0.001"><span class="u">ETH</span>', 'placeholder="seed SOL (min 0.2)" min="0.2" step="0.01"><span class="u">SOL</span>'],
  ['<span>your ETH</span><b id="l-usdg">', '<span>your SOL</span><b id="l-usdg">'],
  ["No ETH on your desk?", "No SOL on your desk?"],
  ['<h3>Deposit ETH</h3><p style="font-size:13.5px;color:var(--dim)">Send ETH on Robinhood Chain to the treasury. It is credited to your desk once the receipt confirms. Minimum <b id="d-min">0.005</b> ETH.</p>', '<h3>Deposit SOL</h3><p style="font-size:13.5px;color:var(--dim)">Send SOL from your wallet. Your wallet builds the transfer, the server verifies it on Solana once confirmed, and your desk is credited. Minimum <b id="d-min">0.1</b> SOL.</p>'],
  ['<input id="d-in" type="number" placeholder="amount" min="0.005" step="0.001"><span class="u">ETH</span>', '<input id="d-in" type="number" placeholder="amount" min="0.1" step="0.01"><span class="u">SOL</span>'],
  ['<div class="row"><span>treasury</span><b id="d-tre">—</b></div>', '<div class="row"><span>deposits</span><b id="d-open">—</b></div>'],
  ['id="d-send" style="margin-top:10px">Send ETH from wallet</button>', 'id="d-send" style="margin-top:10px">Send SOL from wallet</button>'],
  ["Already sent? Paste the transaction hash:", "Already sent? Paste the transaction signature:"],
  ['<input id="d-tx" placeholder="0x… transaction hash" spellcheck="false">', '<input id="d-tx" placeholder="transaction signature" spellcheck="false">'],
  ['<h3>Withdraw ETH</h3><div class="field"><input id="d-wd" type="number" placeholder="amount" min="0.001" step="0.001"><span class="u">ETH</span>', '<h3>Withdraw SOL</h3><div class="field"><input id="d-wd" type="number" placeholder="amount" min="0.02" step="0.01"><span class="u">SOL</span>'],
  ['<div class="l">ETH</div><div class="n" id="d-usdg">', '<div class="l">SOL</div><div class="n" id="d-usdg">'],
  ["Your ETH seed becomes the agent's trading capital", "Your SOL seed becomes the agent's trading capital"],
  ["live prices for HOOD, TSLA, NVDA, AAPL, SPY, COIN, MSTR, GLD, BTC, ETH and SOL", "live prices for SOL, BTC, ETH, DOGE, TSLA, NVDA, AAPL, SPY, COIN, MSTR and GLD"],
  ["<i>06 · REAL ETH</i><h3>Deposits verified on-chain</h3><p>Every ETH on the ward arrived as a real transfer on Robinhood Chain that the server verified against the receipt.", "<i>06 · REAL SOL</i><h3>Deposits verified on-chain</h3><p>Every SOL on the ward arrived as a real transfer on Solana that the server verified against the confirmed transaction."],
  ["A treasury of ETH plus a strategy.", "A treasury of SOL plus a strategy."],
  ["one billion coins against a virtual ETH reserve", "one billion coins against a virtual SOL reserve"],
  ['<details><summary>Is my ETH actually deposited?</summary><div class="a">Yes. A deposit is a real <b>ETH transfer on Robinhood Chain to the treasury</b>. The server reads the transaction, checks it was sent from your wallet to the treasury address and confirmed, and only then credits your desk.</div></details>', '<details><summary>Is my SOL actually deposited?</summary><div class="a">Yes. A deposit is a real <b>SOL transfer on Solana to the protocol treasury</b>. Your wallet signs it, the server reads the confirmed transaction, checks it was signed by your wallet and landed in the treasury, and only then credits your desk. If your wallet closed before the credit landed, paste the signature and it is credited.</div></details>'],
  ['<details><summary>How do I get ETH out?</summary><div class="a">Sell coins for ETH on the curve,', '<details><summary>How do I get SOL out?</summary><div class="a">Sell coins for SOL on the curve,'],
  ["with the payout hash written next to your request.", "with the payout signature written next to your request."],
  ['<details><summary>Which chain and wallet?</summary><div class="a"><b>Robinhood Chain</b> (chainId 4663). Connect any EVM wallet such as MetaMask or Rabby; the site switches the network for you. ETH, the native gas token, is the only asset that moves.</div></details>', '<details><summary>Which chain and wallet?</summary><div class="a"><b>Solana</b> mainnet. Connect Phantom, Solflare or Backpack. SOL is the only asset that moves: seeds, curves, fees and buybacks are all in SOL, and $CEREBRO is an SPL token.</div></details>'],
  ["<footer><span>CEREBRO · memecoins with a brain · Robinhood Chain · 4663</span>", "<footer><span>CEREBRO · memecoins with a brain · Solana</span>"],
  ['<p>No EVM wallet detected. Paste a Robinhood Chain address to open your desk, or install MetaMask or Rabby to connect directly.</p><div class="field"><input id="waddr" placeholder="0x… Robinhood Chain address"', '<p>No Solana wallet detected. Paste a Solana address to open your desk, or install Phantom to connect directly.</p><div class="field"><input id="waddr" placeholder="Solana address"'],
]));
console.log('ported');
