const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const LOG = [];
const must = (c, m) => LOG.push((c ? 'OK  ' : 'FAIL  ') + m);

/* --- 静态检查 --- */
const files = ['js/app.js', 'js/data.js', 'index.html'];
for (const f of files) {
  const t = fs.readFileSync(ROOT + f, 'utf8');
  must(!/上游配套基地/.test(t), f + ' 无「上游配套基地」残留');
  if (f === 'js/app.js') must(/'配套基地':/.test(t), f + ' AREA_GUIDES 键已改为「配套基地」');
}
const css = fs.readFileSync(ROOT + 'css/style.css', 'utf8');
must(!/上游配套基地/.test(css), 'css 无「上游配套基地」残留');
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
must(/data\.js\?v=20260916-10/.test(html), 'index.html data.js v=20260916-10');
must(/app\.js\?v=20260916-20/.test(html), 'index.html app.js v=20260916-20');

/* --- 结构检查 --- */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(ROOT + 'js/data.js', 'utf8'), sandbox);
const sites = sandbox.window.GLU_DATA.map.site_data;
const cats = sites[0].category_list;
LOG.push('厂商分类顺序: ' + cats.map(c => c.name).join(' > '));
must(cats[0].name === '配套基地', '基地介绍页第一位 = 配套基地');
must(cats[0].siteOnly === true, '配套基地仍为 siteOnly（不进地图）');
must(cats.map(c => c.name).join(',') === '配套基地,丁腈车间,PVC车间,参观讲解,生活配套', '其余分类顺序未变');
const office = cats.find(c => c.name === '生活配套').list.find(p => p.name === '办公室');
must(office.img === 'assets/images/office.png', '办公室 img = assets/images/office.png');
must(!fs.existsSync(ROOT + 'assets/images/office.webp'), 'office.webp 已清理');

/* --- 线上实测 --- */
(async () => {
  const base = 'http://127.0.0.1:8000/';
  const probes = ['assets/images/office.png', 'assets/images/showroom.webp', 'index.html', 'js/data.js', 'js/app.js'];
  for (const u of probes) {
    try {
      const r = await fetch(base + u, { method: 'HEAD' });
      must(r.status === 200, u + ' -> ' + r.status + ' ' + (r.headers.get('content-type') || '-'));
    } catch (e) { must(false, u + ' -> ' + e.message); }
  }
  try {
    const t = await (await fetch(base + 'js/data.js')).text();
    must(/assets\/images\/office\.png/.test(t), '服务端 data.js 已含 office.png');
    must(!/上游配套基地/.test(t), '服务端 data.js 无旧分类名');
  } catch (e) { must(false, 'data.js fetch: ' + e.message); }
  fs.writeFileSync(ROOT + '.workbuddy/_out.txt', LOG.join('\n'), 'utf8');
})();
