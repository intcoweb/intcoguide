/* 搜索页改造校验：
   直接从 js/app.js 里切出真实实现（mapSiteData / 搜索页那几个函数），
   在 vm 沙箱里配一个迷你 DOM 跑，避免另写一份实现导致校验与线上脱节。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const appSrc = fs.readFileSync(ROOT + '/js/app.js', 'utf8');
const cssSrc = fs.readFileSync(ROOT + '/css/style.css', 'utf8');
const htmlSrc = fs.readFileSync(ROOT + '/index.html', 'utf8');
const dataSrc = fs.readFileSync(ROOT + '/js/data.js', 'utf8');

const lines = [];
let fails = 0;
function ok(label, cond, extra) {
  if (!cond) fails += 1;
  lines.push((cond ? 'PASS  ' : 'FAIL  ') + label + (!cond && extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
}
function head(t) { lines.push(''); lines.push('=== ' + t + ' ==='); }

/* ---------- 切出真实实现 ---------- */
function slice(startMarker, endMarker) {
  const i = appSrc.indexOf(startMarker);
  if (i < 0) throw new Error('找不到起点: ' + startMarker);
  const j = appSrc.indexOf(endMarker, i);
  if (j < 0) throw new Error('找不到终点: ' + endMarker);
  return appSrc.slice(i, j);
}

const mergeSnippet = slice('  const MAP_CATEGORY_MERGE = [', '  function mapDisplayCategories()');
const searchSnippet = slice('  /* 搜索页图标全部内联 SVG', '  /* =========================================================\n     使用说明');
/* 分类下标助手（搜索页「定位」要用它判断点位在分类条的位置） */
const displaySnippet = slice('  function mapDisplayCategories() {', '  /* 点位在「地图分类条」');
const catIdxSnippet = slice('  /* 点位在「地图分类条」', '  function currentSiteData()');
/* 定位落地逻辑（真正 setView 的那段） */
const pendingFocusSnippet = slice('  /* 落地搜索页「定位」的目标', '  function initMap() {');

/* ---------- 载入 data.js ---------- */
const dataSandbox = { window: {}, console };
vm.createContext(dataSandbox);
vm.runInContext(dataSrc, dataSandbox);
const GLU = dataSandbox.window.GLU_DATA;

/* ---------- 迷你 DOM ---------- */
const byId = {};
const byClass = {};
function mkEl(tag, id, classes, dataset, html) {
  const el = {
    tag, id, dataset: dataset || {}, _html: '',
    _classes: new Set(classes || []), _listeners: {},
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      contains: (c) => el._classes.has(c),
      toggle: (c, on) => { if (on === undefined) on = !el._classes.has(c); on ? el._classes.add(c) : el._classes.delete(c); return on; },
    },
    addEventListener: (t, fn) => { (el._listeners[t] = el._listeners[t] || []).push(fn); },
    focus: () => {},
    click: () => (el._listeners.click || []).forEach((fn) => fn({ stopPropagation: () => {} })),
  };
  Object.defineProperty(el, 'className', { get: () => Array.from(el._classes).join(' ') });
  Object.defineProperty(el, 'innerHTML', {
    get: () => el._html,
    set: (v) => { el._html = String(v); scan(el._html); },
  });
  return el;
}
function scan(html) {
  const re = /<(\w+)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2];
    const idM = /\bid="([^"]*)"/.exec(attrs);
    const clsM = /\bclass="([^"]*)"/.exec(attrs);
    const ds = {};
    const dre = /\bdata-([\w-]+)="([^"]*)"/g;
    let d;
    while ((d = dre.exec(attrs))) ds[d[1]] = d[2];
    const el = mkEl(m[1], idM ? idM[1] : null, clsM ? clsM[1].split(/\s+/) : [], ds);
    if (el.id) byId[el.id] = el;
    el._classes.forEach((c) => { (byClass[c] = byClass[c] || []).push(el); });
  }
}
function mountShell() {
  ['searchRoot', 'searchHistory', 'searchResult'].forEach((id) => { byId[id] = mkEl('div', id, [], {}); });
}
function resetDom() {
  Object.keys(byId).forEach((k) => delete byId[k]);
  Object.keys(byClass).forEach((k) => delete byClass[k]);
  mountShell();
}
const $ = (sel) => (sel[0] === '#' && sel.indexOf(' ') === -1 ? byId[sel.slice(1)] || null : null);
const mapCatEls = [];   // 分类条上的 .map-cat（applyPendingFocus 会去改高亮）
const $$ = (sel, root) => {
  if (sel[0] !== '.') return sel === '#mapCategories .map-cat' ? mapCatEls : [];
  return byClass[sel.slice(1)] || [];
};

