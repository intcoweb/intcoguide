/* 地图首页把「丁腈车间 + PVC车间」合并为「生产车间」；基地介绍页不动（读 data.js 原始分类）。
   每个替换断言命中 1 次再写盘。 */
const fs = require('fs');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide';
const APP = ROOT + '/js/app.js';
const HTML = ROOT + '/index.html';
const log = [];
let failed = 0;

function apply(file, label, oldStr, newStr) {
  let src = fs.readFileSync(file, 'utf8');
  const n = src.split(oldStr).length - 1;
  if (n !== 1) { failed++; log.push('[FAIL] ' + label + ' 命中 ' + n + ' 次'); return; }
  fs.writeFileSync(file, src.split(oldStr).join(newStr), 'utf8');
  log.push('[OK]   ' + label);
}

/* 1) mapSiteData：加入地图侧合并规则 */
apply(APP, 'mapSiteData 加入合并规则',
`  function mapSiteData() {
    // siteOnly 分类（如「配套基地」）只服务基地介绍页，无坐标，
    // 不进地图分类条/标记，也不进路线规划的搜索池
    return (mapCampusData().category_list || []).filter((c) => !c.siteOnly);
  }
  /* 地图分类展示列表 = 「全部」虚拟分类 + 真实分类。
     虚拟分类不改动原始数据：点位浅拷贝并挂 _catName 记住来源分类，
     这样弹窗（AREA_GUIDES 按分类名取）与标记配色仍按各自的真实分类走。
     仅用于地图页的分类条与标记渲染；基地介绍页仍用真实分类。 */
  const ALL_CATEGORY_NAME = '全部';
  function mapDisplayCategories() {
    const real = mapSiteData();
    const all = [];
    real.forEach((c) => {
      (c.list || []).forEach((p) => {
        all.push(Object.assign({}, p, { _catName: c.name }));
      });
    });
    return [{ id: 0, name: ALL_CATEGORY_NAME, list: all, virtual: true }].concat(real);
  }`,
`  /* 地图页分类合并规则：把若干细分车间在「地图页」合成一个分类展示。
     ⚠️ 只作用在地图侧（mapSiteData 的派生结果），data.js 原始分类不动，
     所以基地介绍页仍是「丁腈车间 / PVC车间」两个分类。
     合并出来的点位会挂 _catName = 来源分类名：弹窗文案（openGuideDialog 按分类名取
     AREA_GUIDES）与标记配色（markerToneOf）仍按各自原分类走 ——
     即「生产车间」里丁腈线的点是青色、PVC线的点仍是原来的颜色。
     id 取该组第一个来源分类的位置，用不到分类 id 的地方不受影响。 */
  const MAP_CATEGORY_MERGE = [
    { id: 7, name: '生产车间', from: ['丁腈车间', 'PVC车间'] },
  ];
  function mapSiteData() {
    // siteOnly 分类（如「配套基地」）只服务基地介绍页，无坐标，
    // 不进地图分类条/标记，也不进路线规划的搜索池
    const real = (mapCampusData().category_list || []).filter((c) => !c.siteOnly);
    const out = [];
    const done = {};
    real.forEach((c) => {
      const rule = MAP_CATEGORY_MERGE.filter((r) => r.from.indexOf(c.name) !== -1)[0];
      if (!rule) { out.push(c); return; }
      if (done[rule.name]) return;   // 同一组的第二个来源分类：点位已在上面收走，跳过
      done[rule.name] = true;
      const list = [];
      rule.from.forEach((fname) => {
        const src = real.filter((x) => x.name === fname)[0];
        ((src && src.list) || []).forEach((p) => list.push(Object.assign({}, p, { _catName: fname })));
      });
      // 占位沿用该组第一个来源分类原本的位置，保持分类条顺序稳定
      out.push({ id: rule.id, name: rule.name, merged: true, from: rule.from.slice(), list: list });
    });
    return out;
  }
  /* 地图分类展示列表 = 「全部」虚拟分类 + 真实分类（已按合并规则分组）。
     虚拟分类不改动原始数据：点位浅拷贝并挂 _catName 记住来源分类，
     这样弹窗（AREA_GUIDES 按分类名取）与标记配色仍按各自的真实分类走。
     仅用于地图页的分类条与标记渲染；基地介绍页仍用真实分类。 */
  const ALL_CATEGORY_NAME = '全部';
  function mapDisplayCategories() {
    const real = mapSiteData();
    const all = [];
    real.forEach((c) => {
      (c.list || []).forEach((p) => {
        // 合并分类的点已自带 _catName（来源分类），不能被「生产车间」覆盖 ——
        // 否则弹窗会退化成生产车间兜底配置、标记也会丢掉原配色
        all.push(Object.assign({}, p, { _catName: p._catName || c.name }));
      });
    });
    return [{ id: 0, name: ALL_CATEGORY_NAME, list: all, virtual: true }].concat(real);
  }`);

/* 2) AREA_GUIDES 兜底：万一「生产车间」被当成分类名传进弹窗，
      也不要落到「生活配套」那套配置（它带 hideVoice，会把语音按钮藏掉） */
apply(APP, 'AREA_GUIDES 补生产车间兜底',
`    '展厅': {
      en: 'EXHIBITION HALL', subtitle: '集团展厅 · 参观起点', hideSteps: true,
      steps: []
    },`,
`    /* 兜底项：地图页的「生产车间」是把丁腈/PVC 两个车间合并出来的展示分类，
       正常路径下点位会带 _catName 走各自原分类的配置，走不到这里。
       留着是为了避免误落到「生活配套」那套（它 hideVoice，会藏掉语音按钮）。 */
    '生产车间': {
      en: 'PRODUCTION / WORKSHOP', subtitle: '手套生产车间',
      steps: [
        { t: '配料投料', d: '按配方进行原料配料与投料。' },
        { t: '浸渍成型', d: '生产线完成手套浸渍、成型。' },
        { t: '烘干包装', d: '烘干、脱模后检验并包装入库。' }
      ]
    },
    '展厅': {
      en: 'EXHIBITION HALL', subtitle: '集团展厅 · 参观起点', hideSteps: true,
      steps: []
    },`);

/* 3) 版本号 */
apply(HTML, 'index.html app.js 版本号 -24',
`    <script src="js/app.js?v=20260916-23"></script>`,
`    <script src="js/app.js?v=20260916-24"></script>`);

fs.writeFileSync(ROOT + '/.workbuddy/apply.log', log.join('\n') + '\n\nfailed=' + failed, 'utf8');
