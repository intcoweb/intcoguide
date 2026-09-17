const fs = require('fs');
const DIR = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/.workbuddy/';
const kill = ['_append_mem.js', '_chk.txt', '_clip.txt', '_probe.py', '_probe.txt', '_srv.txt', '_tail.txt', '_tmp.txt', '_out.txt'];
const res = [];
for (const f of kill) {
  try { if (fs.existsSync(DIR + f)) { fs.unlinkSync(DIR + f); res.push('deleted ' + f); } }
  catch (e) { res.push('FAIL ' + f + ' :: ' + e.message); }
}
res.push('--- 剩余 _* ---');
for (const f of fs.readdirSync(DIR)) if (f.startsWith('_')) res.push(f);
res.push('--- .workbuddy 顶层 ---');
for (const f of fs.readdirSync(DIR)) if (!f.startsWith('_')) res.push(f);
fs.writeFileSync(DIR + 'cleanup.log', res.join('\n'), 'utf8');
