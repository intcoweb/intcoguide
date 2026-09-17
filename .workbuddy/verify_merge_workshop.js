/* 直接从 app.js 源码里抽出地图分类派生逻辑来跑，避免"另写一份"而与真实实现脱节。 */
const fs = require('fs');
const vm = require('vm');
const http = require('http');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide';

const out = [];
let fail = 0;
function ok(label, cond, extra) {
  if (!cond) fail++;
  out.push((cond ? '[OK]   ' : '[FAIL] ') + label + (extra ? '  ' + extra : ''));
}
function finish() {
  out.push('failed=' + fail);
  fs.writeFileSync(ROOT + '/.workbuddy/verify.log', out.join('\n'), 'utf8');
}

/* ---- 载入 data.js ---- */
const dataSrc = fs.readFileSync(ROOT + '/js/data.js', 'utf8');
const dsb = { window: {}, console };
vm.createContext(dsb);
vm.runInContext(dataSrc, dsb);
const GLU = dsb.window.GLU_DATA;
const app = fs.readFileSync(ROOT + '/js/app.js', 'utf8');

/* ---- 从 app.js 抽出 MAP_CATEGORY_MERGE + mapSiteData + mapDisplayCategories ---- */
const start = app.indexOf('const MAP_CATEGORY_MERGE');
const end = app.indexOf('function currentSiteData');
ok('成功抽取地图分类派生代码段', start > 0 && end > start);

const sandboxState = { campus: 0 };
const sb = {
  console,
  MAP: GLU.map,
  state: sandboxState,
  mapCampusData: function () { return GLU.map.site_data[sandboxState.campus] || GLU.map.site_data[0]; },
};
vm.createContext(sb);

try {
  vm.runInContext(app.slice(start, end), sb);
} catch (e) {
  ok('抽取代码可执行', false, e.message);
  finish();
  return;
}
ok('抽取代码可执行', true);

/* ---- 断言：地图页分类（淮北） ---- */
const bar = sb.mapDisplayCategories();
const names = bar.map((c) => c.name);
out.push('地图分类条 = ' + names.join(' > '));
ok('地图分类条首项为「全部」', names[0] === '全部');
ok('地图条含「生产车间」', names.indexOf('生产车间') !== -1);
ok('地图条不再有「丁腈车间」', names.indexOf('丁腈车间') === -1);
ok('地图条不再有「PVC车间」', names.indexOf('PVC车间') === -1);
ok('地图条顺序 全部>展厅>生产车间>环保仓储>生活配套',
  names.join('>') === '全部>展厅>生产车间>环保仓储>生活配套');

const realCats = sb.mapSiteData();
const prod = realCats.filter((c) => c.name === '生产车间')[0];
ok('生产车间 有 merged 标记', !!(prod && prod.merged));

const raw = GLU.map.site_data[0].category_list;
const nbr = raw.filter((c) => c.name === '丁腈车间')[0];
const pvc = raw.filter((c) => c.name === 'PVC车间')[0];
ok('丁腈(' + nbr.list.length + ') + PVC(' + pvc.list.length + ') = 生产车间(' + prod.list.length + ')',
  nbr.list.length + pvc.list.length === prod.list.length);
ok('生产车间 里丁腈点位带 _catName=丁腈车间',
  prod.list.filter((p) => p._catName === '丁腈车间').length === nbr.list.length);
ok('生产车间 里PVC点位带 _catName=PVC车间',
  prod.list.filter((p) => p._catName === 'PVC车间').length === pvc.list.length);

/* ---- 「全部」池：不丢点、不重复、_catName 未被「生产车间」覆盖 ---- */
const all = bar[0].list;
const expect = raw.filter((c) => !c.siteOnly).reduce((n, c) => n + (c.list || []).length, 0);
ok('「全部」池点数 = 非 siteOnly 分类点数之和', all.length === expect, all.length + ' vs ' + expect);
ok('「全部」池无「生产车间」当来源分类名',
  all.filter((p) => p._catName === '生产车间').length === 0);
ok('「全部」池保留了丁腈/PVC 的原 _catName',
  all.filter((p) => p._catName === '丁腈车间').length === nbr.list.length &&
  all.filter((p) => p._catName === 'PVC车间').length === pvc.list.length);
ok('「全部」池无重复点位',
  new Set(all.map((p) => p.name + '@' + p.latitude + ',' + p.longitude)).size === all.length);

/* ---- 基地介绍页数据不受影响（读 currentCampus().category_list） ---- */
const siteNames = raw.map((c) => c.name).join('>');
out.push('基地介绍页分类 = ' + siteNames);
ok('基地介绍页仍有 丁腈车间 / PVC车间（未动）',
  raw.filter((c) => c.name === '丁腈车间').length === 1 &&
  raw.filter((c) => c.name === 'PVC车间').length === 1);
ok('基地介绍页无「生产车间」分类', raw.filter((c) => c.name === '生产车间').length === 0);
ok('data.js 原始分类顺序未变',
  siteNames === '配套基地>展厅>丁腈车间>PVC车间>环保仓储>生活配套');

/* ---- 配色 / 弹窗配置 ---- */
ok('markerToneOf 仍含 丁腈车间:nitrile 与 PVC车间:pvc',
  app.indexOf("'丁腈车间': 'nitrile'") !== -1 && app.indexOf("'PVC车间': 'pvc'") !== -1);
ok('renderCategoryMarkers 仍优先用 _catName',
  app.indexOf('const catName = site._catName || cat.name;') !== -1);
ok('AREA_GUIDES 有「生产车间」兜底项', app.indexOf("'生产车间': {") !== -1);

/* ---- 青州厂区（占位分类）也要合并不报错 ---- */
sandboxState.campus = 1;
const qz = sb.mapDisplayCategories();
out.push('青州厂区地图分类 = ' + qz.map((c) => c.name).join(' > '));
ok('青州厂区也把丁腈/PVC 合成生产车间',
  qz.map((c) => c.name).indexOf('生产车间') !== -1 &&
  qz.map((c) => c.name).indexOf('丁腈车间') === -1);

/* ---- 线上核对 ---- */
const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
ok('index.html 引用 app.js?v=20260916-24', html.indexOf('js/app.js?v=20260916-24') !== -1);

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    req.setTimeout(2500, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });
}

(async () => {
  const a = await get('http://127.0.0.1:8000/js/app.js');
  const h = await get('http://127.0.0.1:8000/index.html');
  if (a.status !== 200) {
    out.push('[SKIP] 本地 8000 未响应（' + a.body + '），跳过线上核对');
  } else {
    ok('线上 app.js 已含 MAP_CATEGORY_MERGE', a.body.indexOf('MAP_CATEGORY_MERGE') !== -1);
    ok('线上 app.js 含 生产车间 合并项',
      a.body.indexOf("name: '生产车间', from: ['丁腈车间', 'PVC车间']") !== -1);
    ok('线上 index.html 已是 -24 版本', h.body.indexOf('js/app.js?v=20260916-24') !== -1);
  }
  finish();
})();
