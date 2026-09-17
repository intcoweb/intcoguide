/* 校验：新增「上游配套基地」只进基地介绍页，不进地图页/搜索 */
const fs = require('fs');
const vm = require('vm');
const root = 'C:/Users/INTCO/Desktop/桂校导航/web-guide';

const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(root + '/js/data.js', 'utf8'), sb);
const D = sb.window.GLU_DATA;

let bad = 0;
const fail = (m) => { bad++; console.log('  ! ' + m); };

console.log('=== 安徽英科医疗 分类 ===');
D.map.site_data[0].category_list.forEach((c) => {
  console.log('  id=' + c.id + '  ' + c.name + '  ' + (c.list || []).length + ' 个点位  siteOnly=' + !!c.siteOnly);
});

// 1) 基地介绍页分类（= category_list 原样）
const siteCats = D.map.site_data[0].category_list;
if (siteCats[siteCats.length - 1].name !== '上游配套基地') fail('新分类不在最后（生活配套之后）');
if (siteCats.length !== 5) fail('分类数应为 5，实际 ' + siteCats.length);

// 2) 模拟 app.js 的 mapSiteData()
const mapCats = siteCats.filter((c) => !c.siteOnly);
console.log('\n=== 地图页分类（过滤 siteOnly 后）===');
console.log('  ' + mapCats.map((c) => c.name).join(' / '));
if (mapCats.length !== 4) fail('地图页分类数应为 4，实际 ' + mapCats.length);
if (mapCats.some((c) => c.name === '上游配套基地')) fail('上游配套基地出现在地图页');

// 3) 模拟 mapDisplayCategories() 的「全部」池
const real = mapCats;
const all = [];
real.forEach((c) => (c.list || []).forEach((p) => all.push(p)));
console.log('\n=== 地图「全部」点位总数 ===\n  ' + all.length + ' 个');
if (all.some((p) => /国毅|英彩|凯泽/.test(p.name))) fail('三个基地混进了地图「全部」');
if (all.some((p) => p.latitude === undefined)) fail('地图点位里有缺坐标的');

// 4) 三个基地字段完整性
console.log('\n=== 上游配套基地三个点位 ===');
const bases = siteCats.filter((c) => c.siteOnly)[0].list;
bases.forEach((p) => {
  const imgOk = fs.existsSync(root + '/' + p.img);
  console.log('  ' + [p.name, p.duration, p.aliases, imgOk ? 'OK' : '图片缺失'].join(' | '));
  if (!imgOk) fail(p.name + ' 图片缺失');
  if (!p.desc || p.desc.length < 12) fail(p.name + ' desc 过短');
  if (p.latitude !== undefined) fail(p.name + ' 不该有坐标');
});
if (bases.length !== 3) fail('基地数应为 3');

// 5) AREA_GUIDES 覆盖
const app = fs.readFileSync(root + '/js/app.js', 'utf8');
console.log('\n=== app.js 检查 ===');
[
  ["'上游配套基地': {", 'AREA_GUIDES 新分类配置'],
  ['!c.siteOnly', 'mapSiteData 过滤 siteOnly'],
  ['const site_data = mapSiteData();', 'goSearch 用地图数据池'],
  ['site-card-dur', '卡片时长徽标'],
].forEach(([k, label]) => console.log('  ' + (app.includes(k) ? 'OK  ' : 'MISS') + ' ' + label));

console.log('\n' + (bad ? '❌ 失败 ' + bad + ' 项' : '✅ 全部通过'));
