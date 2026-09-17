/* 实拉本地 8000 端口，核对服务端返回的就是本次改动后的内容 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '_srv.txt');
const BASE = 'http://127.0.0.1:8000';
const lines = [];
let fail = 0;

function ok(name, cond, extra) {
  if (cond) lines.push('  ok   ' + name);
  else { fail += 1; lines.push('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

(async function () {
  let html = null;
  try {
    const res = await fetch(BASE + '/index.html?probe=' + Date.now());
    html = await res.text();
    lines.push('GET /index.html → ' + res.status);
  } catch (e) {
    lines.push('服务未启动（' + (e && e.message) + '）');
    fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
    process.exitCode = 0;
    return;
  }

  ok('服务端 index.html 含引导条', html.indexOf('id="mapOrientHint"') > -1);
  ok('服务端已引用新版本 app.js', html.indexOf('js/app.js?v=20260916-26') > -1);
  ok('服务端已引用新版本 style.css', html.indexOf('css/style.css?v=20260916-19') > -1);

  const appRes = await fetch(BASE + '/js/app.js?v=20260916-26');
  const appTxt = await appRes.text();
  lines.push('GET /js/app.js → ' + appRes.status + ' ' + appRes.headers.get('content-type'));
  ok('服务端 app.js 含 NotAllowedError 区分', appTxt.indexOf("error.name === 'NotAllowedError'") > -1);
  ok('服务端 app.js 含手势引导函数', appTxt.indexOf('function armOrientationGesture') > -1);

  const cssRes = await fetch(BASE + '/css/style.css?v=20260916-19');
  const cssTxt = await cssRes.text();
  lines.push('GET /css/style.css → ' + cssRes.status + ' ' + cssRes.headers.get('content-type'));
  ok('服务端 style.css 含引导条样式', cssTxt.indexOf('.map-orient-hint.on') > -1);

  lines.push('');
  lines.push(fail ? '存在 ' + fail + ' 项不一致' : '全部一致');
  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  process.exitCode = fail ? 1 : 0;
})();
