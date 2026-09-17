const fs = require('fs');
const http = require('http');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide';
const out = [];
let fail = 0;
const ok = (l, c, e) => { if (!c) fail++; out.push((c ? '[OK]   ' : '[FAIL] ') + l + (e ? '  ' + e : '')); };

const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
const app = fs.readFileSync(ROOT + '/js/app.js', 'utf8');

ok('tab 文案为「地图讲解」', html.indexOf('<span>地图讲解</span>') !== -1);
ok('tab 图标 alt 同步', html.indexOf('alt="地图讲解"') !== -1);
ok('index.html 已无裸「<span>地图</span>」', html.indexOf('<span>地图</span>') === -1);
ok('仍保留 data-route="#/map"', html.indexOf('data-route="#/map"') !== -1);
ok('使用说明引用已改', app.indexOf('“地图讲解”页展示了厂区地图') !== -1 && app.indexOf('去“地图讲解”页') !== -1);
ok('index.html 引用 app.js?v=20260916-25', html.indexOf('js/app.js?v=20260916-25') !== -1);

function get(url) {
  return new Promise((r) => {
    const req = http.get(url, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => r({ s: res.statusCode, b })); });
    req.on('error', (e) => r({ s: 0, b: e.message }));
    req.setTimeout(2500, () => { req.destroy(); r({ s: 0, b: 'timeout' }); });
  });
}
(async () => {
  const h = await get('http://127.0.0.1:8000/index.html');
  const a = await get('http://127.0.0.1:8000/js/app.js');
  if (h.s !== 200) out.push('[SKIP] 8000 未响应（' + h.b + '）');
  else {
    ok('线上 index.html 已是「地图讲解」', h.b.indexOf('<span>地图讲解</span>') !== -1);
    ok('线上 index.html 引用 -25', h.b.indexOf('js/app.js?v=20260916-25') !== -1);
    ok('线上 app.js 使用说明已改', a.s === 200 && a.b.indexOf('“地图讲解”页展示了厂区地图') !== -1);
  }
  out.push('failed=' + fail);
  fs.writeFileSync(ROOT + '/.workbuddy/verify.log', out.join('\n'), 'utf8');
})();
