const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const LOG = [];
const must = (c, m) => LOG.push((c ? 'OK  ' : 'FAIL  ') + m);

const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const css = fs.readFileSync(ROOT + 'css/style.css', 'utf8');
const app = fs.readFileSync(ROOT + 'js/app.js', 'utf8');

/* --- index.html --- */
must(/class="map-base-bar" id="mapCampusWrap"/.test(html), 'index.html 顶部基地名容器已加入');
must(/class="map-base-btn" id="mapCampusBtn"/.test(html), 'index.html 基地名按钮存在');
must(!/map-campus-wrap/.test(html), 'index.html 旧的 map-campus-wrap 已移除');
must(html.indexOf('map-base-bar') < html.indexOf('map-search-entry'), '基地名在搜索框上方（最上面）');
must(/data\.js\?v=20260916-11/.test(html), 'data.js v=20260916-11');
must(/app\.js\?v=20260916-21/.test(html), 'app.js v=20260916-21');
must(/style\.css\?v=20260916-18/.test(html), 'style.css v=20260916-18');

/* --- css --- */
must(/\.map-base-bar\s*\{/.test(css), 'css 有 .map-base-bar');
must(/\.map-base-btn\s*\{/.test(css), 'css 有 .map-base-btn');
must(/\.map-base-btn::after\s*\{[^}]*▾/.test(css), '.map-base-btn 有展开箭头');
const tops = {
  '.map-base-bar': 10, '.map-search-entry': 58, '.map-control': 106, '.map-modes': 158, '.map-right-tools': 254,
};
for (const [sel, top] of Object.entries(tops)) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*top:\\s*' + top + 'px');
  must(re.test(css), sel + ' top = ' + top + 'px');
  must(!new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*top:\\s*(12|60|112|208)px').test(css), sel + ' 无旧 top 残留');
}
must(/\.map-campus-wrap\s*\{\s*display:\s*none;\s*\}/.test(css), '.map-campus-wrap 已改为兼容占位');
must(!/\.map-campus-wrap\s+\.picker/.test(css), 'css 无 .map-campus-wrap .picker 残留');

/* --- app.js --- */
must(/function campusLabel\(campus\)/.test(app), 'app.js 有 campusLabel()');
must(/base_name \|\| campus\.name/.test(app), 'campusLabel 优先取 base_name');
must(/\$\('#mapCampusWrap'\)\.style\.display = \(MAP\.site_data\.length > 1\) \? 'flex' : 'none'/.test(app), 'renderCampusControl 显示条件正确');
must(!/\$\('#mapCampusWrap'\)\.style\.display = 'none'/.test(app), 'renderCampusControl 不再强制隐藏');
must(/function showCampusPicker\(onPick, opts\)/.test(app), 'showCampusPicker 支持 opts');
must(/labels: MAP\.site_data\.map\(\(s\) => s\.base_name \|\| s\.name\), current: state\.mapCampus/.test(app), '地图页传入基地名与 mapCampus');
must(/openModal\('切换基地'/.test(app), '弹窗标题为「切换基地」');
must(/location\.hash = route;/.test(app) && /'#\/qingzhou-map' : '#\/map'/.test(app), 'switchCampus 走 hash 路由（底部 tab 高亮同步）');

/* --- data.js --- */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(ROOT + 'js/data.js', 'utf8'), sandbox);
const sites = sandbox.window.GLU_DATA.map.site_data;
must(sites[0].base_name === '英科医疗淮北基地', '厂区0 base_name = 英科医疗淮北基地');
must(sites[1].base_name === '英科医疗青州基地', '厂区1 base_name = 英科医疗青州基地');
LOG.push('厂区: ' + sites.map(s => s.id + ' ' + s.name + ' / ' + s.base_name).join('  |  '));
must(sites[0].category_list.length === 5, '安徽分类仍为 5 个');
must(sites[0].category_list[0].name === '配套基地', '配套基地仍在第一位');
must(sites[0].category_list[0].list.length === 3, '配套基地 3 个点位');

/* --- 线上实测 --- */
(async () => {
  const base = 'http://127.0.0.1:8000/';
  try {
    const h = await (await fetch(base + 'index.html')).text();
    must(/map-base-btn/.test(h), '服务端 index.html 已含基地名按钮');
    must(/style\.css\?v=20260916-18/.test(h), '服务端 index.html CSS 版本已更新');
  } catch (e) { must(false, 'index.html fetch: ' + e.message); }
  try {
    const d = await (await fetch(base + 'js/data.js')).text();
    must(/英科医疗淮北基地/.test(d), '服务端 data.js 含 base_name');
  } catch (e) { must(false, 'data.js fetch: ' + e.message); }
  try {
    const c = await (await fetch(base + 'css/style.css')).text();
    must(/\.map-base-bar/.test(c), '服务端 style.css 含 .map-base-bar');
  } catch (e) { must(false, 'style.css fetch: ' + e.message); }
  fs.writeFileSync(ROOT + '.workbuddy/_out.txt', LOG.join('\n'), 'utf8');
})();