mountShell();

/* ---------- 沙箱 ---------- */
const store = {};
const calls = { guide: [], toast: [], picker: [], mapPick: 0, hideSub: 0, setView: [], renderMarkers: 0, invalids: 0 };
const loc = { hash: '#/map' };

const sb = {
  console,
  MAP: GLU.map,
  state: { campus: 0, campus_name_list: GLU.map.site_data.map((s) => s.name), searchContent: '', start: { name: '', latitude: '', longitude: '' }, end: { name: '', latitude: '', longitude: '' }, mapCategory: 0, focusPoint: null, focusLock: 0 },
  $, $$,
  esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  currentCampus: () => sb.MAP.site_data[sb.state.campus] || sb.MAP.site_data[0],
  mapCampusData: () => sb.MAP.site_data[sb.state.campus] || sb.MAP.site_data[0],
  campusLabel: (c) => (c && (c.base_name || c.name)) || '',
  openGuideDialog: (site, cat) => calls.guide.push({ name: site && site.name, cat }),
  showCampusPicker: (onPick, opts) => calls.picker.push(opts || {}),
  toast: (m) => calls.toast.push(m),
  hideSub: () => { calls.hideSub += 1; },
  syncMapInputs: () => { calls.mapPick += 1; },
  onMapShow: () => { calls.onMapShow = (calls.onMapShow || 0) + 1; },
  renderCategoryMarkers: () => { calls.renderMarkers += 1; },
  map: {
    invalidateSize: () => { calls.invalids += 1; },
    setView: (latLng, zoom) => { calls.setView.push({ latLng, zoom }); },
  },
  location: loc,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
};
vm.createContext(sb);
vm.runInContext(mergeSnippet, sb);
vm.runInContext(displaySnippet, sb);
vm.runInContext(searchSnippet, sb);
vm.runInContext(catIdxSnippet, sb);
vm.runInContext(pendingFocusSnippet, sb);

const api = {
  renderSearch: () => sb.renderSearch(),
  goSearch: () => sb.goSearch(),
  renderSearchHistory: () => sb.renderSearchHistory(),
  clearHistory: () => sb.clearHistory(),
  focusSearchPoint: (p, c) => sb.focusSearchPoint(p, c),
  applyPendingFocus: () => sb.applyPendingFocus(),
  displayCategoryIndexFor: (p, c) => sb.displayCategoryIndexFor(p, c),
  mapSiteData: () => sb.mapSiteData(),
  mapDisplayCategories: () => sb.mapDisplayCategories(),
};

/* ---------- A. 入口渲染 ---------- */
head('A. 搜索栏渲染（不再有外链破图）');
resetDom();
api.renderSearch();
const rootHtml = byId.searchRoot.innerHTML;
ok('searchRoot 用新的 .search-bar 结构', /class="search-bar"/.test(rootHtml));
ok('输入框包进 .search-field（带放大镜图标）', /class="search-field"/.test(rootHtml) && /class="shi"/.test(rootHtml));
ok('有清空按钮 .search-clear', /id="searchClear"/.test(rootHtml));
ok('基地按钮显示基地名（英科医疗淮北基地）', /英科医疗淮北基地/.test(rootHtml), rootHtml.slice(0, 200));
ok('搜索栏内没有任何 <img>', !/<img/.test(rootHtml));
ok('清空按钮默认不显示（无 show 类）', !byId.searchClear._classes.has('show'));

head('B. 「搜索结果」「搜索历史」标题不含 <img>，改用内联 SVG');
store.glu_history = JSON.stringify(['丁腈']);
api.renderSearchHistory();
const histHtml = byId.searchHistory.innerHTML;
ok('搜索历史标题有内联 svg', /<svg class="shi"/.test(histHtml));
ok('搜索历史标题不含 <img>', !/<img/.test(histHtml));
ok('历史条目渲染成 .search-chunk', (byClass['search-chunk'] || []).length === 1);
ok('有清空历史的按钮 #clearHist', !!byId.clearHist);

