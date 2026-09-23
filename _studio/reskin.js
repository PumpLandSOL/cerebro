// one-shot: HUSH aesthetic (void black, iridescent accent, aurora, blur-glass panels, Michroma/Sora) on the launchpad layout. Already applied; do not re-run.
const fs = require('fs'), path = require('path'); const R = path.join(__dirname, '..');
let s = fs.readFileSync(path.join(R, 'client/index.html'), 'utf8');
const i = s.indexOf('<style>'), j = s.indexOf('</style>') + 8;
const css = `<style>
:root{
  --void:#07070a; --hull:#0e0e13; --hull2:#15151c; --edge:#262631; --edge2:#3a3a4a;
  --ink:#f1f0f6; --dim:#9d9bad; --mut:#64627a;
  --a:#7df9e1; --b:#9d7bff; --c:#ff7bd5; --red:#ff6b81; --ok:#7df9e1; --v:#9d7bff; --amber:#ffd27b;
  --iri:linear-gradient(100deg,var(--a),var(--b) 50%,var(--c)); --cut:14px;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Sora',sans-serif;font-weight:300;background:var(--void);color:var(--ink);font-size:14.5px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}
.mono{font-family:'Sora',sans-serif;font-weight:500}
.mi{font-family:'Michroma',sans-serif;text-transform:uppercase;letter-spacing:.14em}
.iri{background:var(--iri);-webkit-background-clip:text;background-clip:text;color:transparent}
.v{color:var(--b)}
.lab{font-family:'Michroma';font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--mut)}
.amb{position:fixed;inset:-20%;z-index:-2;filter:blur(90px);opacity:.34;background:radial-gradient(38% 34% at 22% 30%,var(--b),transparent 70%),radial-gradient(30% 30% at 78% 22%,var(--a),transparent 70%),radial-gradient(34% 36% at 62% 84%,var(--c),transparent 70%);animation:drift 38s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate3d(4%,-3%,0) rotate(8deg) scale(1.08)}}
.scan{position:fixed;inset:0;z-index:-1;pointer-events:none;background:repeating-linear-gradient(0deg,#ffffff05 0 1px,transparent 1px 4px)}
@media(prefers-reduced-motion:reduce){.amb{animation:none}}

header{position:sticky;top:0;z-index:40;background:#07070acc;backdrop-filter:blur(18px);border-bottom:1px solid var(--edge)}
.hin{max-width:1280px;margin:0 auto;padding:0 20px;height:60px;display:flex;align-items:center;gap:16px}
.logo{display:flex;align-items:center;gap:11px;font-family:'Michroma';font-size:16px;letter-spacing:.32em}
.logo i{width:26px;height:26px;border-radius:50%;position:relative;display:block;background:conic-gradient(from 0deg,var(--a),var(--b),var(--c),var(--a))}
.logo i::before{content:"";position:absolute;inset:6px;border-radius:50%;background:var(--void)}
.logo i::after{content:"";position:absolute;inset:9px;border-radius:50%;background:var(--iri)}
nav.tabs{display:flex;gap:2px;margin-left:14px}
nav.tabs button{background:none;border:none;font-family:'Sora';font-weight:400;font-size:13px;color:var(--mut);padding:8px 12px;cursor:pointer;position:relative}
nav.tabs button.on{color:var(--ink)}nav.tabs button.on::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:2px;background:var(--iri)}
.hr{margin-left:auto;display:flex;gap:12px;align-items:center}
.hr a{font-size:12px;color:var(--dim);text-decoration:none}
.live{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:.14em;color:var(--mut);text-transform:uppercase}
.live::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--a);box-shadow:0 0 10px var(--a);animation:pulse 1.6s infinite}
@keyframes pulse{50%{box-shadow:0 0 0 5px #7df9e122}}

.btn{font-family:'Sora';font-weight:500;font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border:none;background:var(--hull2);color:var(--ink);padding:12px 18px;transition:.15s;clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px);box-shadow:inset 0 0 0 1px var(--edge2)}
.btn:hover{background:#20202b}
.btn.fill{background:var(--iri);color:#0a0a10;font-weight:600;box-shadow:none}.btn.fill:hover{filter:brightness(1.12)}
.btn.ghost{background:transparent;color:var(--dim)}.btn.ghost:hover{color:var(--ink);background:#ffffff0a}
.btn.sm{padding:9px 14px;font-size:11px}.btn.wide{width:100%}.btn:disabled{opacity:.3;cursor:not-allowed}

main{max-width:1280px;margin:0 auto;padding:30px 20px 90px}
.view{display:none;animation:in .45s cubic-bezier(.2,.7,.2,1)}.view.on{display:block}
@keyframes in{from{opacity:0;transform:translateY(12px);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}

.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.95fr);gap:40px;align-items:center;padding:30px 0 34px}
h1{font-family:'Michroma';font-weight:400;font-size:clamp(30px,4.4vw,56px);line-height:1.16;text-transform:uppercase}
h1 em{font-style:normal;background:var(--iri);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:16px;color:var(--dim);max-width:560px;margin-top:20px;line-height:1.75}.lead b{color:var(--ink);font-weight:500}
.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.monitor{background:#0e0e13cc;backdrop-filter:blur(20px);box-shadow:inset 0 0 0 1px var(--edge2);padding:16px 18px 14px;clip-path:polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut))}
.monitor .top{display:flex;justify-content:space-between;font-family:'Michroma';font-size:9.5px;letter-spacing:.2em;color:var(--mut);margin-bottom:10px}
.monitor canvas{width:100%;height:220px;display:block}
.monitor .bot{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--dim)}
.monitor .bot span i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:6px;border-radius:2px}

.strip{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--edge);margin:6px 0 30px;clip-path:polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut))}
.strip .st{padding:16px 18px;background:var(--hull)}
.st .l{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.st .n{font-size:24px;font-weight:500;margin-top:4px;letter-spacing:-.01em}

.sec{display:flex;align-items:baseline;justify-content:space-between;margin:14px 0 16px;gap:12px}
.sec h2{font-family:'Michroma';font-weight:400;font-size:clamp(18px,2.2vw,26px);text-transform:uppercase}
.sec .r{font-size:12.5px;color:var(--mut)}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.chart{background:#0e0e13cc;backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px var(--edge);cursor:pointer;transition:.15s;position:relative;clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
.chart:hover{box-shadow:inset 0 0 0 1px var(--edge2);background:#15151ccc}
.chart .hd{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--edge)}
.chart .tk{font-family:'Michroma';font-size:13px;letter-spacing:.1em}
.chart .nm{font-size:12.5px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.chart .br{margin-left:auto;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:99px;color:#0a0a10;font-weight:600;white-space:nowrap}
.chart canvas{width:100%;height:88px;display:block;background:repeating-linear-gradient(90deg,transparent 0 23px,#ffffff08 23px 24px)}
.chart .kv{display:grid;grid-template-columns:1fr 1fr 1fr;padding:12px 16px 12px;gap:6px}
.chart .kv div{font-size:13px;font-weight:500}.chart .kv small{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:3px;font-weight:300}
.chart .th{padding:10px 16px 14px;font-size:12.5px;color:var(--dim);line-height:1.5;border-top:1px solid var(--edge)}
.up{color:var(--a)}.dn{color:var(--red)}
.rank{position:absolute;left:0;top:0;background:var(--iri);color:#0a0a10;font-size:9.5px;font-weight:600;padding:3px 9px;letter-spacing:.1em}

.coinwrap{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:22px;align-items:start}
.panel{background:#0e0e13cc;backdrop-filter:blur(16px);box-shadow:inset 0 0 0 1px var(--edge);padding:20px;clip-path:polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut))}
.panel h3{font-family:'Michroma';font-weight:400;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--dim);margin-bottom:12px}
.bigcanvas{width:100%;height:280px;display:block;background:repeating-linear-gradient(90deg,transparent 0 31px,#ffffff08 31px 32px),repeating-linear-gradient(0deg,transparent 0 31px,#ffffff06 31px 32px);box-shadow:inset 0 0 0 1px var(--edge)}
.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #ffffff0a;font-size:13px;color:var(--dim)}.row b{font-weight:500;color:var(--ink);text-align:right}
.field{display:flex;align-items:center;gap:8px;background:#ffffff08;box-shadow:inset 0 -1px 0 var(--edge2);padding:3px 6px 3px 12px;margin:8px 0;transition:.15s}
.field:focus-within{box-shadow:inset 0 -1px 0 var(--a);background:#7df9e10a}
.field input,.field select{flex:1;min-width:0;border:none;outline:none;background:none;font-family:'Sora';font-size:15px;padding:9px 0;color:var(--ink)}
.field input::placeholder{color:var(--mut)}.field select option{background:var(--hull);color:var(--ink)}
.field .u{font-size:11px;letter-spacing:.14em;color:var(--dim)}
.field .mx{font-size:10px;letter-spacing:.14em;color:var(--a);padding:5px 9px;cursor:pointer;box-shadow:inset 0 0 0 1px #7df9e155}
.seg{display:flex;gap:6px}.seg button{flex:1;border:none;background:none;box-shadow:inset 0 0 0 1px var(--edge);color:var(--dim);font-family:'Sora';font-size:12px;letter-spacing:.08em;padding:9px;cursor:pointer;border-radius:99px}.seg button.on{background:var(--ink);color:#0a0a10;font-weight:500;box-shadow:none}
.log{max-height:300px;overflow:auto;font-size:12.5px;scrollbar-width:thin;scrollbar-color:var(--edge2) transparent}
.log .r{display:flex;gap:12px;padding:7px 0;border-bottom:1px solid #ffffff0a}.log .r span:first-child{color:var(--mut);min-width:44px}
.thought{padding:12px 14px;border-left:2px solid var(--b);background:#ffffff06;margin:8px 0;font-size:13.5px;color:var(--ink)}
.thought small{display:block;font-size:10px;letter-spacing:.08em;color:var(--mut);margin-top:6px}
.pos{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #ffffff0a;font-size:12.5px}.pos b{min-width:52px;font-weight:600}.pos .pnl{margin-left:auto;font-weight:500}

.launch{max-width:720px;margin:0 auto}
.brains{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
.brain{box-shadow:inset 0 0 0 1px var(--edge);padding:14px;cursor:pointer;background:#ffffff05;transition:.15s;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.brain.on{box-shadow:inset 0 0 0 1px var(--a);background:#7df9e10c}
.brain b{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500}.brain b i{width:9px;height:9px;border-radius:50%;display:inline-block}
.brain p{font-size:12px;color:var(--dim);margin-top:5px;line-height:1.45}
.how{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px}
.step{background:#0e0e13cc;box-shadow:inset 0 0 0 1px var(--edge);padding:18px;clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
.step i{font-family:'Michroma';font-size:9.5px;letter-spacing:.2em;color:var(--a);font-style:normal}
.step h3{font-size:16px;font-weight:500;margin:8px 0 6px}.step p{font-size:13px;color:var(--dim);line-height:1.6}

.tape{display:flex;overflow:auto;gap:1px;background:var(--edge);margin-bottom:28px;scrollbar-width:none;clip-path:polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut))}
.tape .m{flex:1;min-width:104px;padding:10px 10px;background:var(--hull);text-align:center}
.tape .s{font-family:'Michroma';font-size:10px;letter-spacing:.1em}.tape .p{font-size:13px;font-weight:500;margin-top:3px}.tape .d{font-size:10.5px;margin-top:1px}
.tape .m.closed{opacity:.4}

.faq details{border-top:1px solid var(--edge)}.faq details:last-child{border-bottom:1px solid var(--edge)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;font-weight:500;font-size:15px;padding:14px 0}
.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";color:var(--mut);font-size:20px;font-weight:300;transition:.2s}.faq details[open] summary::after{transform:rotate(45deg);color:var(--a)}
.faq .a{font-size:14px;line-height:1.75;color:var(--dim);padding:0 0 18px;max-width:70ch}.faq .a b{color:var(--ink);font-weight:500}
.feedwrap{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ca{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:22px;padding:12px 14px;background:#ffffff08}
.ca .t{font-family:'Michroma';font-size:9.5px;letter-spacing:.14em;color:var(--dim)}.ca code{font-family:'Sora';font-size:12px;word-break:break-all}
footer{margin-top:50px;border-top:1px solid var(--edge);padding-top:16px;font-size:12px;color:var(--mut);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;letter-spacing:.06em}

.modal{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:#07070acc;backdrop-filter:blur(14px)}.modal.on{display:flex}
.mcard{width:min(420px,92vw);background:var(--hull);box-shadow:inset 0 0 0 1px var(--edge2);padding:26px;clip-path:polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut))}
.mcard h3{font-family:'Michroma';font-weight:400;font-size:14px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}.mcard p{color:var(--dim);font-size:13.5px;margin-bottom:14px}
.toast{position:fixed;right:26px;bottom:26px;transform:translateY(16px);z-index:90;background:#15151cee;backdrop-filter:blur(12px);color:var(--ink);font-size:13px;padding:13px 18px 13px 16px;opacity:0;transition:.25s;pointer-events:none;max-width:min(420px,88vw);border-left:2px solid var(--a)}
.toast.on{opacity:1;transform:none}.toast.err{border-left-color:var(--red)}
@media(max-width:900px){.hero{grid-template-columns:1fr}.coinwrap{grid-template-columns:1fr}.strip{grid-template-columns:repeat(2,1fr)}.strip .st:last-child{grid-column:1/-1}.brains,.how,.feedwrap{grid-template-columns:1fr}nav.tabs{display:none}.toast{right:12px;left:12px;bottom:14px}}
</style>`;
s = s.slice(0, i) + css + s.slice(j);
s = s.replace('family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600', 'family=Michroma&family=Sora:wght@300;400;500;600');
s = s.replace('<body>\n<header>', '<body>\n<div class="amb"></div><div class="scan"></div>\n<header>');
s = s.replace(/<span class="br" id="c-br" style="[^"]*"><\/span>/, '<span class="br" id="c-br" style="font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:999px;color:#0a0a10;font-weight:600;background:var(--v)"></span>');
s = s.replace('<span class="mono" style="font-weight:600;font-size:22px" id="c-tk">', '<span class="mi" style="font-size:20px" id="c-tk">');
fs.writeFileSync(path.join(R, 'client/index.html'), s);
let v = fs.readFileSync(path.join(R, 'server/index.js'), 'utf8');
for (const [a, b] of [["'#7c3aed'", "'#9d7bff'"], ["'#0ea5e9'", "'#7df9e1'"], ["'#16a34a'", "'#b8ff9a'"], ["'#f97316'", "'#ffb36b'"], ["'#ca8a04'", "'#ffe27b'"], ["'#db2777'", "'#ff7bd5'"]]) v = v.split(a).join(b);
fs.writeFileSync(path.join(R, 'server/index.js'), v);
let a = fs.readFileSync(path.join(R, 'client/src/app.js'), 'utf8');
a = a.replace("g.strokeStyle = '#7c3aed'", "g.strokeStyle = '#9d7bff'").replace("baseColor: '#3a3a3a'", "baseColor: '#3a3a4a'").replace("color: '#141414', w: 2", "color: '#f1f0f6', w: 2").replace("opts.baseColor || '#bfbdb1'", "opts.baseColor || '#3a3a4a'");
fs.writeFileSync(path.join(R, 'client/src/app.js'), a);
console.log('reskinned');
