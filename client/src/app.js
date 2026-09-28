'use strict';
const $ = (id) => document.getElementById(id);
const api = (u, b) => fetch(u, b ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const E = (n) => (n == null || !isFinite(n)) ? '—' : (Math.abs(n) >= 100 ? (+n).toFixed(2) : Math.abs(n) >= 1 ? (+n).toFixed(3) : (+n).toFixed(4)) + ' SOL';
const fmt = (n, d = 2) => (n == null || !isFinite(n)) ? '—' : (+n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const big = (n) => Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + 'M' : Math.abs(n) >= 1e3 ? fmt(n / 1e3, 1) + 'K' : fmt(n, 0);
const px = (p) => (+p).toExponential(2) + ' SOL';
const ago = (ts) => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? Math.floor(s) + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; };
const sgn = (n, d = 2) => (n >= 0 ? '+' : '') + fmt(n, d);
function toast(m, err) { const t = $('toast'); t.textContent = m; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 2600); }

let S = null, A = null, coin = null, coinId = '', side = 'buy', chartMode = 'eq', brain = 'MOMENTUM';
let wallet = localStorage.getItem('cerebro_w') || '';
// ---------- Solana wallet (Phantom / Solflare / Backpack via window.solana) ----------
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
const needWallet = () => { if (!wallet) { connect(); return true; } return false; };

// ---------- router ----------
function go(v, id) { if (v === 'coin') { coinId = id; loadCoin(); } document.querySelectorAll('.view').forEach((s) => s.classList.toggle('on', s.dataset.view === v)); document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === v)); history.replaceState(null, '', v === 'coin' ? '/c/' + id : v === 'home' ? '/' : '/#' + v); window.scrollTo(0, 0); if (v === 'launch') renderLaunch(); }
document.querySelectorAll('[data-view]').forEach((b) => { if (b.tagName === 'BUTTON') b.onclick = () => go(b.dataset.view); });
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = (e) => { e.preventDefault(); go(b.dataset.go); });

// ---------- canvas helpers ----------
function line(cv, series, opts = {}) {
  const dpr = window.devicePixelRatio || 1; const W = cv.clientWidth, H = cv.clientHeight; if (!W) return; cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const all = series.flatMap((s) => s.pts.map((p) => p[1])); if (!all.length) return; let lo = Math.min(...all), hi = Math.max(...all); if (hi - lo < 1e-9) { hi = lo * 1.01 + 1e-9; lo = lo * 0.99; } const pad = (hi - lo) * .12; lo -= pad; hi += pad;
  const t0 = Math.min(...series.flatMap((s) => s.pts.map((p) => p[0]))), t1 = Math.max(...series.flatMap((s) => s.pts.map((p) => p[0]))) || t0 + 1;
  if (opts.base != null) { const y = H - (opts.base - lo) / (hi - lo) * H; g.strokeStyle = opts.baseColor || '#2e2646'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]); }
  for (const s of series) { g.strokeStyle = s.color; g.lineWidth = s.w || 1.8; g.lineJoin = 'round'; g.beginPath(); s.pts.forEach((p, i) => { const x = (p[0] - t0) / (t1 - t0) * (W - 4) + 2, y = H - (p[1] - lo) / (hi - lo) * (H - 4) - 2; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    if (opts.glow) { g.shadowColor = s.color; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0; }
    const last = s.pts[s.pts.length - 1]; if (last) { const x = (last[0] - t0) / (t1 - t0) * (W - 4) + 2, y = H - (last[1] - lo) / (hi - lo) * (H - 4) - 2; g.fillStyle = s.color; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); } }
}