api.goSearch();
/* 结果用键盘输入后调用，这里先塞入输入框 */
byId.searchInput = mkEl('input', 'searchInput', ['search-input'], {});
byId.searchInput.value = '丁腈';
api.goSearch();
const resHtml = byId.searchResult.innerHTML;
ok('搜索结果标题用内联 svg', /<svg class="shi"/.test(resHtml));
ok('搜索结果不含 <img>', !/<img/.test(resHtml));
ok('结果条数徽标存在', /class="headline-count"/.test(resHtml));

/* ---------- C. 点击结果 = 与首页同款讲解弹窗 ---------- */
head('C. 点整行 → 打开与地图页相同的讲解弹窗');
calls.guide.length = 0;
const rows = byClass['result-item'] || [];
ok('渲染出 6 条丁腈车间结果', rows.length === 6, rows.length);
ok('结果行带序号徽标', (byClass['ri-idx'] || []).length === rows.length);
ok('每行一个「定位」按钮', (byClass['ri-locate'] || []).length === rows.length, (byClass['ri-locate'] || []).length);
ok('「定位」按钮带图标与文案', /<button class="ri-locate"[^>]*>\s*<svg[\s\S]*?<\/svg>\s*<span>定位<\/span>/.test(resHtml));
ok('不再有「起点 / 终点」按钮', (byClass['ri-act'] || []).length === 0);
rows[0].click();
ok('点第 1 行触发了讲解弹窗', calls.guide.length === 1, calls.guide);
ok('弹窗拿到的是「丁腈车间1」', calls.guide[0] && calls.guide[0].name === '丁腈车间1', calls.guide[0]);
ok('弹窗分类名正确（丁腈车间）', calls.guide[0] && calls.guide[0].cat === '丁腈车间', calls.guide[0]);
rows[5].click();
ok('点第 6 行也是弹窗且名字正确', calls.guide[1] && calls.guide[1].name === '丁腈车间6', calls.guide[1]);
ok('点行不会误改起终点', calls.mapPick === 0 && sb.state.end.name === '', sb.state.end);

head('D. 合并分类「生产车间」的点位要带来源分类名');
sb.state.campus = 0;
const mergedCat = api.mapSiteData().filter((c) => c.name === '生产车间')[0];
ok('地图侧存在「生产车间」分类', !!mergedCat);
const nitrilePoint = (mergedCat.list || []).filter((p) => p.name === '丁腈车间1')[0];
byId.searchInput.value = '丁腈车间1';
api.goSearch();
calls.guide.length = 0;
(byClass['result-item'] || [])[0].click();
ok('合并分类里的点弹窗分类名仍是「丁腈车间」', calls.guide[0] && calls.guide[0].cat === '丁腈车间', calls.guide[0]);

/* ---------- E. 「定位」= 以该点位为中心回地图讲解页 ---------- */
head('E. 行内「定位」按钮');
mapCatEls.length = 0;
api.mapDisplayCategories().forEach((c, k) => mapCatEls.push(mkEl('div', null, ['map-cat'], { i: String(k) })));
const allPoints = api.mapSiteData().reduce((acc, c) => acc.concat(c.list), []);
const pt = allPoints.filter((p) => p.name === '丁腈车间1')[0];
const catIdxReal = api.mapDisplayCategories().findIndex((c) => c.name === '生产车间');

sb.state.campus = 0;
sb.state.focusPoint = null;
sb.state.mapCategory = 0;
loc.hash = '#/search?id=0';
resetDom();                       // 清掉前面几轮累积的 DOM 引用，避免点到旧元素上的重复监听
api.renderSearch();
byId.searchInput = mkEl('input', 'searchInput', ['search-input'], {});
byId.searchInput.value = '丁腈车间1';
api.goSearch();
calls.hideSub = 0; calls.toast.length = 0; calls.setView.length = 0; calls.renderMarkers = 0; calls.onMapShow = 0;

