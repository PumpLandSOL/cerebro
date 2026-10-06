// one-shot: Phantom-signed sessions on every action that moves SOL; mobile Phantom deep link; real error text. (run once)
'use strict';
const fs = require('fs'); const path = require('path');
const SF = path.join(__dirname, '..', 'server', 'index.js'), AF = path.join(__dirname, '..', 'client', 'src', 'app.js'), HF = path.join(__dirname, '..', 'client', 'index.html');
let s = fs.readFileSync(SF, 'utf8'), a = fs.readFileSync(AF, 'utf8'), h = fs.readFileSync(HF, 'utf8');
if (s.includes('requireSess')) throw new Error('already patched');
const rep = (src, x, y) => { if (!src.includes(x)) throw new Error('missing: ' + x.slice(0, 70)); return src.split(x).join(y); };

// ---------- server: ed25519 session verification (Solana wallets sign with ed25519) ----------
s = rep(s, "const isWallet = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);", `const isWallet = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
function b58dec(str) { let n = 0n; for (const ch of str) { const i = B58.indexOf(ch); if (i < 0) throw new Error('b58'); n = n * 58n + BigInt(i); } const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; } for (const ch of str) { if (ch === '1') out.unshift(0); else break; } return Buffer.from(out); }
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');
const SESSIONS = new Map();
const sessionMsg = (w, exp) => ['CEREBRO desk session', 'Wallet: ' + w, 'Expires: ' + exp, 'Signing is free and moves no funds.'].join('\\n');
function requireSess(w, auth) {
  if (!auth || !auth.sig || !auth.exp) throw 'sign in with your wallet first';
  const exp = +auth.exp; if (!(exp > Date.now())) throw 'session expired, sign in again'; if (exp > Date.now() + 8 * 864e5) throw 'bad session';
  const key = w + ':' + exp + ':' + auth.sig; if (SESSIONS.get(key)) return true;
  let ok = false; try { const pk = b58dec(w); const sig = b58dec(auth.sig); if (pk.length !== 32 || sig.length !== 64) throw 0;
    ok = require('crypto').verify(null, Buffer.from(sessionMsg(w, exp), 'utf8'), require('crypto').createPublicKey({ key: Buffer.concat([SPKI_ED25519, pk]), format: 'der', type: 'spki' }), sig); } catch (e) { throw 'bad signature'; }
  if (!ok) throw 'signature is not from this wallet';
  if (SESSIONS.size > 5000) SESSIONS.clear(); SESSIONS.set(key, 1); return true;
}`);
s = rep(s, "  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }",
`  if (req.method === 'GET' && u === '/api/session') { const w = new URL(req.url, 'http://x').searchParams.get('wallet') || ''; if (!isWallet(w)) return json(res, 200, { error: 'bad wallet' }); const exp = Date.now() + 7 * 864e5; return json(res, 200, { exp, message: sessionMsg(w, exp) }); }
  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }`);
s = rep(s, "  const addr = d.wallet; const w = W(addr);\n",
"  const addr = d.wallet; const w = W(addr);\n  if (['/api/launch', '/api/buy', '/api/sell', '/api/withdraw'].includes(u)) { try { requireSess(addr, d.auth); } catch (e) { return json(res, 200, { error: String(e), auth: true }); } }\n");
fs.writeFileSync(SF, s);

// ---------- client ----------
a = rep(a, "const api = (u, b) => fetch(u, b ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : undefined).then((r) => r.json());",
`const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
async function api(u, b) {
  if (!b) return fetch(u).then((r) => r.json());
  const withAuth = () => (b.wallet && typeof wallet !== 'undefined' && b.wallet === wallet ? Object.assign({}, b, { auth: getAuth() }) : b);
  let r = await post(u, withAuth());
  if (r && r.auth) { const ok = await signIn(); if (ok) r = await post(u, withAuth()); }
  return r;
}`);
a = rep(a, "async function connect() { const p = sol(); if (!p) { $('wmodal').classList.add('on'); return; } try { const r = await p.connect(); const pk = (r && r.publicKey ? r.publicKey : p.publicKey).toString(); if (!isSolAddr(pk)) throw 0; wallet = pk; localStorage.setItem('cerebro_w', wallet); setConnected(); toast('connected · Solana'); await loadAccount(); } catch (e) { toast('connection cancelled', true); } }",
`const errText = (e) => { const m = (e && (e.message || (e.error && e.error.message))) || String(e || ''); if ((e && e.code === 4001) || /reject|denied|cancel/i.test(m)) return 'request rejected in your wallet'; return m.slice(0, 120) || 'wallet error'; };
// signed session: one free message signature proves you own this desk. Nothing that moves SOL works without it.
const AKEY = () => 'cerebro_auth_' + wallet;
function getAuth() { try { const x = JSON.parse(localStorage.getItem(AKEY()) || 'null'); return x && x.exp > Date.now() + 6e4 ? x : null; } catch (e) { return null; } }
async function signIn() {
  if (!wallet) return false; if (getAuth()) return true; const p = sol();
  if (!p || !p.signMessage) { toast('connect Phantom to sign in (a pasted address is view-only)', true); return false; }
  try { const m = await (await fetch('/api/session?wallet=' + wallet)).json(); if (m.error) throw new Error(m.error);
    toast('sign the message in your wallet to unlock your desk (free, no transaction)');
    const r = await p.signMessage(new TextEncoder().encode(m.message), 'utf8'); const sig = r && (r.signature || r);
    localStorage.setItem(AKEY(), JSON.stringify({ exp: m.exp, sig: b58enc(new Uint8Array(sig)) })); return true;
  } catch (e) { toast(errText(e), true); return false; }
}
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
async function connect() { const p = sol(); if (!p) { $('wmodal').classList.add('on'); return; } try { const r = await p.connect(); const pk = (r && r.publicKey ? r.publicKey : p.publicKey).toString(); if (!isSolAddr(pk)) throw new Error('wallet returned no Solana address'); wallet = pk; localStorage.setItem('cerebro_w', wallet); setConnected(); await signIn(); toast('connected · Solana'); await loadAccount(); } catch (e) { toast(errText(e), true); } }`);
a = rep(a, "$('connect').onclick = () => { if (wallet) { wallet = ''; localStorage.removeItem('cerebro_w');", "$('connect').onclick = () => { if (wallet) { localStorage.removeItem(AKEY()); wallet = ''; localStorage.removeItem('cerebro_w');");
fs.writeFileSync(AF, a);

// no wallet in this browser (usually a phone): offer to reopen CEREBRO inside Phantom
h = rep(h, '<p>No Solana wallet detected. Paste a Solana address to open your desk, or install Phantom to connect directly.</p>',
  `<p>No Solana wallet in this browser. Open CEREBRO inside Phantom to connect, or paste an address to view a desk (read-only).</p><a class="btn fill wide" id="phantomLink" style="display:block;text-align:center;margin:12px 0" href="#">Open in Phantom</a><script>(function(){var u=location.href;document.getElementById('phantomLink').href='https://phantom.app/ul/browse/'+encodeURIComponent(u)+'?ref='+encodeURIComponent(location.origin);})();</script>`);
fs.writeFileSync(HF, h); console.log('auth patched');