// ---------- state ----------
async function loadState() { S = await api('/api/state'); renderState(); if (coinId && document.querySelector('.view[data-view=coin]').classList.contains('on')) loadCoin(); }
function renderState() {
  if (!S) return; const P = S.protocol;
  $('s-agents').textContent = P.agents; $('s-eq').textContent = E(P.agentsEquity); $('s-bb').textContent = E(P.buybackSol); $('s-vol').textContent = E(P.volume); $('s-launch').textContent = P.launches;
  $('live').textContent = S.tape.filter((t) => t.fresh).length + ' / ' + S.tape.length + ' LIVE'; $('mon-n').textContent = P.agents + ' AGENTS · ' + new Date(S.t).toISOString().slice(11, 19) + 'Z';
  $('tape').innerHTML = S.tape.map((t) => `<div class="m ${t.fresh ? '' : 'closed'}"><div class="s">${t.sym}</div><div class="p">${t.px ? (t.px >= 100 ? '$' + fmt(t.px, 0) : '$' + fmt(t.px, 2)) : '—'}</div><div class="d ${t.d1 >= 0 ? 'up' : 'dn'}">${t.fresh ? sgn(t.d1 * 100, 1) + '%' : 'closed'}</div></div>`).join('');
  if (S.mint) { $('cabar').style.display = 'flex'; $('ca-mint').textContent = S.mint; }
  const grid = $('grid'); grid.innerHTML = S.coins.length ? S.coins.map((c, i) => { const ret = c.agent.equity / c.agent.seed - 1; return `<div class="chart" data-id="${c.id}"><span class="rank">#${i + 1}</span><div class="hd"><span class="tk">${c.ticker}</span><span class="nm">${c.name}</span><span class="br" style="background:${c.color}">${c.brainName}</span></div><canvas data-cv="${c.id}"></canvas><div class="kv"><div><small>equity</small>${E(c.agent.equity)}</div><div><small>since seed</small><span class="${ret >= 0 ? 'up' : 'dn'}">${sgn(ret * 100, 1)}%</span></div><div><small>mcap</small>${E(c.mcap)}</div></div>${c.agent.thought ? '<div class="th">“' + c.agent.thought.text.slice(0, 120) + (c.agent.thought.text.length > 120 ? '…' : '') + '”</div>' : ''}</div>`; }).join('') : '<div class="panel" style="grid-column:1/-1;text-align:center;color:var(--dim)">No agents on the ward yet. <a href="#" data-go="launch">Launch the first one →</a></div>';
  grid.querySelectorAll('.chart').forEach((el) => el.onclick = () => go('coin', el.dataset.id)); grid.querySelectorAll('[data-go]').forEach((b) => b.onclick = (e) => { e.preventDefault(); go(b.dataset.go); });
  for (const c of S.coins) { const cv = document.querySelector(`canvas[data-cv="${c.id}"]`); if (cv) line(cv, [{ pts: c.agent.curve, color: c.color, w: 2 }], { base: c.agent.seed }); }
  // ward monitor: every agent, normalised to seed = 100
  const mon = $('mon'); if (S.coins.length) { line(mon, S.coins.slice(0, 8).map((c) => ({ pts: c.agent.curve.map((p) => [p[0], p[1] / c.agent.seed * 100]), color: c.color, w: 1.6 })), { base: 100, baseColor: '#2e2646', glow: true }); $('mon-legend').innerHTML = S.coins.slice(0, 8).map((c) => `<span><i style="background:${c.color}"></i>${c.ticker} ${sgn((c.agent.equity / c.agent.seed - 1) * 100, 1)}%</span>`).join(''); }
  else { const g = mon.getContext('2d'); mon.width = mon.clientWidth; mon.height = mon.clientHeight; g.strokeStyle = '#9945ff'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < mon.width; x++) { const y = mon.height / 2 + (x % 90 > 40 && x % 90 < 52 ? Math.sin((x % 90 - 40) / 12 * Math.PI) * 60 : 0); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); $('mon-legend').innerHTML = '<span>flatline · no agents yet</span>'; }
  $('feed').innerHTML = S.feed.map((e) => `<div class="r"><span>${ago(e.ts)}</span><span>${e.type === 'launch' ? `<b>${e.coin}</b> launched with a ${e.brain} brain and ${E(e.sol)}` : e.type === 'buyback' ? `<b>${e.coin}</b> agent bought back ${E(e.sol)} of its coin` : e.type}</span></div>`).join('') || '<div class="r"><span>—</span><span>quiet ward</span></div>';
}

