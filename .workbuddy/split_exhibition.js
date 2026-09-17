const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const P = ROOT + 'js/data.js';
const LOG = [];
const must = (c, m) => { if (!c) throw new Error('断言失败: ' + m); LOG.push('OK  ' + m); };

let s = fs.readFileSync(P, 'utf8');
const orig = s;

/* --- 1. 摘出「展厅」点位对象 --- */
const pStartMark = '              {\n                "id": 1,\n                "name": "展厅",';
must(s.indexOf(pStartMark) === s.lastIndexOf(pStartMark), '展厅点位块唯一');
const pStart = s.indexOf(pStartMark);
must(pStart > -1, '找到展厅点位块');
const pEnd = s.indexOf('\n              },', pStart);
must(pEnd > pStart, '找到展厅块结尾');
const point = s.slice(pStart, pEnd + '\n              }'.length); // 不含尾逗号
must(point.endsWith('"longitude": 116.7265027\n              }'), '展厅块内容完整');
const removeTo = pEnd + '\n              },\n'.length;
s = s.slice(0, pStart) + s.slice(removeTo);
must(!s.includes(pStartMark), '展厅已从「参观讲解」中摘除');

/* --- 2. 分类改名 参观讲解 -> 环保仓储 --- */
must((s.match(/"name": "参观讲解"/g) || []).length === 2, '改名点恰好 2 处（安徽分类 + 青州占位）');
s = s.replace('"name": "参观讲解",\n', '"name": "环保仓储",\n');
s = s.replace('"name": "参观讲解", "list": []', '"name": "环保仓储", "list": []');
must(!s.includes('参观讲解'), 'data.js 已无「参观讲解」');

/* --- 3. 环保仓储内剩余点位 id 重排 2..7 -> 1..6 --- */
const renumber = [
  ['"id": 2,\n                "name": "污水处理一期"', '"id": 1,\n                "name": "污水处理一期"'],
  ['"id": 3,\n                "name": "污水处理二期"', '"id": 2,\n                "name": "污水处理二期"'],
  ['"id": 4,\n                "name": "煤场一期"', '"id": 3,\n                "name": "煤场一期"'],
  ['"id": 5,\n                "name": "煤场二期"', '"id": 4,\n                "name": "煤场二期"'],
  ['"id": 6,\n                "name": "烟气回收设备"', '"id": 5,\n                "name": "烟气回收设备"'],
  ['"id": 7,\n                "name": "仓库"', '"id": 6,\n                "name": "仓库"'],
];
for (const [o, n] of renumber) { must(s.includes(o), '找到 ' + o.replace(/\n\s*/g, ' ')); s = s.replace(o, n); }
LOG.push('OK  环保仓储 内 6 个点位 id 已重排为 1..6');

/* --- 4. 新建「展厅」分类，插在「环保仓储」之前 --- */
const anchor = '          {\n            "id": 3,\n            "name": "环保仓储",';
must(s.includes(anchor), '找到环保仓储分类块');
must(s.indexOf(anchor) === s.lastIndexOf(anchor), '环保仓储分类块唯一');
const newCat = '          {\n            "id": 6,\n            "name": "展厅",\n            "list": [\n' +
  point + '\n            ]\n          },\n';
s = s.replace(anchor, newCat + anchor);
must(s.includes(newCat), '展厅分类块已插入');

fs.writeFileSync(P, s, 'utf8');
must(s !== orig, '文件已写入');

/* --- 5. 结构校验 --- */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(P, 'utf8'), sandbox);
const sites = sandbox.window.GLU_DATA.map.site_data;
const cats = sites[0].category_list;
LOG.push('安徽分类顺序: ' + cats.map(c => c.id + ':' + c.name + '(' + c.list.length + ')').join(' > ').replace(/\)>/, ') > '));
must(cats.map(c => c.name).join(',') === '配套基地,丁腈车间,PVC车间,展厅,环保仓储,生活配套', '分类与顺序正确');
const ex = cats.find(c => c.name === '展厅');
must(ex.list.length === 1 && ex.list[0].name === '展厅', '展厅分类仅含 1 个点位');
must(ex.list[0].guideKey === 'exhibition', '展厅 guideKey 仍为 exhibition');
must(ex.list[0].img === 'assets/images/showroom.webp', '展厅图片仍为 showroom.webp');
must(ex.list[0].latitude === 33.8720811 && ex.list[0].longitude === 116.7265027, '展厅坐标未变');
const env = cats.find(c => c.name === '环保仓储');
must(env.list.length === 6, '环保仓储含 6 个点位');
must(env.list.map(p => p.name).join(',') === '污水处理一期,污水处理二期,煤场一期,煤场二期,烟气回收设备,仓库', '环保仓储点位齐全且顺序不变');
must(env.list.map(p => p.id).join(',') === '1,2,3,4,5,6', '环保仓储 id 连续 1..6');
must(env.list.map(p => p.guideKey).join(',') === 'sewage,sewage,coal,coal,smoke,warehouse', '环保仓储 guideKey 未被破坏');
const total = sites.reduce((n, st) => n + st.category_list.reduce((m, c) => m + c.list.length, 0), 0);
must(total === 23, '点位总数仍为 23（实际 ' + total + '）');
must(sites[1].category_list.map(c => c.name).join(',') === '丁腈车间,PVC车间,环保仓储,生活配套', '青州占位分类已同步改名');

fs.writeFileSync(ROOT + '.workbuddy/_out.txt', LOG.join('\n'), 'utf8');
