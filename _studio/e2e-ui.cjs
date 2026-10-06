// Real-UI E2E with a mock Phantom holding a real ed25519 key: connect → signed session → launch via the form → buy via the coin page
// → deposit builds a correct SystemProgram transfer to the treasury. Also: no wallet → "Open in Phantom" deep link.
'use strict';
const path = require('path'); const os = require('os'); const http = require('http'); const crypto = require('crypto'); const { spawn } = require('child_process'); const { open, sleep } = require('./cdp.cjs');
const PORT = 8243, B = 'http://localhost:' + PORT, SIGNER = 8244;
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (buf) => { let n = BigInt('0x' + Buffer.from(buf).toString('hex')), s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of buf) { if (x === 0) s = '1' + s; else break; } return s; };
const b58d = (str) => { let n = 0n; for (const ch of str) n = n * 58n + BigInt(B58.indexOf(ch)); const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; } for (const ch of str) { if (ch === '1') out.unshift(0); else break; } return Buffer.from(out); };
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'); const ME = b58(publicKey.export({ format: 'der', type: 'spki' }).subarray(12));
const TRE = b58(crypto.generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(12));
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  · ' + x : '')); };
const signer = http.createServer((req, res) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); if (req.method === 'OPTIONS') return res.end(); const { hex } = JSON.parse(b || '{}'); res.end(JSON.stringify({ sig: [...crypto.sign(null, Buffer.from(hex, 'hex'), privateKey)] })); }); }).listen(SIGNER);
const MOCK = `(()=>{const pk={toString:()=>'${ME}',toBase58:()=>'${ME}'};const p={isPhantom:true,publicKey:null,_l:{},on(e,f){(this._l[e]=this._l[e]||[]).push(f)},
 async connect(){this.publicKey=pk;window.__calls=(window.__calls||[]).concat('connect');return {publicKey:pk}},async disconnect(){},
 async signMessage(bytes){window.__calls=(window.__calls||[]).concat('signMessage');const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');const r=await fetch('http://localhost:${SIGNER}',{method:'POST',body:JSON.stringify({hex})}).then(r=>r.json());return {signature:new Uint8Array(r.sig),publicKey:pk}},
 async request({method,params}){window.__calls=(window.__calls||[]).concat(method);if(method==='signAndSendTransaction'){window.__msg=params.message;return {signature:'5'.repeat(88)}}throw new Error('unsupported '+method)}};
 window.phantom={solana:p};window.solana=p;})();`;
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'dev.js')], { env: { ...process.env, PORT: String(PORT), TREASURY: TRE, DATA_PATH: path.join(os.tmpdir(), 'cer-ui-' + Date.now() + '.json') }, stdio: 'ignore' });
  let c, c2;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(B + '/api/state')).ok) break; } catch {} await sleep(200); }
    for (let i = 0; i < 25; i++) { const s = await (await fetch(B + '/api/state')).json(); if (s.tape.some((t) => t.fresh)) break; await sleep(1000); }
    await fetch(B + '/api/dev/faucet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: ME, amount: 5 }) });
    c = await open('about:blank', 1440, 900, 9741); await c.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK }); await c.send('Page.navigate', { url: B + '/' }); await sleep(4000);
    await c.ev(`document.getElementById('connect').click()`); await sleep(2500);
    const st = await c.ev(`({btn:document.getElementById('connect').textContent,auth:!!localStorage.getItem('cerebro_auth_${ME}'),calls:window.__calls})`);
    ok('Phantom connected + session signed', st.btn.startsWith(ME.slice(0, 4)) && st.auth && st.calls.includes('signMessage'), st.btn);
    await c.send('Page.navigate', { url: B + '/#launch' }); await sleep(3000);
    await c.ev(`(()=>{const v=(i,x)=>{const e=document.getElementById(i);e.value=x;e.dispatchEvent(new Event('input'))};v('l-name','Testbrain');v('l-tk','TBRN');v('l-seed','1');document.getElementById('l-go').click()})()`); await sleep(2500);
    const toast1 = await c.ev(`document.getElementById('toast').textContent`);
    const acc = await (await fetch(B + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: ME }) })).json();
    ok('launched a coin through the form', acc.launched.length === 1, toast1);
    const id = acc.launched[0];
    await c.send('Page.navigate', { url: B + '/c/' + id }); await sleep(3500);
    await c.ev(`(()=>{const e=document.getElementById('c-in');e.value='0.5';e.dispatchEvent(new Event('input'));document.getElementById('c-act').click()})()`); await sleep(2500);
    const acc2 = await (await fetch(B + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: ME }) })).json();
    ok('bought the coin from its page', acc2.coins.some((x) => x.id === id && x.qty > 0), 'SOL left ' + acc2.sol.toFixed(4));
    await c.send('Page.navigate', { url: B + '/#desk' }); await sleep(3000);
    await c.ev(`(()=>{const e=document.getElementById('d-in');e.value='0.2';e.dispatchEvent(new Event('input'));document.getElementById('d-send').click()})()`); await sleep(2500);
    const msg = await c.ev(`window.__msg||''`); let good = false, info = 'no tx';
    if (msg) { const m = b58d(msg); const from = b58(m.subarray(4, 36)), to = b58(m.subarray(36, 68)); const data = m.subarray(m.length - 12); const lam = Number(data.readBigUInt64LE(4)); good = from === ME && to === TRE && lam === 0.2e9 && data.readUInt32LE(0) === 2; info = 'from me → treasury, ' + lam / 1e9 + ' SOL'; }
    ok('deposit builds a SystemProgram transfer to the treasury', good, info);
    c2 = await open(B + '/', 390, 800, 9742); await sleep(3500); await c2.ev(`document.getElementById('connect').click()`); await sleep(600);
    const link = await c2.ev(`(document.getElementById('phantomLink')||{}).href||''`); ok('no wallet → Open in Phantom deep link', /phantom\.app\/ul\/browse\//.test(link), link.slice(0, 70));
  } catch (e) { console.error(e); fail++; } finally { if (c) c.close(); if (c2) c2.close(); srv.kill(); signer.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
