const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const LOG = [];
const must = (c, m) => LOG.push((c ? 'OK  ' : 'FAIL  ') + m);

const app = fs.readFileSync(ROOT + 'js/app.js', 'utf8');
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const css = fs.readFileSync(ROOT + 'css/style.css', 'utf8');

/* --- app.js 三处按分类名取键的映射 --- */
must(!/参观讲解/.test(app), 'app.js 无「参观讲解」残留');
must(/'展厅': \{\s*\n\s*en: 'EXHIBITION HALL'/.test(app), 'AREA_GUIDES 新增「展厅」');
must(/en: 'ENVIRONMENT \/ STORAGE'/.test(app), 'AREA_GUIDES 新增「环保仓储」');
must(/'展厅': '🏛️'/.test(app) && /'环保仓储': '♻️'/.test(app), 'icons 表已更新');
must(/'展厅': 'storage'/.test(app) && /'环保仓储': 'eco'/.test(app), 'tones 表已更新');
/* 展厅的讲解内容来自 guides.exhibition，必须 hideSteps（否则会去取 AREA_GUIDES.steps 空数组） */
must(/'展厅': \{[\s\S]{0,200}hideSteps: true/.test(app), '展厅 hideSteps: true');
must(/'环保仓储': \{[\s\S]{0,200}hideSteps: true/.test(app), '环保仓储 hideSteps: true');

/* --- index.html / css --- */
must(/data\.js\?v=20260916-12/.test(html), 'data.js v=20260916-12');
must(/app\.js\?v=20260916-22/.test(html), 'app.js v=20260916-22');
must(!/参观讲解/.test(html), 'index.html 无「参观讲解」');

/* --- data.js --- */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(ROOT + 'js/data.js', 'utf8'), sandbox);
const sites = sandbox.window.GLU_DATA.map.site_data;
const cats = sites[0].category_list;
must(cats.map(c => c.name).join(',') === '配套基地,丁腈车间,PVC车间,展厅,环保仓储,生活配套', '分类顺序: ' + cats.map(c => c.name).join(' > '));
const ex = cats.find(c => c.name === '展厅');
must(ex && ex.list.length === 1 && ex.list[0].name === '展厅', '展厅独立成分类（1 个点位）');
must(ex.list[0].guideKey === 'exhibition' && ex.list[0].img === 'assets/images/showroom.webp', '展厅讲解与配图保留');
const env = cats.find(c => c.name === '环保仓储');
must(env && env.list.length === 6, '环保仓储含 6 个点位');
must(env.list.map(p => p.name).join(',') === '污水处理一期,污水处理二期,煤场一期,煤场二期,烟气回收设备,仓库', '环保仓储点位顺序不变');
/* 每个点位的 guideKey 都能在 guides 里找到讲解词 */
const guides = sandbox.window.GLU_DATA.guides || {};
const missing = [];
for (const st of sites) for (const c of st.category_list) for (const p of c.list) {
  if (p.guideKey && !guides[p.guideKey]) missing.push(p.name + '->' + p.guideKey);
}
must(missing.length === 0, '所有 guideKey 均有讲解词' + (missing.length ? ' 缺: ' + missing.join(', ') : ''));
const noKey = [];
for (const st of sites) for (const c of st.category_list) for (const p of c.list) {
  if (!p.guideKey) noKey.push(c.name + '/' + p.name);
}
LOG.push('INFO  无 guideKey 的点位: ' + (noKey.length ? noKey.join(', ') : '无'));

/* --- 线上实测 --- */
(async () => {
  const base = 'http://127.0.0.1:8000/';
  for (const [u, re, label] of [
    ['js/data.js', /环保仓储/, 'data.js 含环保仓储'],
    ['js/data.js', /"name": "展厅"/, 'data.js 含展厅分类'],
    ['js/app.js', /EXHIBITION HALL/, 'app.js 含展厅配置'],
    ['index.html', /data\.js\?v=20260916-12/, 'index.html 版本已生效'],
  ]) {
    try {
      const t = await (await fetch(base + u)).text();
      must(re.test(t), label + '（服务端）');
      if (u === 'js/data.js') must(!/参观讲解/.test(t), 'data.js 无参观讲解（服务端）');
    } catch (e) { must(false, label + ' fetch: ' + e.message); }
  }
  fs.writeFileSync(ROOT + '.workbuddy/_out.txt', LOG.join('\n'), 'utf8');
})();
