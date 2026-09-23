// one-shot: iridescent -> black + Robinhood green (same palette as MUTE). Already applied; do not re-run.
const fs = require('fs'), path = require('path'); const R = path.join(__dirname, '..');
const M = [['#07070a', '#050705'], ['#0e0e13', '#0a0f0c'], ['#15151c', '#0f1611'], ['#262631', '#1b2920'], ['#3a3a4a', '#25382b'], ['#f1f0f6', '#ecf6ee'], ['#9d9bad', '#a9bcae'], ['#64627a', '#6f8577'], ['#7df9e1', '#00c805'], ['#9d7bff', '#19d81f'], ['#ff7bd5', '#7dff8a'], ['#ff6b81', '#ff5c5c'], ['#20202b', '#152018'], ['#0a0a10', '#03110a']];
for (const f of ['client/index.html', 'client/src/app.js', 'server/index.js', '_studio/src/_base.css']) { let s = fs.readFileSync(path.join(R, f), 'utf8'); for (const [a, b] of M) s = s.split(a).join(b); fs.writeFileSync(path.join(R, f), s); }
// brain colours: six greens/complements readable on black
let v = fs.readFileSync(path.join(R, 'server/index.js'), 'utf8');
for (const [a, b] of [["'#19d81f'", "'#00c805'"], ["'#00c805', line: 'Buys what just fell", "'#7dff8a', line: 'Buys what just fell"], ["'#b8ff9a'", "'#c9ffb0'"], ["'#ffb36b'", "'#ffb36b'"], ["'#ffe27b'", "'#ffe27b'"], ["'#7dff8a', line: 'Goes where", "'#5ad8ff', line: 'Goes where"]]) v = v.split(a).join(b);
fs.writeFileSync(path.join(R, 'server/index.js'), v); console.log('green');