const locateBtn = (byClass['ri-locate'] || [])[0];
ok('渲染出了「定位」按钮', !!locateBtn);
locateBtn.click();
ok('关掉搜索子页', calls.hideSub === 1);
ok('回到「地图讲解」页（#/map）', loc.hash === '#/map', loc.hash);
ok('点了「定位」不会走 onMapShow 的额外分支（hash 变了靠 hashchange）', calls.onMapShow === 0, calls.onMapShow);
ok('记下待定位点位', !!sb.state.focusPoint && sb.state.focusPoint.name === '丁腈车间1', sb.state.focusPoint);
ok('坐标取自点位本身', sb.state.focusPoint.latitude === Number(pt.latitude) && sb.state.focusPoint.longitude === Number(pt.longitude), [sb.state.focusPoint, pt.latitude, pt.longitude]);
ok('分类下标 = 「生产车间」在分类条上的位置（跳过虚拟「全部」）', sb.state.focusPoint.category === catIdxReal && catIdxReal > 0, [sb.state.focusPoint.category, catIdxReal]);
ok('点「定位」不改动起终点', sb.state.start.name === '' && sb.state.end.name === '', [sb.state.start, sb.state.end]);

head('F. 待定位点位落地（onMapShow 末尾的 applyPendingFocus）');
api.applyPendingFocus();
ok('地图视角移到该点位', calls.setView.length === 1 && Math.abs(calls.setView[0].latLng[0] - Number(pt.latitude)) < 1e-9 && Math.abs(calls.setView[0].latLng[1] - Number(pt.longitude)) < 1e-9, calls.setView);
ok('放大到 FOCUS_ZOOM=18', calls.setView[0] && calls.setView[0].zoom === 18, calls.setView[0]);
ok('当前是「全部」（什么都可见）→ 不擅自改分类', sb.state.mapCategory === 0 && calls.renderMarkers === 0, [sb.state.mapCategory, calls.renderMarkers]);
ok('落地前先 invalidateSize（避免量成 0）', calls.invalids >= 1, calls.invalids);
ok('有「已定位到 XX」toast', calls.toast.some((m) => /已定位到/.test(m)), calls.toast);
ok('设置了 focusLock，watchPosition 首次居中会让位', sb.state.focusLock > Date.now(), sb.state.focusLock);
ok('消费后清空待定位点位', sb.state.focusPoint === null);

calls.setView.length = 0; calls.renderMarkers = 0;
api.applyPendingFocus();
ok('没有待定位点位时不再动视角 / 不重绘', calls.setView.length === 0 && calls.renderMarkers === 0);

head('G. 当前分类看不到该点位时才切分类');
const idxLife = api.mapDisplayCategories().findIndex((c) => c.name === '生活配套');
const idxStorage = api.mapDisplayCategories().findIndex((c) => c.name === '环保仓储');
sb.state.mapCategory = idxStorage;             // 停在「环保仓储」
loc.hash = '#/map';
calls.onMapShow = 0; calls.renderMarkers = 0; calls.setView.length = 0;
api.focusSearchPoint({ name: '餐厅', latitude: 33.87, longitude: 116.72 }, '生活配套');
sb.state.mapCategory = idxStorage;             // onMapShow 在本沙箱里是替身，分类仍是环保仓储
api.applyPendingFocus();
ok('切到点位所属分类', sb.state.mapCategory === idxLife, [sb.state.mapCategory, idxLife]);
ok('分类条高亮唯一且落在该分类', mapCatEls.filter((e) => e._classes.has('choose')).length === 1 && mapCatEls[idxLife]._classes.has('choose'));
ok('切分类后重绘了标记', calls.renderMarkers === 1, calls.renderMarkers);
ok('并且以该点位为中心', calls.setView.length === 1 && calls.setView[0].latLng[0] === 33.87, calls.setView);

head('H. 已经在 #/map 时（hash 不变）要手动触发一次');
sb.state.focusPoint = null;
loc.hash = '#/map';
calls.onMapShow = 0;
api.focusSearchPoint({ name: '餐厅', latitude: 33.87, longitude: 116.72 }, '生活配套');
ok('hash 未变时手动调用 onMapShow', calls.onMapShow === 1, calls.onMapShow);
ok('点位已记下', !!(sb.state.focusPoint && sb.state.focusPoint.name === '餐厅'), sb.state.focusPoint);
sb.state.mapCategory = idxStorage;
calls.setView.length = 0;
api.applyPendingFocus();
ok('仍然以该点位为中心', calls.setView.length === 1 && calls.setView[0].latLng[0] === 33.87, calls.setView);

head('I. 分类下标助手：不能命中虚拟「全部」');
ok('任何点位都不会返回 0（0 = 全部）', allPoints.every((p) => api.displayCategoryIndexFor(p, p._catName) !== 0));
ok('合并分类里的点按来源分类名匹配', api.displayCategoryIndexFor(pt, '丁腈车间') === catIdxReal);
ok('分类名对不上时返回 -1', api.displayCategoryIndexFor(pt, '不存在的分类') === -1);

