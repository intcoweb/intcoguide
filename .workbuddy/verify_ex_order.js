const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const LOG = [];
const must = (c, m) => LOG.push((c ? 'OK  ' : 'FAIL  ') + m);

const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
must(/data\.js\?v=20260916-13/.test(html), 'index.html data.js v=20260916-13');
must(/app\.js\?v=20260916-22/.test(html), 'index.html app.js v=20260916-22');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(ROOT + 'js/data.js', 'utf8'), sandbox);
const sites = sandbox.window.GLU_DATA.map.site_data;
const cats = sites[0].category_list;

/* 基地介绍页：真实分类（无「全部」） */
const siteOrder = cats.map(c => c.name);
LOG.push('INFO  基地介绍页: ' + siteOrder.join(' > '));
/* 地图页：虚拟「全部」+ 过滤掉 siteOnly */
const mapOrder = ['全部'].concat(cats.filter(c => !c.siteOnly).map(c => c.name));
LOG.push('INFO  地图页: ' + mapOrder.join(' > '));

must(siteOrder.join(',') === '配套基地,展厅,丁腈车间,PVC车间,环保仓储,生活配套', '基地介绍页顺序');
must(mapOrder.join(',') === '全部,展厅,丁腈车间,PVC车间,环保仓储,生活配套', '地图页顺序（展厅紧跟全部）');
must(cats[0].siteOnly === true && cats[0].name === '配套基地', '配套基地仍居首位（基地介绍页）');

/* 展厅内容完整性 */
const ex = cats.find(c => c.name === '展厅');
must(ex.list.length === 1 && ex.list[0].guideKey === 'exhibition' && ex.list[0].img === 'assets/images/showroom.webp', '展厅 1 点位 / guideKey / 配图');
const guides = sandbox.window.GLU_DATA.guides || {};
must(!!guides.exhibition, 'guides.exhibition 讲解词存在');
must(Array.isArray(guides.exhibition.sections) && guides.exhibition.sections.length > 0, '展厅讲解段落 ' + (guides.exhibition.sections || []).length + ' 段');

/* 图片文件存在性 */
const miss = [];
for (const st of sites) for (const c of st.category_list) for (const p of c.list) {
  if (p.img && !fs.existsSync(ROOT + p.img)) miss.push(p.img);
}
must(miss.length === 0, '所有点位图片文件存在');

(async () => {
  const base = 'http://127.0.0.1:8000/';
  try {
    const d = await (await fetch(base + 'js/data.js')).text();
    const i1 = d.indexOf('"name": "配套基地"');
    const i2 = d.indexOf('"name": "展厅"');
    const i3 = d.indexOf('"name": "丁腈车间"');
    must(i1 > -1 && i1 < i2 && i2 < i3, '服务端 data.js 顺序: 配套基地 < 展厅 < 丁腈车间');
    must(!/参观讲解/.test(d), '服务端 data.js 无「参观讲解」');
  } catch (e) { must(false, 'data.js fetch: ' + e.message); }
  try {
    const h = await (await fetch(base + 'index.html')).text();
    must(/data\.js\?v=20260916-13/.test(h), '服务端 index.html 版本已生效');
  } catch (e) { must(false, 'index.html fetch: ' + e.message); }
  try {
    const a = await (await fetch(base + 'js/app.js')).text();
    must(/EXHIBITION HALL/.test(a) && !/参观讲解/.test(a), '服务端 app.js 已更新且无旧名');
  } catch (e) { must(false, 'app.js fetch: ' + e.message); }
  fs.writeFileSync(ROOT + '.workbuddy/_out.txt', LOG.join('\n'), 'utf8');
})();
