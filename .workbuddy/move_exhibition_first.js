const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const P = ROOT + 'js/data.js';
const LOG = [];
const must = (c, m) => { if (!c) throw new Error('断言失败: ' + m); LOG.push('OK  ' + m); };

let s = fs.readFileSync(P, 'utf8');
const orig = s;

/* 1. 摘出「展厅」分类块 */
const startMark = '          {\n            "id": 6,\n            "name": "展厅",';
must(s.indexOf(startMark) === s.lastIndexOf(startMark), '展厅分类块唯一');
const bs = s.indexOf(startMark);
must(bs > -1, '找到展厅分类块');
const be = s.indexOf('\n          },\n', bs);
must(be > bs, '找到展厅块结尾');
const block = s.slice(bs, be + '\n          },\n'.length);
must(block.endsWith('          },\n'), '块含尾逗号');
s = s.slice(0, bs) + s.slice(bs + block.length);
must(!s.includes(startMark), '展厅块已摘除');

/* 2. 插到「配套基地」块之后、「丁腈车间」之前 */
const anchor = '          {\n            "id": 1,\n            "name": "丁腈车间",';
must(s.indexOf(anchor) === s.lastIndexOf(anchor), '丁腈车间分类块唯一');
/* anchor 之前必须是配套基地块的收尾 */
const before = s.slice(s.indexOf(anchor) - 40, s.indexOf(anchor));
must(/^[\s\S]*?\},?\n$/.test(before), '锚点前是上一个分类的收尾: ' + JSON.stringify(before.slice(-20)));
s = s.replace(anchor, block + anchor);
must(s.includes(block + anchor), '展厅块已插到配套基地之后');
must(s !== orig, '文件已修改');
fs.writeFileSync(P, s, 'utf8');

/* 3. 结构 + 两个页面的实际顺序校验 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(P, 'utf8'), sandbox);
const sites = sandbox.window.GLU_DATA.map.site_data;
const cats = sites[0].category_list;

LOG.push('OK  基地介绍页顺序: ' + cats.map(c => c.name).join(' > '));
LOG.push('OK  地图页顺序(模拟 mapDisplayCategories): 全部 > ' + cats.filter(c => !c.siteOnly).map(c => c.name).join(' > '));

must(cats.map(c => c.name).join(',') === '配套基地,展厅,丁腈车间,PVC车间,环保仓储,生活配套', '分类顺序正确');
must(cats[0].name === '配套基地' && cats[0].siteOnly === true, '基地介绍页第一位仍是配套基地');
const mapOrder = ['全部'].concat(cats.filter(c => !c.siteOnly).map(c => c.name));
must(mapOrder[1] === '展厅', '地图页「全部」后面紧跟展厅');
must(cats.find(c => c.name === '展厅').list.length === 1, '展厅仍为 1 个点位');
must(cats.find(c => c.name === '展厅').list[0].guideKey === 'exhibition', '展厅 guideKey 未变');
must(cats.find(c => c.name === '环保仓储').list.length === 6, '环保仓储仍 6 个点位');
const total = sites.reduce((n, st) => n + st.category_list.reduce((m, c) => m + c.list.length, 0), 0);
must(total === 23, '点位总数仍为 23');
must(sites[1].category_list.length === 4, '青州占位分类未受影响');

fs.writeFileSync(ROOT + '.workbuddy/_out.txt', LOG.join('\n'), 'utf8');
