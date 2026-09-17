const fs = require('fs');
const vm = require('vm');

const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const P = ROOT + 'js/data.js';
const SRC_PNG = 'C:/Users/INTCO/.workbuddy/clipboard-images/clipboard-2026-09-16T07-05-59-232Z-3e3fe070.png';
const LOG = [];

function must(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  LOG.push('OK  ' + msg);
}

let s = fs.readFileSync(P, 'utf8');
const orig = s;

/* 1. 办公室图片：直接原样拷贝 PNG，不做格式转换 */
fs.copyFileSync(SRC_PNG, ROOT + 'assets/images/office.png');
must(fs.statSync(ROOT + 'assets/images/office.png').size === fs.statSync(SRC_PNG).size,
  'office.png 字节数与源文件一致 (' + (fs.statSync(SRC_PNG).size / 1024).toFixed(1) + ' KB)');

{ // 悬空产物清理：上一轮转出来的 webp 已无用途
  const w = ROOT + 'assets/images/office.webp';
  if (fs.existsSync(w)) { fs.unlinkSync(w); LOG.push('OK  删除未使用的 office.webp'); }
}

/* 2. 办公室 img 指向新图 */
{
  const o = '"name": "办公室",\n                "aliases": "办公区域",\n                "img": "assets/images/exhibition.webp",';
  const n = '"name": "办公室",\n                "aliases": "办公区域",\n                "img": "assets/images/office.png",';
  must(s.includes(o), '找到办公室点位');
  s = s.replace(o, n);
  must(s.includes(n), '办公室 img -> assets/images/office.png');
}

/* 3. 分类改名：上游配套基地 -> 配套基地 */
{
  must((s.match(/"上游配套基地"/g) || []).length === 1, '「上游配套基地」在 data.js 中恰好 1 处');
  s = s.replace('"name": "上游配套基地",', '"name": "配套基地",');
  must(!s.includes('上游配套基地'), 'data.js 已无「上游配套基地」残留');
}

/* 4. 把「配套基地」整块搬到 category_list 第一位 */
{
  const startMark = '          {\n            "id": 5,\n            "name": "配套基地",';
  must(s.indexOf(startMark) === s.lastIndexOf(startMark), '配套基地块唯一');

  const bs = s.indexOf(startMark);
  const endTag = '\n          }\n        ]';
  const be = s.indexOf(endTag, bs);
  must(be > bs, '找到配套基地块的结尾');
  const block = s.slice(bs, be + '\n          }'.length);
  must(block.startsWith('          {') && block.endsWith('          }'), '块首尾形态正确');
  must((block.match(/\n/g) || []).length > 20, '块内含三个点位 (' + (block.match(/\n/g) || []).length + ' 行)');

  // 从原位置摘除（连同它前面那个属于「生活配套」的逗号）
  const oldTail = '            ]\n          },\n' + block + '\n        ]';
  must(s.includes(oldTail), '定位「生活配套 ] } , 块 ]」的原尾部');
  s = s.replace(oldTail, '            ]\n          }\n        ]');

  // 插到 category_list 开头
  const head = '        "category_list": [\n';
  const h = s.indexOf(head);
  must(h > -1, '找到安徽厂区 category_list 开头');
  const after = s.slice(h + head.length);
  must(after.startsWith('          {\n            "id": 1,'), '原首元素是 id=1 丁腈车间');
  s = s.slice(0, h + head.length) + block + ',\n' + after;
  must(s.includes(head + block + ',\n'), '块已置于第一位并补上逗号');
}

must(s !== orig, '文件已修改');
fs.writeFileSync(P, s, 'utf8');

/* 5. 语法与结构校验 */
try {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(P, 'utf8'), sandbox);
  const sites = sandbox.window.GLU_DATA.map.site_data;
  must(sites.length === 2, '厂区数 = 2');
  const cats = sites[0].category_list;
  LOG.push('OK  安徽厂区分类顺序: ' + cats.map(c => c.id + ':' + c.name + (c.siteOnly ? '(siteOnly)' : '')).join(' -> '));
  must(cats[0].name === '配套基地' && cats[0].siteOnly === true, '第一位 = 配套基地(siteOnly)');
  must(cats[0].list.length === 3, '配套基地含 3 个点位');
  must(cats[0].list[0].img === 'assets/images/bases/guoyi-mold.webp', '首个点位图未被打乱');

  const office = cats.find(c => c.name === '生活配套').list.find(p => p.name === '办公室');
  must(office.img === 'assets/images/office.png', '办公室 img = assets/images/office.png');
  must(office.latitude === 33.8722432, '办公室坐标未变');

  // 全量图片文件存在性
  const miss = [];
  const cnt = {};
  for (const st of sites) for (const c of st.category_list) for (const p of c.list) {
    if (p.img) { cnt[p.img] = (cnt[p.img] || 0) + 1; if (!fs.existsSync(ROOT + p.img)) miss.push(p.img); }
  }
  must(miss.length === 0, '所有点位图片文件均存在');
  LOG.push('OK  图片引用: ' + Object.keys(cnt).sort().map(k => cnt[k] + 'x ' + k.replace('assets/images/', '')).join(' | '));
} catch (e) {
  LOG.push('结构校验异常: ' + (e && e.message));
  throw e;
}

fs.writeFileSync(ROOT + '.workbuddy/_out.txt', LOG.join('\n'), 'utf8');