/* ---------- J. 空关键词 / 空结果 ---------- */
head('J. 空输入与无结果');
calls.toast.length = 0;
byId.searchInput.value = '   ';
api.goSearch();
ok('空关键词提示且不渲染结果', calls.toast.length === 1 && /请输入/.test(calls.toast[0]), calls.toast);
calls.toast.length = 0;
byId.searchResult.innerHTML = '';
byId.searchInput.value = '这个关键词不存在';
api.goSearch();
ok('无结果时有空态面板', /result-empty/.test(byId.searchResult.innerHTML));
ok('无结果时不再多弹一个 toast', calls.toast.length === 0, calls.toast);
ok('空态里回显了关键词', /这个关键词不存在/.test(byId.searchResult.innerHTML));

/* ---------- K. 历史记录 ---------- */
head('K. 搜索历史');
ok('搜过之后写进了 localStorage', /丁腈/.test(store.glu_history || ''), store.glu_history);
ok('新关键词插到最前', JSON.parse(store.glu_history)[0] === '这个关键词不存在', store.glu_history);
ok('不写重复关键词', JSON.parse(store.glu_history).filter((x) => x === '丁腈').length === 1, store.glu_history);
api.clearHistory();
ok('清空后 localStorage 无历史', !store.glu_history);
ok('清空后提示已清空', calls.toast[calls.toast.length - 1] === '搜索历史已清空');

/* ---------- L. CSS / HTML 一致性 ---------- */
head('L. 样式与页面结构');
['.page-search', '.search-bar', '.search-field', '.search-clear', '.search-panel', '.result-list', '.ri-idx', '.ri-locate', '.result-empty', '.result-foot']
  .forEach((sel) => ok('css 含 ' + sel, cssSrc.indexOf(sel + ' ') !== -1 || cssSrc.indexOf(sel + '{') !== -1 || cssSrc.indexOf(sel + ',') !== -1));
ok('「定位」按钮用蓝调（区别于原来的灰绿胶囊）', /\.ri-locate\s*\{[^}]*#2b7cba/.test(cssSrc));
ok('旧的 .ri-acts / .ri-act 样式已清除', cssSrc.indexOf('.ri-acts') === -1 && cssSrc.indexOf('.ri-act ') === -1 && cssSrc.indexOf('.ri-act{') === -1);
ok('搜索子页可滚动', /\.page-search\s*\{[^}]*overflow-y:\s*auto/.test(cssSrc));
ok('搜索标题栏吸顶', /\.page-search \.sub-nav\s*\{\s*position:\s*sticky/.test(cssSrc));
ok('底部给 TabBar 留位', /\.search-result\s*\{[^}]*--tabbar-h/.test(cssSrc));
ok('旧样式 .search-history .headline img 已移除', cssSrc.indexOf('.search-history .headline img') === -1);
ok('index.html 仍含 #page-search 三个容器',
  /id="searchRoot"/.test(htmlSrc) && /id="searchHistory"/.test(htmlSrc) && /id="searchResult"/.test(htmlSrc));
ok('app.js 里搜索页已无 MEDIA.history / MEDIA.delete / MEDIA.searchIcon 引用（注释除外）',
  !/MEDIA\.(history|delete|searchIcon)[,)]/.test(appSrc) && !/' \+ asset\(MEDIA\.(history|delete|searchIcon)\)/.test(appSrc));
ok('data.js 的 media.searchIcon 仍指向外链（已不再被页面引用，留作备查）',
  /"searchIcon"/.test(dataSrc));
ok('onMapShow 末尾会落地待定位点位（视角必须在重载数据之后定）',
  /syncMapInputs\(\);\s*\r?\n\s*applyPendingFocus\(\);/.test(appSrc));
ok('首次进入地图页（initMap 之后）也会落地',
  /initMap\(\);\s*\r?\n\s*applyPendingFocus\(\);/.test(appSrc));
ok('watchPosition 的首次居中会给 focusLock 让位',
  /isFirst && Date\.now\(\) >= state\.focusLock/.test(appSrc));

lines.push('');
lines.push(fails === 0 ? '✅ 全部通过' : ('❌ 失败 ' + fails + ' 条'));
fs.writeFileSync(path.join(__dirname, 'verify.log'), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
process.exit(fails === 0 ? 0 : 1);
