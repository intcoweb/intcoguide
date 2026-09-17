/* 一次性脚本：
   1) 底部「青州地图」tab 从 index.html 移除
   2) 地图页 state.mapCampus 与基地介绍页 state.choose 合并为 state.campus，
      两处切换互相联动
   3) app.js 版本号 +1
   每个替换都要求命中次数为 1，未命中/多命中即报错退出，避免静默改坏。 */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide';
const APP = path.join(ROOT, 'js/app.js');
const HTML = path.join(ROOT, 'index.html');

const log = [];
let failed = 0;

function apply(file, label, oldStr, newStr, expect) {
  const want = expect == null ? 1 : expect;
  let src = fs.readFileSync(file, 'utf8');
  const n = src.split(oldStr).length - 1;
  if (n !== want) {
    failed++;
    log.push('[FAIL] ' + label + ' 命中 ' + n + ' 次（期望 ' + want + '）');
    return;
  }
  src = src.split(oldStr).join(newStr);
  fs.writeFileSync(file, src, 'utf8');
  log.push('[OK]   ' + label + ' x' + n);
}

/* ---------------- app.js ---------------- */

apply(APP, 'state 声明：合并 campus', `    mapCampus: 0,        // 地图页当前厂区（0=淮北 1=青州）
    appliedCampus: -1,   // 已经渲染到地图上的厂区`,
`    campus: 0,           // 当前基地（0=淮北 1=青州）—— 地图页与基地介绍页共用
    appliedCampus: -1,   // 已经渲染到地图上的基地`);

apply(APP, 'currentCampus 读 campus',
`    return MAP.site_data[state.choose] || MAP.site_data[0];`,
`    return MAP.site_data[state.campus] || MAP.site_data[0];`);

apply(APP, 'mapCampusData 读 campus + 注释',
`  /* 地图页当前厂区：由底部 tab（地图 / 青州地图）决定 */
  function mapCampusData() {
    return MAP.site_data[state.mapCampus] || MAP.site_data[0];
  }`,
`  /* 地图页当前基地：与基地介绍页共用 state.campus */
  function mapCampusData() {
    return MAP.site_data[state.campus] || MAP.site_data[0];
  }`);

apply(APP, 'setActiveTab：青州高亮到地图 tab',
`    // 「地图」与「青州地图」共用同一个页面，只是厂区数据不同
    const pageId = (tab === 'qingzhou-map') ? 'map' : tab;
    const page = $('#page-' + pageId);
    if (page) page.classList.add('active');

    $$('.tab-item').forEach((t) => {
      const active = t.dataset.route === '#/' + tab;`,
`    // 「地图」与「青州地图」共用同一个页面，只是基地数据不同
    const pageId = (tab === 'qingzhou-map') ? 'map' : tab;
    const page = $('#page-' + pageId);
    if (page) page.classList.add('active');

    // 底部「青州地图」tab 已移除：深链 #/qingzhou-map 时高亮「地图」
    const activeRoute = '#/' + ((tab === 'qingzhou-map') ? 'map' : tab);
    $$('.tab-item').forEach((t) => {
      const active = t.dataset.route === activeRoute;`);

apply(APP, 'navigate：进地图页不再重置基地',
`      if (name === 'map') { state.mapCampus = 0; onMapShow(); }
      if (name === 'qingzhou-map') { state.mapCampus = 1; onMapShow(); }
      if (name === 'site') onSiteShow();`,
`      // 基地索引已统一到 state.campus：进地图页不再强制回淮北，
      // 这样在基地介绍页切了基地、再回地图，看到的还是同一个基地。
      if (name === 'qingzhou-map') state.campus = 1;
      if (name === 'map' || name === 'qingzhou-map') onMapShow();
      if (name === 'site') onSiteShow();`);

apply(APP, '未知路由回地图：不重置基地',
`      hideSub();
      state.mapCampus = 0;
      setActiveTab('map');
      onMapShow();`,
`      hideSub();
      setActiveTab('map');
      onMapShow();`);

apply(APP, 'updateSiteCampusBtn 读 campus',
`      $('#siteCampusBtn').textContent = state.campus_name_list[state.choose];`,
`      $('#siteCampusBtn').textContent = state.campus_name_list[state.campus];`);

apply(APP, '基地介绍页切换走 switchCampus',
`    $('#siteCampusBtn').addEventListener('click', () => showCampusPicker((i) => {
      state.choose = i;
      state.siteCategory = 0;
      updateSiteCampusBtn();
      renderSiteCategory();
    }));`,
`    // 与地图页顶部胶囊共用 switchCampus：切一次，两页一起变
    $('#siteCampusBtn').addEventListener('click', () => showCampusPicker((i) => switchCampus(i)));`);

apply(APP, 'showCampusPicker 注释',
`  /* opts.labels：弹窗选项文案；opts.current：当前项索引。
     地图页与基地介绍页各有自己的厂区索引（mapCampus / choose），必须分别传入，
     否则地图上切到青州后弹窗里的 ✓ 会停在基地介绍页的那个厂区上。 */`,
`  /* opts.labels：弹窗选项文案；opts.current：当前项索引（缺省用全局 state.campus）。
     地图页与基地介绍页已共用同一个基地索引，两边弹出的 ✓ 永远一致。 */`);

