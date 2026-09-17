/* 校验：
   1) index.html 只剩 2 个 tab，且无 qingzhou-map
   2) app.js 已无 state.choose / state.mapCampus，且 switchCampus 为联动实现
   3) 实拉 8000 端口，确认服务端返回的就是新内容 */
const fs = require('fs');
const http = require('http');

const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide';
const out = [];
let fail = 0;
function ok(label, cond, extra) {
  if (!cond) fail++;
  out.push((cond ? '[OK]   ' : '[FAIL] ') + label + (extra ? '  ' + extra : ''));
}

const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
const app = fs.readFileSync(ROOT + '/js/app.js', 'utf8');

ok('index.html tab 数为 2', (html.match(/class="tab-item"/g) || []).length === 2,
  '实际 ' + (html.match(/class="tab-item"/g) || []).length);
ok('index.html 无 qingzhou-map 字样', html.indexOf('qingzhou-map') === -1);
ok('index.html 无「青州地图」可见文案', html.indexOf('<span>青州地图</span>') === -1);
ok('index.html 引用 app.js?v=20260916-23', html.indexOf('js/app.js?v=20260916-23') !== -1);
ok('index.html 仍保留 地图/基地介绍 两个 route',
  html.indexOf('data-route="#/map"') !== -1 && html.indexOf('data-route="#/site"') !== -1);

ok('app.js 无 state.choose', app.indexOf('state.choose') === -1);
ok('app.js 无 state.mapCampus', app.indexOf('state.mapCampus') === -1);
ok('app.js state 声明 campus', /campus:\s*0,/.test(app));
ok('switchCampus 两页联动（含 siteRendered 分支）',
  /function switchCampus\(i\) \{[\s\S]{0,900}siteRendered[\s\S]{0,200}renderSiteCategory\(\)/.test(app));
ok('switchCampus 不再改写 hash', !/function switchCampus\(i\) \{[\s\S]{0,600}location\.hash =/.test(app));
ok('onMapShow 按 campus 差异重载', app.indexOf('if (state.campus !== state.appliedCampus) {') !== -1);
ok('navigate 进地图不重置基地', app.indexOf("if (name === 'map') { state.campus") === -1);
ok('setActiveTab 兼容 qingzhou-map 深链', app.indexOf("const activeRoute = '#/' + ((tab === 'qingzhou-map') ? 'map' : tab);") !== -1);
ok('TAB_ROUTES 仍含 qingzhou-map（旧链接可用）', /TAB_ROUTES = \['map', 'qingzhou-map', 'site'\]/.test(app));

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b, type: res.headers['content-type'] }));
    });
    req.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    req.setTimeout(2500, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });
}

(async () => {
  const h = await get('http://127.0.0.1:8000/index.html');
  const a = await get('http://127.0.0.1:8000/js/app.js');
  if (h.status !== 200) {
    out.push('[SKIP] 本地 8000 端口未响应（' + h.body + '），跳过线上核对');
  } else {
    ok('线上 index.html 已去掉青州地图 tab', h.body.indexOf('qingzhou-map') === -1);
    ok('线上 index.html 引用 -23 版本', h.body.indexOf('js/app.js?v=20260916-23') !== -1);
    ok('线上 app.js 含联动 switchCampus', a.status === 200 && a.body.indexOf('siteRendered') !== -1);
    ok('线上 app.js 无 state.choose', a.body.indexOf('state.choose') === -1);
  }
  out.push('failed=' + fail);
  fs.writeFileSync(ROOT + '/.workbuddy/verify.log', out.join('\n'), 'utf8');
})();