// ---------- coin ----------
async function loadCoin() { if (!coinId) return; coin = await api('/api/coin', { id: coinId }); if (coin.error) { toast(coin.error, true); return go('home'); } renderCoin(); }
function renderCoin() {
  const c = coin; if (!c) return; const a = c.agent;
  $('c-tk').textContent = c.ticker; $('c-nm').textContent = c.name; $('c-br').textContent = c.brainName; $('c-br').style.background = c.color; $('c-by').textContent = 'launched by ' + c.creator + ' · ' + ago(c.ts) + ' ago';
  $('c-eq').textContent = E(a.equity); const ret = a.equity / a.seed - 1; $('c-ret').textContent = sgn(ret * 100, 1) + '%'; $('c-ret').className = 'n ' + (ret >= 0 ? 'up' : 'dn'); $('c-bb').textContent = E(a.boughtBack); $('c-wr').textContent = a.trades ? fmt(a.wins / Math.max(1, Math.floor(a.trades / 2)) * 100, 0) + '%' : '—';
  const cv = $('c-canvas'); if (chartMode === 'eq') line(cv, [{ pts: a.curve, color: c.color, w: 2.2 }], { base: a.seed, glow: true }); else line(cv, [{ pts: c.trades.slice().reverse().map((t) => [t.ts, t.px]).concat([[Date.now(), c.price]]), color: '#f1eefa', w: 2 }]);
  $('c-thoughts').innerHTML = (a.thoughts || []).slice(0, 6).map((t) => `<div class="thought">${t.text}<small>${new Date(t.ts).toISOString().replace('T', ' ').slice(0, 19)}Z · equity ${E(t.equity)}</small></div>`).join('') || '<p style="color:var(--dim)">Waiting on the tape.</p>';
  $('c-pos').innerHTML = a.positions.map((p) => `<div class="pos"><b>${p.sym}</b><span>${p.side}</span><span style="color:var(--mut)">${E(p.notional)} @ $${fmt(p.entry, 2)} → $${fmt(p.px, 2)}</span><span class="pnl ${p.pnl >= 0 ? 'up' : 'dn'}">${sgn(p.pnl, 5)}</span></div>`).join('') || '<p style="color:var(--dim);font-size:13px">Flat. In cash.</p>';
  $('c-log').innerHTML = (a.log || []).map((l) => `<div class="r"><span>${ago(l.ts)}</span><span>${l.kind === 'open' ? `opened ${l.side} ${l.sym} ${E(l.notional)} @ $${fmt(l.px, 2)}` : l.kind === 'close' ? `closed ${l.side} ${l.sym} <span class="${l.pnl >= 0 ? 'up' : 'dn'}">${sgn(l.pnl, 5)}</span> · ${l.why}` : `<span class="v">bought back</span> ${E(l.sol)} → ${big(l.coins)} ${c.ticker}`}</span></div>`).join('') || '<div class="r"><span>—</span><span>no trades yet</span></div>';
  $('a-brain').textContent = c.brainName; $('a-seed').textContent = E(a.seed); $('a-cash').textContent = E(a.cash); $('a-fees').textContent = E(a.feesIn); $('a-tr').textContent = a.trades + ' · ' + a.wins; $('a-hwm').textContent = E(a.hwm); $('a-bc').textContent = big(a.boughtCoins) + ' ' + c.ticker; $('a-line').textContent = (S && S.brains.find((b) => b.id === c.brain) || {}).line || '';
  $('c-trades').innerHTML = (c.trades || []).slice(0, 15).map((t) => `<div class="r"><span>${ago(t.ts)}</span><span class="${t.side === 'buy' ? 'up' : 'dn'}">${t.side}</span><span>${E(t.usd)} · ${big(t.coins)} @ ${px(t.px)}</span></div>`).join('') || '<div class="r"><span>—</span><span>no trades yet</span></div>';
  $('c-px').textContent = px(c.price); $('c-mc').textContent = E(c.mcap); renderTrade();
}
function renderTrade() { const c = coin; if (!c) return; const hold = A ? ((A.coins.find((x) => x.id === c.id) || {}).qty || 0) : 0; $('c-usdg').textContent = A ? E(A.sol) : '—'; $('c-hold').textContent = big(hold) + ' ' + c.ticker; $('c-unit').textContent = side === 'buy' ? 'SOL' : c.ticker; $('c-act').textContent = side === 'buy' ? 'Buy ' + c.ticker : 'Sell ' + c.ticker; $('t-buy').classList.toggle('on', side === 'buy'); $('t-sell').classList.toggle('on', side === 'sell'); const v = +$('c-in').value || 0; $('c-out').textContent = side === 'buy' ? big(v * 0.99 / c.price) + ' ' + c.ticker + ' (est.)' : E(v * c.price * 0.99) + ' (est.)'; }
$('t-buy').onclick = () => { side = 'buy'; renderTrade(); }; $('t-sell').onclick = () => { side = 'sell'; renderTrade(); }; $('c-in').oninput = renderTrade;
$('c-mx').onclick = () => { if (!A || !coin) return; $('c-in').value = side === 'buy' ? A.sol : ((A.coins.find((x) => x.id === coin.id) || {}).qty || 0); renderTrade(); };
$('c-act').onclick = async () => { if (needWallet()) return; const v = +$('c-in').value; if (!v) return toast('enter an amount', true); const r = await api('/api/' + side, { wallet, id: coinId, amount: v }); if (r.error) return toast(r.error, true); A = r; coin = Object.assign(coin, r.coin); renderAccount(); loadCoin(); loadState(); toast(side === 'buy' ? `bought ${big(r.got)} ${coin.ticker}` : `sold for ${E(r.usd)}`); };
$('cv-eq').onclick = () => { chartMode = 'eq'; $('cv-eq').className = 'btn sm'; $('cv-px').className = 'btn sm ghost'; renderCoin(); }; $('cv-px').onclick = () => { chartMode = 'px'; $('cv-px').className = 'btn sm'; $('cv-eq').className = 'btn sm ghost'; renderCoin(); };