apply(APP, 'showCampusPicker 默认当前项',
`    const current = (typeof o.current === 'number') ? o.current : state.choose;`,
`    const current = (typeof o.current === 'number') ? o.current : state.campus;`);

apply(APP, 'onMapShow 比较 campus',
`    // 地图 / 青州地图 共用同一套实现：只有真正换了厂区才重载数据，
    // 同一个 tab 来回切（如从搜索页返回）保留已选起终点。
    if (state.mapCampus !== state.appliedCampus) {`,
`    // 地图页与基地介绍页共用 state.campus：只有真正换了基地才重载数据，
    // 从子页返回（如搜索页）时保留已选起终点。
    if (state.campus !== state.appliedCampus) {`);

apply(APP, 'initMap 弹窗当前项',
`      { labels: MAP.site_data.map((s) => s.base_name || s.name), current: state.mapCampus }`,
`      { labels: MAP.site_data.map((s) => s.base_name || s.name), current: state.campus }`);

apply(APP, '地图搜索不再同步 choose',
`      state.choose = state.mapCampus;
      state.searchTarget = 0;`,
`      state.searchTarget = 0;`);

apply(APP, 'applyCampus 记录 appliedCampus',
`    state.appliedCampus = state.mapCampus;`,
`    state.appliedCampus = state.campus;`);

apply(APP, 'switchCampus 重写为两页联动',
`  /* 地图页顶部基地名切换：走 hash 路由，这样底部 tab 高亮与厂区数据会一起换 */
  function switchCampus(i) {
    const route = i === 1 ? '#/qingzhou-map' : '#/map';
    if (location.hash === route) {
      // hash 没变不会触发 hashchange，这里直接刷新
      state.mapCampus = i;
      applyCampus();
      syncMapInputs();
      if (map) map.invalidateSize();
      return;
    }
    location.hash = route;
  }`,
`  /* 切换基地（地图页顶部胶囊 / 基地介绍页右上角 / 搜索页切换共用）。
     两页共用 state.campus，切一次两页同步刷新。因为底部「青州地图」tab 已移除，
     这里不再走 hash 路由 —— 否则切换基地会顺带把页面跳来跳去。 */
  function switchCampus(i) {
    const next = Number(i) || 0;
    if (next === state.campus) return;
    state.campus = next;

    // 地图页：重载基地数据、标记与起终点
    if (state.mapInited && map) {
      applyCampus();
      renderGuideRoute(mapCampusData());
      syncMapInputs();
      map.invalidateSize();
    }
    // 基地介绍页：分类回到第一个并重绘
    state.siteCategory = 0;
    if (siteRendered) {
      updateSiteCampusBtn();
      renderSiteCategory();
    }
  }`);

apply(APP, '起终点输入框不再同步 choose',
`    startInput.onclick = () => { state.choose = state.mapCampus; state.searchTarget = 1; location.hash = '#/search?id=1'; };
    endInput.onclick = () => { state.choose = state.mapCampus; state.searchTarget = 0; location.hash = '#/search?id=0'; };`,
`    startInput.onclick = () => { state.searchTarget = 1; location.hash = '#/search?id=1'; };
    endInput.onclick = () => { state.searchTarget = 0; location.hash = '#/search?id=0'; };`);

apply(APP, '搜索页基地名读 campus',
`      (MAP.site_data.length > 1 ? '<button class="picker" id="searchCampusBtn">' + esc(state.campus_name_list[state.choose] || currentCampus().name) + '</button>' : '') +`,
`      (MAP.site_data.length > 1 ? '<button class="picker" id="searchCampusBtn">' + esc(state.campus_name_list[state.campus] || currentCampus().name) + '</button>' : '') +`);

apply(APP, '搜索页切换走 switchCampus',
`    if (cb) cb.addEventListener('click', () => showCampusPicker((i) => { state.choose = i; renderSearch(); }));`,
`    if (cb) cb.addEventListener('click', () => showCampusPicker((i) => { switchCampus(i); renderSearch(); }));`);

apply(APP, '搜索结果返回地图页',
`        // 从「青州地图」发起的搜索，选完点后回到「青州地图」
        location.hash = state.tab === 'qingzhou-map' ? '#/qingzhou-map' : '#/map';`,
`        // 回到地图页（当前基地记在 state.campus 里，不会丢）
        location.hash = '#/map';`);

/* ---------------- index.html ---------------- */

apply(HTML, 'index.html：移除青州地图 tab',
`      <!-- 青州地图入口：与「地图」共用同一套实现，只切换厂区数据 -->
      <a class="tab-item" data-route="#/qingzhou-map">
        <img class="tab-icon" src="assets/images/tabbar/icon_map.png" data-alt="assets/images/tabbar/icon_map_HL.png" alt="青州地图" /><span>青州地图</span>
      </a>
`,
`      <!-- 「青州地图」tab 已移除：基地切换改由地图页顶部胶囊 / 基地介绍页右上角承担 -->
`);

apply(HTML, 'index.html：app.js 版本号',
`    <script src="js/app.js?v=20260916-22"></script>`,
`    <script src="js/app.js?v=20260916-23"></script>`);

fs.writeFileSync(path.join(ROOT, '.workbuddy/apply.log'), log.join('\n') + '\n\nfailed=' + failed, 'utf8');