// ---------- launch ----------
function renderLaunch() { if (!S) return; $('brains').innerHTML = S.brains.map((b) => `<div class="brain ${b.id === brain ? 'on' : ''}" data-b="${b.id}"><b><i style="background:${b.color}"></i>${b.name}</b><p>${b.line}</p></div>`).join(''); document.querySelectorAll('.brain').forEach((el) => el.onclick = () => { brain = el.dataset.b; renderLaunch(); }); $('l-usdg').textContent = A ? E(A.sol) : '—'; const s = +$('l-seed').value || 0; $('l-tre').textContent = s ? E(s * 0.95) + ' (after 5% protocol fee)' : '—'; }
$('l-seed').oninput = renderLaunch; $('l-mx').onclick = () => { if (A) { $('l-seed').value = Math.floor(A.sol * 1e4) / 1e4; renderLaunch(); } };
$('l-go').onclick = async () => { if (needWallet()) return; const r = await api('/api/launch', { wallet, name: $('l-name').value, ticker: $('l-tk').value, brain, seed: +$('l-seed').value }); if (r.error) return toast(r.error, true); A = r; toast(`${r.coin.ticker} is alive`); await loadState(); go('coin', r.coin.id); };

// ---------- desk ----------
async function loadAccount() { if (!wallet) { A = null; renderAccount(); return; } A = await api('/api/account', { wallet }); if (A.error) { toast(A.error, true); A = null; } renderAccount(); }
function renderAccount() {
  $('d-w').textContent = wallet || 'not connected'; $('d-min').textContent = S ? S.minDeposit : 0.1; $('d-open').textContent = S && S.depositsOpen ? 'open' : 'opening soon';
  $('d-usdg').textContent = A ? E(A.sol) : '—'; $('d-dep').textContent = A ? E(A.deposited) : '—'; $('d-val').textContent = A ? E(A.coins.reduce((a, c) => a + c.value, 0)) : '—';
  $('d-coins').innerHTML = A && A.coins.length ? A.coins.map((c) => `<div class="row"><span><a href="#" data-coin="${c.id}"><b>${c.ticker}</b></a> ${c.name}</span><b>${big(c.qty)} · ${E(c.value)}</b></div>`).join('') : '<p style="color:var(--dim);font-size:13px">No coins yet.</p>';
  $('d-launch').innerHTML = A && A.launched.length ? A.launched.map((id) => { const c = S && S.coins.find((x) => x.id === id); return c ? `<div class="row"><span><a href="#" data-coin="${id}"><b>${c.ticker}</b></a> ${c.brainName}</span><b>${E(c.agent.equity)}</b></div>` : ''; }).join('') : '<p style="color:var(--dim);font-size:13px">Nothing launched yet.</p>';
  $('d-hist').innerHTML = A && A.hist.length ? A.hist.map((h) => `<div class="r"><span>${ago(h.ts)}</span><span>${h.type}${h.coin ? ' ' + h.coin : ''} · ${E(h.amt)}</span></div>`).join('') : '<div class="r"><span>—</span><span>nothing yet</span></div>';
  $('d-queue').innerHTML = A && A.queue.length ? A.queue.map((q) => `<div class="row"><span>withdraw ${E(q.amt)} · ${q.id}</span><b>${q.status === 'paid' ? 'paid' + (q.tx ? ' · ' + q.tx.slice(0, 8) + '…' : '') : 'queued'}</b></div>`).join('') : '';
  document.querySelectorAll('[data-coin]').forEach((a) => a.onclick = (e) => { e.preventDefault(); go('coin', a.dataset.coin); });
  renderTrade(); if (document.querySelector('.view[data-view=launch]').classList.contains('on')) renderLaunch();
}
$('d-credit').onclick = async () => { if (needWallet()) return; const r = await api('/api/deposit', { wallet, tx: ($('d-tx').value || '').trim() }); if (r.error) return toast(r.error, true); A = r; renderAccount(); toast(`credited ${E(r.amt)}`); };
$('d-wdgo').onclick = async () => { if (needWallet()) return; const r = await api('/api/withdraw', { wallet, amount: +$('d-wd').value }); if (r.error) return toast(r.error, true); A = r; renderAccount(); toast('withdrawal queued'); };
$('d-send').onclick = async () => {
  if (needWallet()) return; const amount = +$('d-in').value; const minDep = (S && S.minDeposit) || 0.1; if (!amount || amount < minDep) return toast('minimum deposit is ' + minDep + ' SOL', true);
  const p = sol(); if (!p) return toast('open a Solana wallet to send SOL, or paste a signature', true); if (!S || !S.depositsOpen) return toast('deposits are not open yet', true);
  try { const it = await api('/api/deposit/intent', { wallet }); if (it.error) return toast(it.error, true);
    const tx = await sendSol(it.to, it.blockhash, amount); toast('sent · waiting for confirmation…');
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 3000)); const r = await api('/api/deposit', { wallet, tx }); if (r.ok) { A = r; renderAccount(); return toast(`credited ${E(r.amt)}`); } if (r.error && !/pending|not found/.test(r.error)) return toast(r.error, true); }
    toast('still pending — paste the signature to credit later', true); } catch (e) { toast('transaction cancelled', true); }
};
$('ca-copy').onclick = () => { navigator.clipboard.writeText(S.mint); toast('copied'); };

// ---------- boot ----------
(async function () { setConnected(); await loadState(); await loadAccount(); const m = /^\/c\/([A-Za-z0-9]+)/.exec(location.pathname); const h = (location.hash || '').slice(1); if (m) go('coin', m[1]); else if (['launch', 'desk', 'how'].includes(h)) go(h); setInterval(loadState, 5000); addEventListener('resize', renderState); })();
