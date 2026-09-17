(function () {
  'use strict';

  /* ---------- 全局数据 ---------- */
  const D = window.GLU_DATA;
  const MAP = D.map;
  const DATA = D.data;
  const SCHOOL = D.school;
  const MEDIA = D.media;
  const MINI_NAME = DATA.miniprogram_name;
  const APP_VERSION = '20260916-02';

  let vConsole = null;
  try {
    if (typeof window.VConsole === 'function') {
      vConsole = new window.VConsole({ theme: 'dark' });
    }
  } catch (error) {
    console.warn('[朝向调试] vConsole 初始化失败', error);
  }

  const orientationDebug = (...args) => console.log('[朝向调试]', `版本 ${APP_VERSION}`, ...args);
  const orientationDebugWarn = (...args) => console.warn('[朝向调试]', `版本 ${APP_VERSION}`, ...args);
  const locationDebug = (...args) => console.log('[定位调试]', `版本 ${APP_VERSION}`, ...args);
  const locationDebugWarn = (...args) => console.warn('[定位调试]', `版本 ${APP_VERSION}`, ...args);
  orientationDebug('调试初始化', {
    version: APP_VERSION,
    vConsoleLoaded: Boolean(vConsole),
    userAgent: navigator.userAgent,
    secureContext: window.isSecureContext,
  });

  const AREA_GUIDES = {
    '丁腈车间': {
      en: 'NITRILE / WORKSHOP', subtitle: '丁腈手套生产线',
      steps: [
        { t: '配料投料', d: '按配方进行原料配料与投料。' },
        { t: '浸渍成型', d: '生产线完成手套浸渍、成型。' },
        { t: '烘干包装', d: '烘干、脱模后检验并包装入库。' }
      ]
    },
    'PVC车间': {
      en: 'PVC / WORKSHOP', subtitle: 'PVC手套生产线',
      steps: [
        { t: '配料混料', d: 'PVC 糊料按比例配制。' },
        { t: '浸渍烘烤', d: '模具浸渍后进入烘烤定型。' },
        { t: '冷却包装', d: '冷却、脱模后分拣包装。' }
      ]
    },
    /* 兜底项：地图页的「生产车间」是把丁腈/PVC 两个车间合并出来的展示分类，
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
    },
    '环保仓储': {
      en: 'ENVIRONMENT / STORAGE', subtitle: '环保设施与仓储区域', hideSteps: true,
      steps: []
    },
    '生活配套': {
      en: 'LIFE / AREA', subtitle: '员工生活服务区', hideSteps: true, hideVoice: true,
      steps: []
    },
    '配套基地': {
      en: 'UPSTREAM / SUPPLY', subtitle: '全产业链上游配套基地', hideSteps: true, hideVoice: true,
      steps: []
    }
  };

  /* ---------- 工具函数 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // 本地图片路径转换（/images/... -> assets/images/...）
  function asset(p) {
    if (!p) return p;
    if (/^https?:/i.test(p) || p.startsWith('data:')) return p;
    if (p.startsWith('/images/')) return 'assets/images/' + p.slice('/images/'.length);
    if (p.startsWith('images/')) return 'assets/images/' + p.slice('images/'.length);
    return p;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  let toastTimer = null;
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 1800);
  }

  /* ---------- 弹窗 ---------- */
  let modalAction = null;
  function openModal(title, bodyHTML, buttons) {
    $('#modalBox').classList.remove('explain-mode');
    $('#modalTitle').textContent = title || '';
    $('#modalBody').innerHTML = bodyHTML || '';
    const footer = $('#modalFooter');
    if (Array.isArray(buttons) && buttons.length) {
      footer.innerHTML = buttons.map((b) => '<button class="btn' + (b.primary ? ' primary' : '') + '" data-i="' + (buttons.indexOf(b)) + '">' + esc(b.text) + '</button>').join('');
      modalAction = buttons;
      $$('.btn', footer).forEach((btn) => {
        btn.addEventListener('click', () => {
          const b = modalAction[Number(btn.dataset.i)];
          hideModal();
          if (b && typeof b.onClick === 'function') b.onClick();
        });
      });
    } else {
      footer.innerHTML = '';
    }
    $('#modalMask').classList.add('show');
  }
  function hideModal() {
    $('#modalMask').classList.remove('show');
    $('#modalBox').classList.remove('explain-mode');
    modalAction = null;
    if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); stopTtsKeepAlive(); }
    stopGuideAudio();
  }
  $('#modalMask').addEventListener('click', (e) => { if (e.target === $('#modalMask')) hideModal(); });

  /* 图片预览（lightbox 风格弹窗） */
  function previewImage(url) {
    openModal('图片预览', '<div style="text-align:center"><img src="' + esc(url) + '" style="max-height:70vh" /></div>', [{ text: '关闭' }]);
  }

  /* ---------- 全局共享状态 ---------- */
  const state = {
    tab: 'map',
    sub: null,
    choose: 0,             // 园区索引
    campus_list: [],
    campus_name_list: [],
    start: { name: '', latitude: '', longitude: '' },
    end: { name: '', latitude: '', longitude: '' },
    mode: 'walking',
    mapCategory: 0,        // 0 = 「全部」（虚拟分类，见 mapDisplayCategories）
    mapIsAtSchool: false,
    mapDefaultPoint: null,
    mapPoints: [],
    mapInited: false,
    campus: 0,           // 当前基地（0=淮北 1=青州）—— 地图页与基地介绍页共用
    appliedCampus: -1,   // 已经渲染到地图上的基地
    campusResolved: false, // 定位后是否已按电子围栏判过基地（防止 watch 反复抢回用户手动选的基地）
    showMapImg: true,
    route: {
      polyline: null,     // Leaflet polyline
      carMarker: null,
      mode: 'walking',
      duration: 0,
      distance: 0,
      steps: [],
    },
    panoIndex: 0,
    searchTarget: 0,
    searchContent: '',
    searchAutoRun: false,
    focusPoint: null,    // 搜索页「定位」待落地的目标点位（回到地图页后消费）
    focusLock: 0,        // 刚定位过的时间戳：短暂屏蔽 watchPosition 首次居中，别把视角抢走
    siteCategory: 0,
  };

  /* ---------- 园区数据辅助 ---------- */
  function currentCampus() {
    return MAP.site_data[state.campus] || MAP.site_data[0];
  }
  /* 地图页当前基地：与基地介绍页共用 state.campus */
  function mapCampusData() {
    return MAP.site_data[state.campus] || MAP.site_data[0];
  }
  /* 基地显示名：取 data.js 的 base_name（如「英科医疗淮北基地」），缺省退回厂区名 */
  function campusLabel(campus) {
    return (campus && (campus.base_name || campus.name)) || '';
  }
  /* 地图页分类合并规则：把若干细分车间在「地图页」合成一个分类展示。
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
  }
  /* 点位在「地图分类条」（mapDisplayCategories）里的下标。
     只认真实分类：下标 0 是虚拟的「全部」，它的池子里装着所有点位，
     不跳过的话任何点位都会命中 0，切分类就永远不生效了（地图上也就看不到那个标记）。
     合并分类（生产车间）里的点要按来源分类名（_catName）匹配，否则会漏；找不到返回 -1。 */
  function displayCategoryIndexFor(site, catName) {
    if (!site) return -1;
    const cats = mapDisplayCategories();
    const key = catName || '';
    for (let i = 0; i < cats.length; i++) {
      if (cats[i].virtual) continue;
      const list = cats[i].list || [];
      for (let k = 0; k < list.length; k++) {
        if (list[k].name !== site.name) continue;
        if (!key || (list[k]._catName || cats[i].name) === key) return i;
      }
    }
    return -1;
  }
  /* 「定位」后的地图缩放级别：比厂区总览（MAP.scale）近一档，够看清是哪个点位 */
  const FOCUS_ZOOM = 18;
  function currentSiteData() {
    return currentCampus().category_list || [];
  }
  // 默认起点（工厂大门）：已从点位列表移除，此处保留坐标作为默认「当前位置」。
  // 展示字段（aliases/img/desc）必须一起给 —— 否则点开弹窗顶部 hero 区没有图，
  // 与展厅等正常点位不一致（且标题下副标题、正文简介都会空）。
  const DEFAULT_GATE_POINT = {
    name: '工厂大门',
    aliases: '厂区主入口',
    img: 'assets/images/exhibition.webp',
    desc: '厂区主出入口（工厂大门），来访车辆与人员由此进出，按要求登记停放。' +
      '厂区地址：安徽省淮北市濉溪县濉芜经济开发区海棠南路6号。',
    latitude: 33.8728310,
    longitude: 116.7269957,
  };
  // 兜底 hero 图：任何缺 img 的点位都不至于开一个空白弹窗
  const DEFAULT_SITE_IMG = 'assets/images/exhibition.webp';
  // 由默认点位生成 state.start。**必须整体拷贝**，只取 name/lat/lng 会把展示字段丢掉，
  // 结果就是「工厂大门」点开没图。（历史上 4 处赋值都曾只取三个字段。）
  function defaultStartOf(def) {
    return (def && def.latitude) ? Object.assign({}, def) : { name: '', latitude: '', longitude: '' };
  }
  function defaultPointOf(campus) {
    const c = campus || currentCampus();
    if (!c) return null;
    const cats = c.category_list || [];
    for (const cat of cats) {
      const found = (cat.list || []).find((x) => x.name === '工厂大门');
      if (found) return found;
    }
    const cat = c.site_id ? cats.find((x) => x.id === c.site_id[0]) : null;
    const linked = cat && cat.list && cat.list.find((x) => x.id === c.site_id[1]);
    if (linked && linked.name === '工厂大门') return linked;
    // 列表中没有大门点位时，回退到厂区默认大门坐标
    if (c.id === 1 && (c.name || '').indexOf('安徽') >= 0) return { ...DEFAULT_GATE_POINT };
    return null;
  }

  /* =========================================================
     路由
     ========================================================= */
  const TAB_ROUTES = ['map', 'qingzhou-map', 'site'];

  function setActiveTab(tab) {
    state.tab = tab;
    $$('.page').forEach((p) => p.classList.remove('active'));
    // 「地图」与「青州地图」共用同一个页面，只是基地数据不同
    const pageId = (tab === 'qingzhou-map') ? 'map' : tab;
    const page = $('#page-' + pageId);
    if (page) page.classList.add('active');

    // 底部「青州地图」tab 已移除：深链 #/qingzhou-map 时高亮「地图」
    const activeRoute = '#/' + ((tab === 'qingzhou-map') ? 'map' : tab);
    $$('.tab-item').forEach((t) => {
      const active = t.dataset.route === activeRoute;
      t.classList.toggle('active', active);
      const img = $('img', t);
      if (img) img.src = active ? (img.dataset.alt || img.src) : img.src.replace('_HL', '');
    });
  }

  function showSub(name) {
    state.sub = name;
    $$('.subpage').forEach((p) => p.classList.remove('active'));
    const sub = $('#page-' + name);
    if (sub) sub.classList.add('active');
  }
  function hideSub() {
    state.sub = null;
    $$('.subpage').forEach((p) => p.classList.remove('active'));
  }

  // 根据 hash 导航
  function navigate(hash) {
    let h = hash || location.hash || '#/map';
    if (h.indexOf('#/') !== 0) h = '#/map';
    const parts = h.slice(2).split('?');
    const name = parts[0];
    const query = {};
    (parts[1] || '').split('&').forEach((kv) => {
      if (!kv) return;
      const [k, v] = kv.split('=');
      query[k] = decodeURIComponent(v == null ? '' : v);
    });

    if (TAB_ROUTES.includes(name)) {
      hideSub();
      setActiveTab(name);
      // 基地索引已统一到 state.campus：进地图页不再强制回淮北，
      // 这样在基地介绍页切了基地、再回地图，看到的还是同一个基地。
      if (name === 'qingzhou-map') state.campus = 1;
      if (name === 'map' || name === 'qingzhou-map') onMapShow();
      if (name === 'site') onSiteShow();
    } else if (name === 'search') {
      state.searchTarget = Number(query.id) || 0;
      showSub('search');
      renderSearch();
      if (state.searchAutoRun) {
        state.searchAutoRun = false;
        goSearch();
      }
    } else if (name === 'instruction') {
      showSub('instruction');
      renderInstruction(query.name);
    } else if (name === 'introduction') {
      showSub('introduction');
      renderIntroduction();
    } else if (name === 'pano') {
      showSub('pano');
      renderPano();
    } else {
      // 未知路由一律回到地图（原默认路由 #/home 已随「首页」模块移除）
      hideSub();
      setActiveTab('map');
      onMapShow();
    }
  }

  window.addEventListener('hashchange', () => navigate(location.hash));
  $$('.tab-item').forEach((t) => t.addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = t.dataset.route;
  }));
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => {
    hideSub();
    location.hash = '#/' + state.tab;
  }));

  /* =========================================================
     厂区 Hero（原「首页」模块，现已并入基地介绍页顶部）
     ========================================================= */
  function renderSiteHero() {
    const si = SCHOOL.school_information;
    $('#heroSchoolName').textContent = si.home_title || si.school_name_full;
    $('#heroEnglish').textContent = si.school_name_English_full || 'ANHUI INTCO MEDICAL';

    // 荣誉 / 上市标签
    $('#heroTags').innerHTML =
      '<span class="tag tag-accent">' + esc(si.honor) + '</span>' +
      '<span class="tag">股票代码 300677</span>';

    // 基地简介
    $('#heroMotto').innerHTML =
      '<span class="quote-label">基地简介</span>' +
      '<p class="quote-text">' + esc(si.home_intro || si.motto) + '</p>';
  }

  /* ---- 友情链接弹窗 ---- */
  function openLinksDialog() {
    const body =
      '<div style="display:flex;justify-content:space-around;align-items:center;flex-wrap:wrap;gap:10px">' +
      SCHOOL.guanwei.map((g) => '<div class="link-item" data-img="' + esc(g.img) + '" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:6px"><img src="' + asset(g.icon) + '" style="width:50px;height:50px" /><div style="font-size:15px;margin-top:5px">' + esc(g.name) + '</div></div>').join('') +
      '</div>' +
      '<div style="font-size:13px;color:gray;text-align:center;margin-top:12px">招生小程序需在微信中打开使用</div>';
    openModal('友情链接', body, [{ text: '关闭' }]);
    $$('.link-item', $('#modalBody')).forEach((el) => el.addEventListener('click', () => previewImage(el.dataset.img)));
  }

  /* =========================================================
     基地介绍 Tab
     ========================================================= */
  let siteRendered = false;
  function onSiteShow() {
    if (!siteRendered) {
      siteRendered = true;
      initSite();
    } else {
      if (!(state.siteCategory < currentSiteData().length)) state.siteCategory = 0;
      renderSiteCategory();
    }
    updateSiteCampusBtn();
  }
  function updateSiteCampusBtn() {
    if (MAP.site_data.length > 1) {
      $('#siteCampusWrap').style.display = 'block';
      $('#siteCampusBtn').textContent = state.campus_name_list[state.campus];
    } else {
      $('#siteCampusWrap').style.display = 'none';
    }
  }
  function initSite() {
    renderSiteHero();
    state.campus_list = MAP.site_data.map((s) => ({ id: s.id, name: s.name }));
    state.campus_name_list = MAP.site_data.map((s) => s.name);
    updateSiteCampusBtn();
    // 与地图页顶部胶囊共用 switchCampus：切一次，两页一起变
    $('#siteCampusBtn').addEventListener('click', () => showCampusPicker((i) => switchCampus(i)));
    renderSiteCategory();
  }
  function renderSiteCategory() {
    const data = currentSiteData();
    const cat = data[state.siteCategory] || data[0];
    if (!cat) return;
    const icons = { '展厅': '🏛️', '丁腈车间': '🏭', 'PVC车间': '🧤', '环保仓储': '♻️', '生活配套': '🍽️', '配套基地': '⚙️' };
    $('#siteLeft').innerHTML = data.map((c, i) => {
      const ic = icons[c.name] || '📍';
      return '<button class="site-cat' + (i === state.siteCategory ? ' choose' : '') + '" data-i="' + i + '">' +
        '<span class="cat-ic">' + ic + '</span><span class="cat-name">' + esc(c.name) + '</span></button>';
    }).join('');
    $('#siteTitleText').textContent = cat.name;
    $('#siteTitleIcon').src = asset(MEDIA.tag);
    const countEl = $('#siteTitleCount');
    if (countEl) countEl.textContent = (cat.list ? cat.list.length : 0) + ' 个点位';
    $('#siteContent').innerHTML = (cat.list || []).map((p, i) => {
      const pos = ((i * 17) % 100) + '% ' + ((i * 31) % 100) + '%';
      const dur = p.duration ? '<span class="site-card-dur">' + esc(p.duration) + '</span>' : '';
      return '<button class="site-card" data-i="' + i + '">' +
        '<span class="site-card-media"><img class="site-card-img" src="' + esc(p.img) + '" alt="" style="object-position:' + pos + '" loading="lazy" />' +
        '<span class="site-card-num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="site-card-type">' + esc(cat.name) + '</span></span>' +
        '<span class="site-card-body"><span class="site-card-head">' +
        '<strong class="site-card-name">' + esc(p.name) + '</strong>' + dur + '</span>' +
        '<span class="site-card-alias">' + esc(p.aliases || '') + '</span></span>' +
        '</button>';
    }).join('');
    $$('#siteLeft .site-cat').forEach((el) => el.addEventListener('click', () => {
      state.siteCategory = Number(el.dataset.i);
      renderSiteCategory();
    }));
    $$('#siteContent .site-card').forEach((el) => el.addEventListener('click', () => {
      const site = cat.list[Number(el.dataset.i)];
      openSiteDialog(site, cat.name);
    }));
  }
  function openSiteDialog(site, categoryName) {
    openGuideDialog(site, categoryName);
  }

  /* ---------- 园区选择 picker ---------- */
  /* opts.labels：弹窗选项文案；opts.current：当前项索引（缺省用全局 state.campus）。
     地图页与基地介绍页已共用同一个基地索引，两边弹出的 ✓ 永远一致。 */
  function showCampusPicker(onPick, opts) {
    const o = opts || {};
    const names = o.labels || state.campus_name_list;
    const current = (typeof o.current === 'number') ? o.current : state.campus;
    const body = names.map((n, i) =>
      '<div class="picker-opt' + (i === current ? ' on' : '') + '" data-i="' + i + '" style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;font-size:16px;display:flex;justify-content:space-between">' + esc(n) + (i === current ? ' <span style="color:var(--menu)">✓</span>' : '') + '</div>').join('');
    openModal('切换基地', body, [{ text: '取消' }]);
    $$('.picker-opt', $('#modalBody')).forEach((el) => el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      hideModal();
      if (i !== current) onPick && onPick(i);
    }));
  }

  /* =========================================================
     地图页 (Leaflet)
     ========================================================= */
  let map = null;
  let baseLayer = null;
  let groundOverlay = null;
  let polygonLayer = null;
  let markerLayer = null;
  let routeLayer = null;
  let overlayToken = 0;
  let pointsTextLayers = [];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- 定位（淮北地图与青州地图共用） ---------- */
  let mapUserMarker = null;         // 用户当前位置蓝点
  let mapLocationWatching = false;  // 是否已开启持续定位
  let mapLocationResolved = false;  // 是否已有任意定位请求成功
  let mapLocationUserRequested = false; // 用户是否主动点击过定位
  let mapLocationErrorTimer = null;
  let mapFirstFixToast = false;     // 首次定位成功提示是否已展示
  let mapOrientationAttached = false;
  let mapOrientationPermissionPromise = null;
  let mapOrientationPermissionDenied = false;
  let mapOrientationAbsoluteAt = 0;
  let mapCurrentHeading = null;
  let mapOrientationEventCount = 0;
  let mapOrientationLastLogAt = 0;
  let mapOrientationNoEventTimer = null;
  let mapOrientationArrowMissingLogged = false;

  /* ---------- iOS 方向权限引导 ----------
     iOS(Safari) 规定 DeviceOrientationEvent.requestPermission() 必须由「页面内的用户手势」
     触发。定位权限弹窗上的「允许」是系统弹窗，不算页面手势，所以「定位成功后自动申请」在
     iOS 上会拿到 NotAllowedError，箭头不会出现——这正是必须手动点右侧按钮的原因。
     系统又不提供查询权限状态的方法，只有「已授权」时才允许无手势静默调用成功。因此：
       1) 此前授权过（本地有记录）→ 进入页面即静默申请，直接生效（0 次点击）；
       2) 首次进入 → 挂上「页面首次触摸即申请」，并给出底部引导条，
          用户不需要去找右侧那个小按钮；
       3) 用户明确选了「不允许」→ 不再反复打扰，右侧按钮仍可手动重试。 */
  const ORIENT_STORE_KEY = 'glu.orientation.granted';
  let mapOrientationNeedsGesture = false;   // 系统要求手势，正在等用户触摸
  let mapOrientationGestureArmed = false;   // 「首次触摸即申请」监听是否已挂上
  let mapOrientationGestureTries = 0;       // 手势申请尝试次数（防止无限重挂）

  function readOrientationGrantedFlag() {
    try { return window.localStorage.getItem(ORIENT_STORE_KEY) === '1'; } catch (e) { return false; }
  }

  function writeOrientationGrantedFlag(granted) {
    try {
      if (granted) window.localStorage.setItem(ORIENT_STORE_KEY, '1');
      else window.localStorage.removeItem(ORIENT_STORE_KEY);
    } catch (e) { /* 无痕模式下 localStorage 可能不可用，忽略即可 */ }
  }

  function showOrientationHint() {
    const hint = $('#mapOrientHint');
    const page = $('#page-map');
    if (hint) hint.classList.add('on');
    if (page) page.classList.add('orient-hint-on');
  }

  function hideOrientationHint() {
    const hint = $('#mapOrientHint');
    const page = $('#page-map');
    if (hint) hint.classList.remove('on');
    if (page) page.classList.remove('orient-hint-on');
  }

  /* 挂上「页面首次触摸即申请」：用户进入地图页后的第一次点击/触摸就完成申请，
     不需要知道右侧有个朝向按钮。监听挂在 #page-map 上，切到别的 tab 不会误触发。 */
  function armOrientationGesture() {
    if (mapOrientationAttached || mapOrientationPermissionDenied) return;
    mapOrientationNeedsGesture = true;
    showOrientationHint();
    if (mapOrientationGestureArmed) return;
    mapOrientationGestureArmed = true;
    const target = $('#page-map') || document;
    const onFirstGesture = () => {
      target.removeEventListener('touchend', onFirstGesture, true);
      target.removeEventListener('click', onFirstGesture, true);
      mapOrientationGestureArmed = false;
      mapOrientationGestureTries += 1;
      orientationDebug('捕捉到页面手势，申请设备朝向权限', {
        functionName: 'armOrientationGesture',
        tries: mapOrientationGestureTries,
      });
      // 稍等一拍，让这次点击自己的动作（开弹窗/起定位）先走完，再弹系统权限框，避免两个弹窗叠在一起。
      // 手势带来的 transient activation 有数秒有效期，这点延迟不影响申请。
      setTimeout(() => {
        requestOrientationPermission().then((granted) => {
          if (granted) return;
          if (!mapOrientationPermissionDenied && mapOrientationGestureTries < 3) {
            armOrientationGesture();   // 手势没被系统识别，挂回去等下一次触摸
          } else {
            hideOrientationHint();     // 用户拒绝或多次失败：不再打扰
          }
        });
      }, 240);
    };
    target.addEventListener('touchend', onFirstGesture, true);
    target.addEventListener('click', onFirstGesture, true);
  }

  let guideRouteLayer = null;       // 厂区固定引导路线（data.js 里的 guide_route）
  let guideRoutePoints = [];

  /* 浏览器定位 WGS-84 -> 地图 GCJ-02 */
  function toGcj(lat, lng) {
    const g = wgs2gcj(lat, lng);
    return [g.lat, g.lng];
  }

  /* 用户位置 marker：实时蓝点，收到有效朝向后显示箭头 */
  function mapUserIcon() {
    return L.divIcon({
      className: 'map-user-marker-icon',
      html: '<div class="user-heading"></div><div class="user-dot"></div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  function updateUserMarker(latLng, center) {
    if (!map) return;
    if (!mapUserMarker) {
      mapUserMarker = L.marker(latLng, { icon: mapUserIcon(), zIndexOffset: 500, interactive: false }).addTo(map);
    } else {
      mapUserMarker.setLatLng(latLng);
    }
    updateHeadingVisuals(mapCurrentHeading);
    if (center) map.setView(latLng, Math.max(map.getZoom(), 16));
  }

  /* center=false 只更新蓝点不居中：围栏兜底已经把视角定到工厂大门时用它，
     否则刚切好的大门视角会被用户点（可能在几百公里外）瞬间拉走 */
  function locateAndCenter(lat, lng, center) {
    updateUserMarker([lat, lng], center !== false);
  }

  function locationErrorMessage(err) {
    const code = err && Number(err.code);
    const detail = err && err.message ? '（' + err.message + '）' : '';
    if (code === 1) {
      return '定位失败：你拒绝了浏览器的位置权限，请在浏览器网站设置中允许定位' + detail;
    }
    if (code === 2) {
      return '定位失败：设备暂时无法获取位置，可能是 GPS、网络定位或系统定位服务不可用' + detail;
    }
    if (code === 3) {
      return '定位失败：获取位置超时，请检查系统定位服务或网络/GPS 信号后重试' + detail;
    }
    const codeDetail = Number.isFinite(code) ? '（错误码：' + code + '）' : '';
    return '定位失败：浏览器未返回明确原因' + codeDetail + detail;
  }

  function showLocationError(err) {
    const message = locationErrorMessage(err);
    toast(message, 3500);
    openModal(
      '定位失败',
      '<p class="explain-desc">' + esc(message) + '</p>' +
      '<div class="instruction-txt">请检查浏览器的位置权限、系统定位服务和网络/GPS 信号后重试。</div>',
      [{ text: '知道了' }]
    );
  }

  function markLocationResolved() {
    mapLocationResolved = true;
    if (mapLocationErrorTimer) {
      clearTimeout(mapLocationErrorTimer);
      mapLocationErrorTimer = null;
    }
  }

  function handleLocError(err, source = 'unknown') {
    locationDebugWarn('定位获取失败', {
      functionName: source,
      apiName: source,
      code: err && err.code,
      message: err && err.message,
      resolved: mapLocationResolved,
      userRequested: mapLocationUserRequested,
    });
    if (mapLocationResolved) {
      locationDebug('已有成功定位，忽略失败回调', { functionName: source });
      return;
    }
    if (!mapLocationUserRequested) {
      locationDebug('后台定位失败，不弹出定位失败提示；等待其他定位请求', { functionName: source });
      return;
    }
    if (mapLocationErrorTimer) clearTimeout(mapLocationErrorTimer);
    mapLocationErrorTimer = setTimeout(() => {
      mapLocationErrorTimer = null;
      if (!mapLocationResolved) {
        locationDebugWarn('准备显示定位失败提示', { functionName: source, error: err });
        showLocationError(err);
      }
    }, 500);
  }

  function normalizeHeading(value) {
    if (!Number.isFinite(value)) return null;
    return (value % 360 + 360) % 360;
  }

  function screenOrientationAngle() {
    const angle = window.screen && window.screen.orientation
      ? Number(window.screen.orientation.angle)
      : Number(window.orientation);
    return Number.isFinite(angle) ? angle : 0;
  }

  function getOrientationSupport() {
    const constructorSupported = typeof window.DeviceOrientationEvent !== 'undefined';
    const relativeEventSupported = 'ondeviceorientation' in window;
    const absoluteEventSupported = 'ondeviceorientationabsolute' in window;
    return {
      constructorSupported,
      relativeEventSupported,
      absoluteEventSupported,
      supported: constructorSupported || relativeEventSupported || absoluteEventSupported,
    };
  }

  function readDeviceHeading(event, source) {
    if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
      return normalizeHeading(event.webkitCompassHeading);
    }
    if (typeof event.alpha !== 'number' || !Number.isFinite(event.alpha)) return null;
    return normalizeHeading(360 - event.alpha + screenOrientationAngle());
  }

  function updateHeadingVisuals(heading) {
    const arrow = $('.map-user-marker-icon .user-heading');
    if (!arrow) {
      if (!mapOrientationArrowMissingLogged) {
        mapOrientationArrowMissingLogged = true;
        orientationDebugWarn('朝向显示失败', {
          functionName: 'updateHeadingVisuals',
          selector: '.map-user-marker-icon .user-heading',
          reason: '箭头元素不存在，通常表示当前位置蓝点尚未创建',
        });
      }
      return;
    }
    if (!Number.isFinite(heading)) {
      arrow.classList.remove('visible');
      orientationDebugWarn('朝向解析结果不可用，箭头保持隐藏', {
        functionName: 'readDeviceHeading',
        calledFrom: 'onDeviceOrientation',
        reason: 'heading 为 null 或非有限数字',
        heading,
        arrowClassName: arrow.className,
      });
      return;
    }
    arrow.style.transform = 'translate(-50%, -100%) rotate(' + heading + 'deg)';
    arrow.classList.add('visible');
    orientationDebug('箭头已显示', {
      heading,
      transform: arrow.style.transform,
      arrowClassName: arrow.className,
    });
  }

  function onDeviceOrientation(event, source) {
    mapOrientationEventCount += 1;
    const now = Date.now();
    const raw = {
      source,
      count: mapOrientationEventCount,
      absolute: event.absolute,
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      webkitCompassHeading: event.webkitCompassHeading,
      screenAngle: screenOrientationAngle(),
    };
    if (now - mapOrientationLastLogAt >= 500 || mapOrientationEventCount <= 3) {
      mapOrientationLastLogAt = now;
      orientationDebug('收到设备朝向事件', raw);
    }
    if (source === 'absolute') {
      mapOrientationAbsoluteAt = now;
    } else if (mapOrientationAbsoluteAt && now - mapOrientationAbsoluteAt < 1500) {
      orientationDebug('忽略普通朝向事件，优先使用刚收到的绝对朝向');
      return;
    }
    const heading = readDeviceHeading(event, source);
    if (heading === null) {
      orientationDebugWarn('朝向解析失败', {
        functionName: 'readDeviceHeading',
        calledFrom: 'onDeviceOrientation',
        reason: 'alpha 和 webkitCompassHeading 都不可用',
        event: raw,
      });
      return;
    }
    mapCurrentHeading = heading;
    orientationDebug('朝向解析成功，正在更新蓝点箭头', { source, heading });
    updateHeadingVisuals(heading);
  }

  function attachOrientationListeners() {
    if (mapOrientationAttached) {
      orientationDebug('设备朝向监听已存在，跳过重复绑定');
      return;
    }
    const support = getOrientationSupport();
    if (!support.supported) {
      orientationDebugWarn('朝向监听失败', {
        functionName: 'attachOrientationListeners',
        apiName: 'window.DeviceOrientationEvent',
        reason: '设备朝向 API 和 deviceorientation 事件均不存在',
        support,
      });
      return;
    }
    mapOrientationAttached = true;
    mapOrientationNeedsGesture = false;
    mapOrientationGestureTries = 0;
    writeOrientationGrantedFlag(true);   // 下次进入可直接静默恢复，无需任何点击
    hideOrientationHint();
    const orientBtn = $('#mapOrientationBtn');
    if (orientBtn) orientBtn.classList.add('granted');
    const absoluteListenerReturn = window.addEventListener(
      'deviceorientationabsolute',
      (event) => onDeviceOrientation(event, 'absolute'),
      true
    );
    const relativeListenerReturn = window.addEventListener(
      'deviceorientation',
      (event) => onDeviceOrientation(event, 'relative'),
      true
    );
    orientationDebug('设备朝向监听已绑定', {
      absolute: true,
      relative: true,
      requestPermission: support.constructorSupported
        && typeof window.DeviceOrientationEvent.requestPermission === 'function',
      addEventListenerReturn: {
        deviceorientationabsolute: absoluteListenerReturn,
        deviceorientation: relativeListenerReturn,
      },
    });
    if (mapOrientationNoEventTimer) clearTimeout(mapOrientationNoEventTimer);
    mapOrientationNoEventTimer = setTimeout(() => {
      mapOrientationNoEventTimer = null;
      if (!mapOrientationEventCount) {
        orientationDebugWarn('朝向获取失败：没有收到事件', {
          functionName: 'onDeviceOrientation',
          apiName: 'deviceorientationabsolute / deviceorientation',
          registeredBy: 'attachOrientationListeners',
          reason: '监听已绑定，但设备未回调任何设备朝向事件；请检查设备传感器、浏览器权限和 HTTPS/localhost 环境',
        });
      }
    }, 5000);
  }

  function requestOrientationPermission(forceRetry = false) {
    const support = getOrientationSupport();
    if (!support.supported) {
      orientationDebugWarn('朝向权限获取失败', {
        functionName: 'requestOrientationPermission',
        apiName: 'DeviceOrientationEvent.requestPermission',
        reason: '设备朝向 API 和 deviceorientation 事件均不存在',
        support,
      });
      return Promise.resolve(false);
    }
    if (mapOrientationPermissionDenied && !forceRetry) {
      orientationDebug('朝向权限此前已拒绝，本次不重复申请；如需重试请修改浏览器权限后刷新页面');
      return Promise.resolve(false);
    }
    if (forceRetry) mapOrientationPermissionDenied = false;
    if (mapOrientationPermissionPromise) {
      orientationDebug('朝向权限请求已在进行中，复用原 Promise');
      return mapOrientationPermissionPromise;
    }
    const request = support.constructorSupported && typeof window.DeviceOrientationEvent.requestPermission === 'function'
      ? window.DeviceOrientationEvent.requestPermission
      : null;
    orientationDebug('开始请求设备朝向权限', {
      requestPermission: typeof request === 'function',
      secureContext: window.isSecureContext,
    });
    if (typeof request !== 'function') {
      orientationDebug('当前浏览器无需调用 requestPermission，直接绑定监听', {
        fallbackEventListener: !support.constructorSupported,
        support,
        methodReturnValue: true,
        returnType: 'boolean',
      });
      mapOrientationPermissionPromise = Promise.resolve(true).then(() => {
        attachOrientationListeners();
        return true;
      });
      return mapOrientationPermissionPromise;
    }
    let permissionReturn;
    try {
      permissionReturn = request.call(window.DeviceOrientationEvent);
      orientationDebug('DeviceOrientationEvent.requestPermission() 方法同步返回值', {
        returnValue: permissionReturn,
        returnType: typeof permissionReturn,
      });
    } catch (error) {
      mapOrientationPermissionPromise = null;
      orientationDebugWarn('朝向权限获取失败', {
        functionName: 'requestOrientationPermission',
        apiName: 'DeviceOrientationEvent.requestPermission',
        reason: '调用发生同步异常',
        error,
      });
      return Promise.resolve(false);
    }
    mapOrientationPermissionPromise = Promise.resolve(permissionReturn).then((result) => {
        orientationDebug('设备朝向权限返回结果', result);
        if (result !== 'granted') {
          mapOrientationPermissionPromise = null;
          mapOrientationPermissionDenied = true;
          hideOrientationHint();
          orientationDebugWarn('朝向权限获取失败', {
            functionName: 'DeviceOrientationEvent.requestPermission',
            apiName: 'DeviceOrientationEvent.requestPermission',
            returnValue: result,
            reason: '权限未授权，箭头将保持隐藏',
          });
          return false;
        }
        attachOrientationListeners();
        return true;
      }).catch((error) => {
      mapOrientationPermissionPromise = null;
      /* NotAllowedError = 系统要求必须由「页面内手势」触发，而这次调用没有手势。
         它不等于用户拒绝：不能标记 denied 把自己锁死，交给手势流程再申请一次。 */
      if (error && error.name === 'NotAllowedError') {
        mapOrientationNeedsGesture = true;
        orientationDebug('设备朝向权限需要页面手势，等用户触摸页面后再申请', {
          functionName: 'requestOrientationPermission',
          reason: error.message || 'NotAllowedError',
        });
        return false;
      }
      mapOrientationPermissionDenied = true;
      hideOrientationHint();
      orientationDebugWarn('朝向权限获取失败', {
        functionName: 'requestOrientationPermission',
        apiName: 'DeviceOrientationEvent.requestPermission',
        reason: 'Promise rejected',
        error,
      });
      return false;
    });
    return mapOrientationPermissionPromise;
  }

  function requestOrientationAfterLocation(source) {
    if (!mapLocationUserRequested) {
      orientationDebug('定位成功，但不是用户主动点击定位；暂不申请朝向权限', { source });
      return;
    }
    orientationDebug('定位成功，开始申请朝向权限', {
      source,
      functionName: 'requestOrientationAfterLocation',
      nextFunction: 'requestOrientationPermission',
    });
    requestOrientationPermission();
  }

  function initOrientation() {
    const support = getOrientationSupport();
    const supported = support.supported;
    const requiresGesture = support.constructorSupported
      && typeof window.DeviceOrientationEvent.requestPermission === 'function';
    orientationDebug('初始化设备朝向能力', {
      supported,
      requiresGesture,
      support,
      secureContext: window.isSecureContext,
      screenOrientation: window.screen && window.screen.orientation
        ? window.screen.orientation.type
        : 'unavailable',
    });
    if (!supported) {
      orientationDebugWarn('朝向初始化失败', {
        functionName: 'initOrientation',
        apiName: 'window.DeviceOrientationEvent',
        reason: '当前环境不支持设备朝向',
      });
      return;
    }
    if (!requiresGesture) {
      attachOrientationListeners();
      return;
    }
    /* iOS：系统不提供权限状态查询，但只有「已授权」时才允许无手势静默调用成功。
       此前授权过 → 进入页面即静默恢复（0 次点击）；否则 → 挂上「首次触摸即申请」+ 引导条。 */
    if (readOrientationGrantedFlag()) {
      orientationDebug('此前已授权设备朝向，进入页面即静默恢复监听');
      requestOrientationPermission().then((granted) => {
        if (!granted) armOrientationGesture();
      });
      return;
    }
    orientationDebug('iOS 需要一次页面手势才能申请设备朝向：已挂上「首次触摸即申请」并显示引导条');
    armOrientationGesture();
  }

  /* 持续定位：只更新蓝点位置，不自动居中，避免干扰浏览 */
  function startLocationWatch() {
    if (mapLocationWatching) {
      locationDebug('跳过 watchPosition：当前已经存在持续定位监听');
      return;
    }
    if (!navigator.geolocation) {
      locationDebugWarn('无法调用定位函数', {
        functionName: 'startLocationWatch',
        apiName: 'navigator.geolocation.watchPosition',
        reason: 'navigator.geolocation 不存在',
      });
      return;
    }
    mapLocationWatching = true;
    const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 };
    locationDebug('调用 navigator.geolocation.watchPosition', {
      method: 'watchPosition(success, error, options)',
      options,
    });
    const watchId = navigator.geolocation.watchPosition((pos) => {
      locationDebug('watchPosition 成功回调返回值', {
        position: pos,
        coords: pos && pos.coords,
        timestamp: pos && pos.timestamp,
      });
      markLocationResolved();
      const [lat, lng] = toGcj(pos.coords.latitude, pos.coords.longitude);
      const isFirst = !mapFirstFixToast;
      mapFirstFixToast = true;
      // 首帧按围栏定一次基地（含兜底）；后续刷新不再动用户手动选的基地
      resolveCampusByLocation(lat, lng, isFirst);
      // 仅首次定位成功时居中一次；刚用过搜索页「定位」或刚兜底到大门口时把视角让给它（否则会被抢走）
      updateUserMarker([lat, lng], isFirst && !locationNoticeShown && Date.now() >= state.focusLock);
      if (isFirst && !locationNoticeShown) toast('已定位到当前位置', 1200);
      requestOrientationAfterLocation('navigator.geolocation.watchPosition');
    }, (err) => {
      locationDebugWarn('watchPosition 失败回调返回值', err);
      handleLocError(err, 'navigator.geolocation.watchPosition');
    }, options);
    locationDebug('watchPosition 方法同步返回值', {
      returnValue: watchId,
      returnType: typeof watchId,
    });
  }

  /* 两点间方位角（度） */
  function routeBearing(start, end) {
    const latitude = ((start[0] + end[0]) / 2) * Math.PI / 180;
    return Math.atan2((end[1] - start[1]) * Math.cos(latitude), end[0] - start[0]) * 180 / Math.PI;
  }

  /* 厂区固定引导路线（在各厂区数据的 guide_route 里配置） */
  function renderGuideRoute(campus) {
    if (guideRouteLayer) { map.removeLayer(guideRouteLayer); guideRouteLayer = null; }
    guideRoutePoints = (campus && Array.isArray(campus.guide_route)) ? campus.guide_route : [];
    if (guideRoutePoints.length < 2) { guideRoutePoints = []; return; }
    const layers = [];
    layers.push(L.polyline(guideRoutePoints, {
      color: '#ef4444', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false,
    }));
    guideRoutePoints.slice(0, -1).forEach((point, index) => {
      const nextPoint = guideRoutePoints[index + 1];
      const midpoint = [(point[0] + nextPoint[0]) / 2, (point[1] + nextPoint[1]) / 2];
      const angle = routeBearing(point, nextPoint) - 90;
      layers.push(L.marker(midpoint, {
        icon: L.divIcon({
          className: 'map-route-arrow-icon',
          html: '<span style="transform: rotate(' + angle + 'deg)">➤</span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        interactive: false,
      }));
    });
    guideRoutePoints.forEach((point, index) => {
      layers.push(L.circleMarker(point, {
        radius: (index === 0 || index === guideRoutePoints.length - 1) ? 5 : 2.5,
        color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1, interactive: false,
      }));
    });
    guideRouteLayer = L.layerGroup(layers).addTo(map);
  }

  function onMapShow() {
    if (!state.mapInited) {
      state.mapInited = true;
      initMap();
      applyPendingFocus();
      return;
    }
    // 地图页与基地介绍页共用 state.campus：只有真正换了基地才重载数据，
    // 从子页返回（如搜索页）时保留已选起终点。
    if (state.campus !== state.appliedCampus) {
      applyCampus();
      renderGuideRoute(mapCampusData());
    }
    if (map) map.invalidateSize();
    syncMapInputs();
    applyPendingFocus();
  }

  /* 落地搜索页「定位」的目标：切到点位所在分类 → 以该点位为中心。
     必须放在 onMapShow 的最后：前面可能刚按基地差异重载过数据、重绘过标记
     （renderCategoryMarkers 里的 fitMarkers 会把视角缩到整片点位），视角得最后定。 */
  function applyPendingFocus() {
    const f = state.focusPoint;
    if (!f || !map) return;
    state.focusPoint = null;
    // 「全部」里什么点位都有，不必切分类；只有当前分类压根看不到这个点位时才切过去，
    // 免得把用户自己选的分类莫名其妙换掉
    const visibleInCurrent = state.mapCategory === 0 || state.mapCategory === f.category;
    if (!visibleInCurrent && f.category > 0) {
      state.mapCategory = f.category;
      $$('#mapCategories .map-cat').forEach((el, k) => el.classList.toggle('choose', k === f.category));
      renderCategoryMarkers();
    }
    state.focusLock = Date.now() + 3000;
    map.invalidateSize();
    map.setView([f.latitude, f.longitude], FOCUS_ZOOM);
    toast('已定位到 ' + f.name, 1600);
  }

  function initMap() {
    state.campus_list = MAP.site_data.map((s) => ({ id: s.id, name: s.name }));
    state.campus_name_list = MAP.site_data.map((s) => s.name);
    state.mapDefaultPoint = defaultPointOf(mapCampusData());

    map = L.map('leafletMap', { zoomControl: false, attributionControl: true });
    map.createPane('pointsPane');
    map.getPane('pointsPane').style.zIndex = 500;
    map.setView([MAP.latitude, MAP.longitude], MAP.scale || 16);

    baseLayer = L.tileLayer('https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={y}&type=vector&styleid=0', {
      tms: true,
      subdomains: '0123',
      maxZoom: 20,
      minZoom: 3,
      attribution: '© 腾讯地图',
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);

    $('#mapCampusBtn').addEventListener('click', () => showCampusPicker(
      (i) => switchCampus(i),
      { labels: MAP.site_data.map((s) => s.base_name || s.name), current: state.campus }
    ));
    $('#mapSearchBtn').addEventListener('click', () => {
      const input = $('#mapSearchInput');
      const content = input ? input.value.trim() : '';
      if (!content) {
        toast('请输入要搜索的地点');
        if (input) input.focus();
        return;
      }
      state.searchTarget = 0;
      state.searchContent = content;
      state.searchAutoRun = true;
      location.hash = '#/search?id=0';
    });
    $('#mapSearchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#mapSearchBtn').click();
    });
    $('#mapOrientationBtn').addEventListener('click', () => {
      orientationDebug('点击朝向权限申请按钮', {
        functionName: 'requestOrientationPermission',
        forceRetry: true,
      });
      requestOrientationPermission(true).then((granted) => {
        orientationDebug('朝向权限申请按钮返回结果', { granted });
        $('#mapOrientationBtn').classList.toggle('granted', !!granted);
        toast(granted ? '方向指引已开启' : '未获得方向权限，请在浏览器设置中允许「运动与方向」', 2200);
      });
    });
    $('#mapLocationBtn').addEventListener('click', () => {
      mapLocationUserRequested = true;
      orientationDebug('点击定位按钮：先获取定位，定位成功后再申请朝向权限', {
        locationFunction: 'navigator.geolocation.getCurrentPosition / watchPosition',
        orientationFunction: 'requestOrientationPermission（定位成功后调用）',
      });
      if (!navigator.geolocation) {
        locationDebugWarn('无法调用定位函数', {
          functionName: 'mapLocationBtn click handler',
          apiName: 'navigator.geolocation.getCurrentPosition',
          reason: 'navigator.geolocation 不存在',
        });
        showLocationError({ message: '当前浏览器不支持 Geolocation API' });
        return;
      }
      toast('正在获取位置…');
      // 已在跟随：重新取一次当前位置并居中，不重新开启定位
      if (mapLocationWatching) {
        const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 };
        locationDebug('调用 navigator.geolocation.getCurrentPosition', {
          method: 'getCurrentPosition(success, error, options)',
          source: '用户点击定位按钮',
          options,
        });
        const currentPositionReturn = navigator.geolocation.getCurrentPosition(
          (pos) => {
            locationDebug('getCurrentPosition 成功回调返回值', {
              position: pos,
              coords: pos && pos.coords,
              timestamp: pos && pos.timestamp,
            });
            markLocationResolved();
            const [lat, lng] = toGcj(pos.coords.latitude, pos.coords.longitude);
            // 点定位按钮 = 强制重判基地：人到哪个基地附近就切哪个
            resolveCampusByLocation(lat, lng, true);
            // 兜底到大门口时不居中到用户点，保留大门视角
            locateAndCenter(lat, lng, !locationNoticeShown);
            if (!locationNoticeShown) toast('已定位到当前位置', 1200);
            requestOrientationAfterLocation('navigator.geolocation.getCurrentPosition（用户点击定位）');
          },
          (err) => {
            locationDebugWarn('getCurrentPosition 失败回调返回值', err);
            handleLocError(err, 'navigator.geolocation.getCurrentPosition（用户点击定位）');
          },
          options
        );
        locationDebug('getCurrentPosition 方法同步返回值', {
          returnValue: currentPositionReturn,
          returnType: typeof currentPositionReturn,
        });
        return;
      }
      startLocationWatch();
    });
    $('#mapRestoreBtn').addEventListener('click', restore);
    $('#mapBottomBtn').addEventListener('click', clickMapBottom);
    $('#mapLayerToggle').addEventListener('click', () => {
      state.showMapImg = !state.showMapImg;
      renderLayerToggleText();
      renderCampusOverlay();
    });
    renderLayerToggleText();
    $$('.map-modes .mode').forEach((m) => m.addEventListener('click', () => modeChoose(m.dataset.mode)));

    applyCampus();
    renderGuideRoute(mapCampusData());
    initOrientation();
    locateMe();
    startLocationWatch();
    syncMapInputs();
    setTimeout(() => { if (map) map.invalidateSize(); }, 60);
    setTimeout(() => { if (map) map.invalidateSize(); }, 350);
  }

  /* 侧边栏图层按钮文案：按行排版，「真实地图」固定拆成「真实 / 地图」两行
     （按钮是 46px 圆钮，自然折行会变成「真实地 / 图」，所以用 .lt-line 行盒显式分行） */
  function renderLayerToggleText() {
    const btn = $('#mapLayerToggle');
    if (!btn) return;
    btn.innerHTML = state.showMapImg
      ? '<span class="lt-line">真实</span><span class="lt-line">地图</span>'
      : '<span class="lt-line">示意图</span>';
  }

  function applyCampus() {
    const campus = mapCampusData();
    state.mapPoints = campus.range || [];
    state.mapDefaultPoint = defaultPointOf(campus);
    // 切厂区时重置起终点，避免残留上一个厂区的点位
    const def = state.mapDefaultPoint;
    state.start = defaultStartOf(def);
    state.end = { name: '', latitude: '', longitude: '' };
    state.mapCategory = 0;
    state.route.polyline = null;
    state.route.duration = 0;
    state.route.distance = 0;
    state.route.steps = [];
    clearRouteLayers();
    renderCampusControl();
    renderCampusOverlay();
    renderCategoryMarkers();
    state.appliedCampus = state.campus;
    if (map) {
      map.setView([campus.latitude, campus.longitude], MAP.scale || 16);
    }
  }

  function renderCampusControl() {
    // 顶部基地名：既是当前基地标识，也是切换基地的入口（多个厂区时才显示）
    $('#mapCampusWrap').style.display = (MAP.site_data.length > 1) ? 'flex' : 'none';
    $('#mapCampusBtn').textContent = campusLabel(mapCampusData());
    const cats = mapDisplayCategories();
    $('#mapCategories').innerHTML = cats.map((c, i) =>
      '<div class="map-cat' + (i === state.mapCategory ? ' choose' : '') + '" data-i="' + i + '">' + esc(c.name) + '</div>').join('');
    $$('#mapCategories .map-cat').forEach((el) => el.addEventListener('click', () => changeCategory(Number(el.dataset.i))));
    $('#mapBottomBtn').classList.add('hidden');
    hideRouteUI();
  }

  // 厂区示意图绕范围中心旋转。rotation 为正时顺时针，单位：度。
  function createCampusImageOverlay(url, bounds, options) {
    const rotation = Number(options && options.rotation);
    if (!Number.isFinite(rotation) || rotation === 0) {
      return L.imageOverlay(url, bounds, options);
    }

    const Overlay = L.ImageOverlay.extend({
      _reset: function () {
        L.ImageOverlay.prototype._reset.call(this);
        this._syncRotation();
      },
      _animateZoom: function (e) {
        if (typeof L.ImageOverlay.prototype._animateZoom === 'function') {
          L.ImageOverlay.prototype._animateZoom.call(this, e);
        }
        this._syncRotation();
      },
      _syncRotation: function () {
        const img = this._image;
        const deg = Number(this.options.rotation);
        if (!img || !Number.isFinite(deg) || deg === 0) return;
        img.style.transformOrigin = 'center center';
        const base = (img.style.transform || '').replace(/\s*rotate\(-?[\d.]+deg\)/gi, '');
        img.style.transform = base + ' rotate(' + deg + 'deg)';
      },
    });

    return new Overlay(url, bounds, Object.assign({}, options, { rotation: rotation }));
  }

  function renderCampusOverlay() {
    const campus = mapCampusData();
    clearPointsTextLayers();
    if (groundOverlay) { map.removeLayer(groundOverlay); groundOverlay = null; }
    if (polygonLayer) { map.removeLayer(polygonLayer); polygonLayer = null; }

    const polygons = [];
    const labelSpecs = [];
    // 用户在各 POI 条目里填写的 points 区域（依次连线围成多边形）
    addCategoryPolygons(campus, polygons, labelSpecs);

    // 默认叠加厂区示意图；右上角可切换真实底图和厂区边界。
    if (state.showMapImg && campus.isUseMapImg && campus.img && campus.bounds) {
      const b = campus.bounds;
      overlayToken += 1;
      groundOverlay = createCampusImageOverlay(campus.img, [[b.south, b.west], [b.north, b.east]], {
        opacity: b.opacity || 1,
        rotation: campus.rotation,
        interactive: false,
        className: 'campus-map-overlay',
      }).addTo(map);
    } else if (campus.range && campus.range.length) {
      overlayToken += 1;
      polygons.push(L.polygon(campus.range.map((p) => [p.latitude, p.longitude]), {
        color: '#789cff', weight: 2, fillColor: '#d5dff2', fillOpacity: 0.2, interactive: false,
      }));
    }

    if (polygons.length) {
      polygonLayer = (polygons.length === 1) ? polygons[0] : L.layerGroup(polygons);
      polygonLayer.addTo(map);
    }
    // 文字标签放在多边形之上，随缩放自适应并在框内显示
    labelSpecs.forEach((spec) => addPointsLabelToPolygon(spec.poly, spec.item, spec.style));
  }

  function addCategoryPolygons(campus, out, labelSpecs) {
    const cats = campus.category_list || [];
    cats.forEach((cat) => {
      const catStyle = (cat.polygon && typeof cat.polygon === 'object') ? cat.polygon : {};
      (cat.list || []).forEach((item) => {
        const latlngs = pointsToLatLngs(item.points);
        if (!latlngs) return;
        const itemStyle = (item.polygon && typeof item.polygon === 'object') ? item.polygon : {};
        const style = Object.assign(
          { color: '#ff8c3a', weight: 2.5, fillColor: '#ffb14e', fillOpacity: 0.25 },
          catStyle, itemStyle
        );
        const poly = L.polygon(latlngs, {
          color: style.color, weight: style.weight, fillColor: style.fillColor,
          fillOpacity: style.fillOpacity, interactive: false, pane: 'pointsPane',
        });
        if (labelSpecs) labelSpecs.push({ poly: poly, item: item, style: style });
        out.push(poly);
      });
    });
  }

  function pointsLabelLines(item) {
    const name = item.name ? String(item.name).trim() : '';
    const alias = (item.aliases && String(item.aliases).trim() !== name) ? String(item.aliases).trim() : '';
    const lines = [];
    if (name) lines.push(name);
    if (alias) lines.push(alias);
    return lines;
  }

  function charUnits(str) {
    let u = 0;
    for (const ch of String(str)) {
      u += (/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch)) ? 1 : 0.58;
    }
    return u;
  }

  function addPointsLabelToPolygon(poly, item, style) {
    const lines = pointsLabelLines(item);
    if (!lines.length || !map) return;
    const anchor = poly.getCenter ? poly.getCenter() : poly.getBounds().getCenter();
    const renderer = map.getRenderer(poly);
    if (!renderer || !renderer._container) return;

    const textColor = style.textColor || '#1a1a1a';
    const maxFont = Number(style.textSize) || 16;

    const svg = renderer._container;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'points-text-layer');
    g.setAttribute('style', 'pointer-events:none;');
    const textEl = document.createElementNS(SVG_NS, 'text');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.setAttribute('fill', textColor);
    const tspans = lines.map((ln) => {
      const t = document.createElementNS(SVG_NS, 'tspan');
      t.setAttribute('x', '0');
      t.textContent = ln;
      textEl.appendChild(t);
      return t;
    });
    g.appendChild(textEl);
    svg.appendChild(g);

    const obj = { element: g, update: null, remove: null };

    function update() {
      const bounds = poly.getBounds();
      const nw = map.latLngToLayerPoint(bounds.getNorthWest());
      const se = map.latLngToLayerPoint(bounds.getSouthEast());
      const w = Math.abs(se.x - nw.x);
      const h = Math.abs(se.y - nw.y);
      const c = map.latLngToLayerPoint(anchor);
      const maxLineUnits = Math.max.apply(null, lines.map(charUnits));
      const lineCount = lines.length;
      const lineRatio = 1.3;
      const availW = w * 0.86;
      const availH = h * 0.8;
      const byW = availW / Math.max(maxLineUnits, 0.1);
      const byH = availH / (lineCount * lineRatio);
      let fontSize = Math.min(maxFont, byW, byH);
      if (fontSize < 4) { g.setAttribute('visibility', 'hidden'); return; }
      g.setAttribute('visibility', 'visible');
      const lineHeight = fontSize * lineRatio;
      const blockW = maxLineUnits * fontSize;
      const blockH = lineCount * lineHeight;
      const left = c.x - blockW / 2;
      const top = c.y - blockH / 2;
      g.setAttribute('transform', 'translate(' + left + ',' + top + ')');
      textEl.setAttribute('font-size', fontSize);
      const tsx = blockW / 2;
      const baseY = lineHeight / 2;
      tspans.forEach((t, i) => {
        t.setAttribute('x', tsx);
        t.setAttribute('y', baseY + i * lineHeight);
        t.setAttribute('dominant-baseline', 'central');
      });
    }

    function remove() {
      map.off('zoomend moveend resize', update);
      if (g.parentNode) g.parentNode.removeChild(g);
      const idx = pointsTextLayers.indexOf(obj);
      if (idx >= 0) pointsTextLayers.splice(idx, 1);
    }

    obj.update = update;
    obj.remove = remove;
    map.on('zoomend moveend resize', update);
    update();
    pointsTextLayers.push(obj);
  }

  function clearPointsTextLayers() {
    pointsTextLayers.slice().forEach((o) => o.remove());
    pointsTextLayers = [];
  }

    function pointsToLatLngs(points) {
    if (!Array.isArray(points) || points.length < 3) return null;
    const nested = Array.isArray(points[0]);
    const latlngs = [];
    if (nested) {
      for (const p of points) {
        if (!Array.isArray(p) || p.length < 2) return null;
        const lat = Number(p[0]);
        const lng = Number(p[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        latlngs.push([lat, lng]);
      }
    } else {
      for (let i = 0; i + 1 < points.length; i += 2) {
        const lat = Number(points[i]);
        const lng = Number(points[i + 1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        latlngs.push([lat, lng]);
      }
    }
    return latlngs.length >= 3 ? latlngs : null;
  }

  function renderCategoryMarkers() {
    if (!markerLayer) return;
    markerLayer.clearLayers();
    const cat = mapDisplayCategories()[state.mapCategory];
    if (!cat) return;

    let markers = [];
    const loc = (state.start && state.start.latitude) ? state.start : null;
    // 默认位置（工厂大门）按普通点位渲染，与「办公室」同款；真实定位仍是人物图标
    if (loc && loc.name !== '当前位置') {
      const isDefaultPoint = loc.name === '工厂大门';
      markers.push(formMarker(loc, isDefaultPoint ? 'site' : 'location', -1, isDefaultPoint ? 'life' : undefined, isDefaultPoint ? '生活配套' : undefined));
    }
    cat.list.forEach((site, i) => {
      const isCurrent = loc && Math.abs(Number(site.latitude) - Number(loc.latitude)) < 0.000001 && Math.abs(Number(site.longitude) - Number(loc.longitude)) < 0.000001;
      if (!isCurrent) {
        // 「全部」里每个点位沿用自己所属分类的配色与讲解，而不是「全部」这个虚拟分类
        const catName = site._catName || cat.name;
        markers.push(formMarker(site, 'site', i + 1, markerToneOf({ name: catName }), catName));
      }
    });
    fitMarkers(markers);
  }

  function markerToneOf(category) {
    const tones = { '展厅': 'storage', '丁腈车间': 'nitrile', 'PVC车间': 'pvc', '环保仓储': 'eco', '生活配套': 'life' };
    return tones[category.name] || 'main';
  }

  // 标签前的「小手」：提示该点位可点击 = 手指朝右 + 指尖「点击波纹」。
  // 形状：Material「pan_tool_alt」剪影（Apache-2.0），绕画布中心顺时针转 90° —— 手指朝右，
  //   正好指着紧随其后的点位名称。素材原生「手指朝上」，朝上时容易被读成向上箭头/图钉。
  // 旋转写在 transform 上（不重写 path 坐标）：想改回朝上/朝左，只动这一个角度即可。
  //   translate(0 -0.5) 是补正 —— 素材内容中心在 (12.5, 12)，转 90° 后落到 (12, 12.5)，
  //   需上移 0.5 单位才在 24 画布里精确居中（11px 显示时相当于 0.23px）。
  // 波纹（.tap-ripple）刻意不画进这个 SVG，而是用独立的 HTML 元素：
  //   ① SVG 只有 11px，任何环/弧进来都会被缩放糊掉（8 轮光栅化比对已验证）；
  //   ② 独立元素可以用纯 CSS transform 做扩散，控制精确、各浏览器一致。
  // 注意：波纹**不能画成闭合环**。实测「手指 + 闭环」会被读成「捏着一把钥匙」，
  //   所以只用右半段开口弧，且始终在扩散/淡出 —— 动起来的开口弧才读作「点一下」。
  // 选型依据见 .workbuddy/tap_guide*_sheet.png（11 个朝右候选 + 6 轮波纹写法比对）。
  // 对齐：内容已居中 → css 里 .label-tap 的 vertical-align 用居中基准值 -1.5px。
  const TAP_HAND_ICON =
    '<span class="label-tap" aria-hidden="true">' +
    '<svg class="tap-hand" viewBox="0 0 24 24" focusable="false">' +
    '<path transform="translate(0 -0.5) rotate(90 12 12)" d="m19.98 14.82-.63 4.46c-.14.99-.99 1.72-1.98 1.72h-6.16c-.53 0-1.29-.21-1.66-.59L5 15.62l.83-.84c.24-.24.58-.35.92-.28l3.25.74V4.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v6h.91c.31 0 .62.07.89.21l4.09 2.04c.77.39 1.21 1.22 1.09 2.07z"/>' +
    '</svg>' +
    '<i class="tap-ripple"></i><i class="tap-ripple tap-ripple-b"></i>' +
    '</span>';

  function formMarker(site, type, id, tone, categoryName) {
    const label = type === 'location' ? (site.name || '当前位置') : site.name;
    const toneClass = type === 'site' && tone ? ' tone-' + tone : '';
    // 呼吸光圈错峰：按点位序号依次延后，避免整片点位同时闪动
    // 取模到动画周期 2.8s 内：否则「全部」这类点位多的分类，靠后的点会出现正延时、
    // 加载后头一两秒没有光圈（看起来像"没效果"）
    const pulseDelay = (((typeof id === 'number' && id > 0 ? id : 0) * 0.22) % 2.8).toFixed(2) + 's';
    // 只有 site 类型可点击（location 是真实定位，点了没反应，所以不加小手）
    const labelHtml = (type === 'site' ? TAP_HAND_ICON : '') + esc(label);
    const icon = L.divIcon({
      className: '',
      html: '<div class="campus-marker' + toneClass + (type === 'location' ? ' start' : '') + '" style="--pulse-delay:' + pulseDelay + '"><span class="marker-pulse"></span><div class="marker-pin">' + (type === 'location' ? '<span class="marker-person"></span>' : '') + '</div><div class="marker-label">' + labelHtml + '</div></div>',
      iconSize: [40, 46],
      iconAnchor: [20, 40],
    });
    const layer = L.marker([site.latitude, site.longitude], { icon });
    layer.addTo(markerLayer);
    layer.on('click', () => {
      if (type === 'site' && !state.route.polyline) openGuideDialog(site, categoryName);
    });
    return { layer, site, id };
  }

  /* ---------- 讲解音色偏好 ----------
     voice-lab.html（试音台）选中的音色会存到 localStorage，键 glu_tts_voice：
     { voiceURI, name, lang, rate, pitch }。没存过就用浏览器默认 + 下面的兜底参数。
     确认要长期固定某个音色后，可直接把它写进 TTS_FALLBACK 的 voiceName。 */
  var TTS_FALLBACK = { voiceName: 'Microsoft Yunyang Online (Natural) - Chinese (Mainland)', rate: 0.92, pitch: 1 };

  function readTtsPref() {
    try {
      var raw = localStorage.getItem('glu_tts_voice');
      if (!raw) return TTS_FALLBACK;
      var p = JSON.parse(raw) || {};
      return {
        voiceURI: p.voiceURI || '',
        voiceName: p.name || TTS_FALLBACK.voiceName,
        rate: Number(p.rate) || TTS_FALLBACK.rate,
        pitch: Number(p.pitch) || TTS_FALLBACK.pitch,
      };
    } catch (e) {
      return TTS_FALLBACK;
    }
  }

  /* 按试音台保存的 voiceURI 精确匹配；拿不到再退到名字匹配，最后按兜底名字找 */
  function pickTtsVoice(pref) {
    if (typeof speechSynthesis === 'undefined') return null;
    var list = window.speechSynthesis.getVoices() || [];
    if (!list.length) return null;
    var byUri = pref.voiceURI && list.filter(function (v) { return v.voiceURI === pref.voiceURI; })[0];
    if (byUri) return byUri;
    var name = pref.voiceName || TTS_FALLBACK.voiceName;
    if (!name) return null;
    return list.filter(function (v) { return v.name === name; })[0] || null;
  }

  /* ---------- 离线讲解音频（edge-tts 预生成 MP3） ----------
     讲解词已用微软神经语音 zh-CN-YunyangNeural 逐段生成 MP3（assets/audio/guides/<voice>/），
     由 assets/audio/guides/<voice>/manifest.js 提供清单（用 <script> 引入，file:// 也能用）。
     有音频就播 MP3（分段播放 + 当前段高亮），没有则回退到浏览器语音合成。 */
  var GUIDE_AUDIO_VOICE = 'zh-CN-YunyangNeural';
  var guideAudioEl = null;
  var guideAudio = { playing: false, token: 0 };

  function guideAudioFiles(guideKey) {
    var all = (window.GLU_GUIDE_AUDIO || {})[GUIDE_AUDIO_VOICE];
    if (!all || !all.guides) return null;
    var g = all.guides[guideKey];
    return (g && g.files && g.files.length) ? g.files : null;
  }

  function getGuideAudioEl() {
    if (!guideAudioEl) {
      guideAudioEl = new Audio();
      guideAudioEl.preload = 'auto';
    }
    return guideAudioEl;
  }

  /* 高亮正在朗读的段落：第 0 段是导言，正文段落从 1 开始 */
  function highlightGuideSection(fileIndex) {
    var secs = document.querySelectorAll('#modalBody .explain-section');
    for (var i = 0; i < secs.length; i++) {
      if (i === fileIndex - 1) secs[i].classList.add('speaking');
      else secs[i].classList.remove('speaking');
    }
    var cur = secs[fileIndex - 1];
    if (cur && cur.scrollIntoView) {
      try { cur.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }
  function clearGuideSectionHighlight() {
    var secs = document.querySelectorAll('#modalBody .explain-section.speaking');
    for (var i = 0; i < secs.length; i++) secs[i].classList.remove('speaking');
  }

  function playGuideAudio(guideKey, button, onFail) {
    var files = guideAudioFiles(guideKey);
    if (!files) {
      console.warn('[guide-audio] 清单里没有 guideKey =', guideKey, 'GLU_GUIDE_AUDIO =', window.GLU_GUIDE_AUDIO);
      return false;
    }
    stopTtsKeepAlive();
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }

    var el = getGuideAudioEl();
    var pref = readTtsPref();
    el.playbackRate = pref.rate || TTS_FALLBACK.rate;
    el.volume = 1;
    el.muted = false;

    var token = ++guideAudio.token;
    guideAudio.playing = true;
    setVoiceBtnState(button, true);
    console.log('[guide-audio] 开始播放', guideKey, files.length, '段，voice =', GUIDE_AUDIO_VOICE);

    var index = 0;
    var step = function () {
      if (!guideAudio.playing || token !== guideAudio.token) return;
      var f = files[index];
      if (!f) { stopGuideAudio(button); return; }
      highlightGuideSection(index);
      el.src = f.file;
      el.currentTime = 0;
      var done = false;
      var once = function () {
        if (done) return;
        done = true;
        index += 1;
        step();
      };
      el.onended = once;
      el.onerror = once;
      var p = el.play();
      if (p && p.catch) {
        p.catch(function (err) {
          console.warn('[guide-audio] play() 被拒绝：', err && err.name, err && err.message, 'mediaError =', el.error && el.error.code);
          if (done) return;
          done = true;
          if (index === 0 && onFail) {
            // 第一段就播不出来：多半是浏览器拦截/解码问题，直接回退浏览器语音合成
            stopGuideAudio(button);
            toast('离线语音播放失败，已切回浏览器语音');
            onFail();
          } else {
            index += 1;
            step();
          }
        });
      }
    };
    step();
    return true;
  }

  function stopGuideAudio(button) {
    guideAudio.playing = false;
    guideAudio.token += 1;
    if (guideAudioEl) {
      guideAudioEl.onended = null;
      guideAudioEl.onerror = null;
      try { guideAudioEl.pause(); } catch (e) {}
    }
    clearGuideSectionHighlight();
    setVoiceBtnState(button, false);
  }
  function isGuideAudioPlaying() { return guideAudio.playing; }

  /* 按钮右侧直接标出「这段声音从哪来」，一眼可辨：
     离线真人音 = 播放预生成的 MP3；浏览器合成音 = Web Speech 实时合成 */
  function voiceSrcLabel(forceTts) {
    if (forceTts) return '浏览器合成音';
    try { if (readTtsPref().mode === 'tts') return '浏览器合成音'; } catch (e) {}
    return '离线真人音';
  }
  function voiceIdleHtml(forceTts) {
    return '<span class="voice-play">▶</span><span class="voice-label">开始讲解</span>' +
      '<span class="voice-en">' + voiceSrcLabel(forceTts) + '</span>';
  }
  function voicePlayHtml(forceTts) {
    return '<span class="voice-play">■</span><span class="voice-label">停止讲解</span>' +
      '<span class="voice-en">' + voiceSrcLabel(forceTts) + '</span>';
  }

  function setVoiceBtnState(button, playing, forceTts) {
    if (!button) return;
    if (playing) {
      button.classList.add('playing');
      button.innerHTML = voicePlayHtml(forceTts);
    } else {
      button.classList.remove('playing');
      button.innerHTML = voiceIdleHtml(forceTts);
    }
  }

  function speakSite(site, button, overrideText) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      toast('当前浏览器暂不支持语音讲解');
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      stopTtsKeepAlive();
      setVoiceBtnState(button, false, true);
      return;
    }
    const text = overrideText || [site.name, site.aliases, site.desc].filter(Boolean).join('。');
    const utterance = new SpeechSynthesisUtterance(text || site.name);
    const ttsPref = readTtsPref();
    const ttsVoice = pickTtsVoice(ttsPref);
    if (ttsVoice) {
      utterance.voice = ttsVoice;
      utterance.lang = ttsVoice.lang || 'zh-CN';
    } else {
      utterance.lang = 'zh-CN';
    }
    utterance.rate = ttsPref.rate || TTS_FALLBACK.rate;
    utterance.pitch = ttsPref.pitch || TTS_FALLBACK.pitch;
    setVoiceBtnState(button, true, true);
    const reset = () => {
      stopTtsKeepAlive();
      setVoiceBtnState(button, false, true);
    };
    utterance.onend = reset;
    utterance.onerror = reset;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    startTtsKeepAlive();
  }

  /* Chrome/Edge 的老问题：连续朗读超过约 15 秒会被静默掐断。
     讲解词普遍较长，用 pause/resume 心跳续命（对短文本无害）。 */
  var ttsKeepAliveTimer = null;
  function startTtsKeepAlive() {
    stopTtsKeepAlive();
    ttsKeepAliveTimer = setInterval(() => {
      if (!window.speechSynthesis || !window.speechSynthesis.speaking) {
        stopTtsKeepAlive();
        return;
      }
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } catch (e) { /* 部分浏览器不支持 pause/resume，忽略 */ }
    }, 9000);
  }
  function stopTtsKeepAlive() {
    if (ttsKeepAliveTimer) {
      clearInterval(ttsKeepAliveTimer);
      ttsKeepAliveTimer = null;
    }
  }

  function openGuideDialog(site, categoryName) {
    if (!site) return;
    const guide = AREA_GUIDES[categoryName] || AREA_GUIDES['生活配套'];
    const dataGuide = ((window.GLU_DATA || {}).guides || {})[site.guideKey] || null;
    const showSteps = !guide.hideSteps && (guide.steps || []).length > 0;
    const stepsHtml = showSteps ? (guide.steps || []).map((s, i) =>
      '<div class="explain-step"><span class="step-num">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<strong class="step-title">' + esc(s.t) + '</strong></div>'
    ).join('<span class="step-arrow">→</span>')
      : '<div class="explain-steps-empty"></div>';
    const stepsBlock = showSteps
      ? '<div class="explain-process-head"><span>参观重点</span><span class="process-en">PROCESS</span></div>' +
        '<div class="explain-steps">' + stepsHtml + '</div>'
      : '';
    // 该点位有没有预生成的离线 MP3：有就播真人离线音，没有才回退浏览器合成
    const hasOfflineAudio = !!(site.guideKey && guideAudioFiles(site.guideKey));
    const voiceBlock = guide.hideVoice ? '' :
      '<button class="voice-btn explain-voice explain-voice-mid" id="explainVoiceBtn" type="button">' +
      voiceIdleHtml(!hasOfflineAudio) +
      '</button>';
    const sectionsHtml = (dataGuide && (dataGuide.sections || []).length)
      ? '<div class="explain-process-head"><span>讲解内容</span><span class="process-en">GUIDE</span></div>' +
        '<div class="explain-sections">' + dataGuide.sections.map((s) =>
          '<div class="explain-section"><div class="explain-section-title">' + esc(s.t) + '</div>' +
          '<p class="explain-section-text">' + esc(s.d) + '</p></div>'
        ).join('') + '</div>'
      : '';

    $('#modalTitle').textContent = '';
    $('#modalBox').classList.add('explain-mode');
    $('#modalBody').innerHTML =
      '<button class="explain-close" id="explainClose" type="button">×</button>' +
      '<div class="explain-hero">' +
      '<img class="explain-bg" src="' + esc(site.img || DEFAULT_SITE_IMG) + '" alt="" />' +
      '<div class="explain-overlay"></div>' +
      '<div class="explain-head">' +
      '<span class="explain-kicker">' + esc((dataGuide && dataGuide.en) || guide.en || 'AREA') + '</span>' +
      '<div class="explain-title">' + esc(site.name) + '</div>' +
      '<div class="explain-subtitle">' + esc((dataGuide && dataGuide.subtitle) || guide.subtitle || site.aliases || '') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="explain-content">' +
      '<p class="explain-desc">' + esc(site.desc || '暂无详细介绍') + '</p>' +
      stepsBlock +
      voiceBlock +
      sectionsHtml +
      '</div>';
    $('#modalFooter').innerHTML = '';
    $('#modalMask').classList.add('show');

    $('#explainClose').addEventListener('click', hideModal);
    const voiceBtn = $('#explainVoiceBtn');
    if (voiceBtn) {
      const guideText = dataGuide
        ? [
            site.name,
            dataGuide.subtitle,
            site.desc,
            (dataGuide.sections || []).map((s) => s.t + '：' + s.d).join('；')
          ].filter(Boolean).join('。')
        : [
            site.name,
            guide.subtitle,
            site.desc,
            showSteps ? ('参观重点：' + (guide.steps || []).map((s, i) => (i + 1) + '. ' + s.t + '，' + s.d).join('；')) : ''
          ].filter(Boolean).join('。');
      voiceBtn.addEventListener('click', () => {
        // 只要该点位有离线 MP3，永远优先播 MP3（不受试音台"浏览器音色"选择影响）；
        // MP3 缺失或首段播放失败时才回退浏览器合成。
        if (isGuideAudioPlaying()) { stopGuideAudio(voiceBtn); return; }
        if (site.guideKey &&
            playGuideAudio(site.guideKey, voiceBtn, () => speakSite(site, voiceBtn, guideText))) return;
        speakSite(site, voiceBtn, guideText);
      });
    }
  }

  function fitMarkers(markers) {
    if (!markers.length) return;
    const campus = mapCampusData();
    const latlngs = (campus.range || []).map((p) => [p.latitude, p.longitude]);
    latlngs.push(...markers.map((m) => [m.site.latitude, m.site.longitude]));
    try {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.06), { paddingTopLeft: [24, 172], paddingBottomRight: [24, 72] });
    } catch (e) {}
  }

  function changeCategory(i) {
    if (state.mapCategory === i) {
      state.mapCategory = -1;
      $$('#mapCategories .map-cat').forEach((el) => el.classList.remove('choose'));
      if (markerLayer) markerLayer.clearLayers();
      $('#mapBottomBtn').classList.add('hidden');
      return;
    }
    state.mapCategory = i;
    $$('#mapCategories .map-cat').forEach((el, k) => el.classList.toggle('choose', k === i));
    const el = $('#mapCategories .map-cat[data-i="' + i + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    renderCategoryMarkers();
    $('#mapBottomBtn').classList.add('hidden');
  }

  /* =========================================================
     定位后的基地自动切换（电子围栏）
     ========================================================= */
  /* 判定半径：定位落在这个距离内算「到了该基地」，否则兜底回淮北基地大门 */
  const CAMPUS_GEOFENCE_KM = 30;
  // 本次定位是否已经给出过提示：为真时让位给新提示，避免与「不在厂区内」的旧提示重复弹
  let locationNoticeShown = false;

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const rad = (d) => d * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /* 落在任一基地 CAMPUS_GEOFENCE_KM 公里内 → 返回最近的那个基地下标；都不在 → -1 */
  function campusIndexNear(lat, lng) {
    let best = -1;
    let bestKm = Infinity;
    (MAP.site_data || []).forEach((c, i) => {
      if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
      const km = haversineKm(lat, lng, c.latitude, c.longitude);
      if (km < bestKm) { bestKm = km; best = i; }
    });
    return (best >= 0 && bestKm <= CAMPUS_GEOFENCE_KM) ? best : -1;
  }

  /* 兜底基地（淮北）：先按 base_name/name 含「淮北」，再按 id===1，最后退回 index 0 */
  function fallbackCampusIndex() {
    const list = MAP.site_data || [];
    const byName = list.findIndex((c) => ((c.base_name || '') + (c.name || '')).indexOf('淮北') >= 0);
    if (byName >= 0) return byName;
    const byId = list.findIndex((c) => c.id === 1);
    return byId >= 0 ? byId : 0;
  }

  /* 视角落到当前基地的「工厂大门」（state.mapDefaultPoint，由 defaultPointOf 算出） */
  function focusDefaultGate() {
    const def = state.mapDefaultPoint;
    if (map && def && Number.isFinite(def.latitude) && Number.isFinite(def.longitude)) {
      // 与搜索页「定位」同一把锁：别让 watchPosition 的首次居中把刚定好的大门视角抢走
      state.focusLock = Date.now() + 3000;
      map.setView([def.latitude, def.longitude], FOCUS_ZOOM);
    }
  }

  /* 定位成功后按电子围栏自动选基地：
     · 在任一基地 30km 内 → 切到该基地（已在就什么都不做）
     · 都不在         → 提示 + 切回淮北基地，视角落到工厂大门
     force=true（用户点了右侧定位按钮）时强制重判；否则只在首次定位成功时判一次，
     之后用户手动选的基地不会被 watchPosition 的后续刷新抢走。 */
  function resolveCampusByLocation(lat, lng, force) {
    locationNoticeShown = false;
    if (state.campusResolved && !force) return;
    state.campusResolved = true;
    const idx = campusIndexNear(lat, lng);
    if (idx >= 0) {
      if (idx !== state.campus) {
        switchCampus(idx);
        locationNoticeShown = true;
        toast('已定位到' + campusLabel(MAP.site_data[idx]) + '附近，自动切换到该基地', 2400);
      }
      return;
    }
    const hb = fallbackCampusIndex();
    if (state.campus !== hb) switchCampus(hb);
    focusDefaultGate();
    locationNoticeShown = true;
    toast('当前位置不在任一基地 ' + CAMPUS_GEOFENCE_KM + ' 公里内\n已切换到'
      + campusLabel(MAP.site_data[hb]) + '工厂大门', 3200);
  }

  function locateMe() {
    const apply = (lat, lng) => {
      const test = { latitude: lat, longitude: lng };
      if (isPointInPolygon(test, state.mapPoints)) {
        state.mapIsAtSchool = true;
        state.start = { name: '当前位置', latitude: lat, longitude: lng };
        syncMapInputs();
        renderCategoryMarkers();
      } else {
        state.mapIsAtSchool = false;
        const def = state.mapDefaultPoint;
        if (def) {
          state.start = defaultStartOf(def);
          syncMapInputs();
          // 围栏逻辑已经提示过「不在任一基地 30 公里内」时不再重复提示
          if (!locationNoticeShown) toast('当前位置不在厂区内\n默认位置设为' + def.name, 2200);
        }
        renderCategoryMarkers();
      }
    };
    /* 浏览器定位返回 WGS-84，而地图/数据使用 GCJ-02，需转换消除系统偏移 */
    const toMapCoords = (lat, lng) => {
      const raw = { latitude: lat, longitude: lng };
      const g = wgs2gcj(lat, lng);
      const gcj = { latitude: g.lat, longitude: g.lng };
      const rawIn = isPointInPolygon(raw, state.mapPoints);
      const gcjIn = isPointInPolygon(gcj, state.mapPoints);
      // 若浏览器已返回 GCJ-02（原始点在校内而转换后反而在外），则沿用原始坐标
      return (rawIn && !gcjIn) ? raw : gcj;
    };
    if (navigator.geolocation) {
      const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 };
      locationDebug('调用 navigator.geolocation.getCurrentPosition', {
        method: 'getCurrentPosition(success, error, options)',
        source: '地图初始化定位',
        options,
      });
      const initialPositionReturn = navigator.geolocation.getCurrentPosition(
        (pos) => {
          locationDebug('getCurrentPosition 成功回调返回值', {
            position: pos,
            coords: pos && pos.coords,
            timestamp: pos && pos.timestamp,
          });
          markLocationResolved();
          const c = toMapCoords(pos.coords.latitude, pos.coords.longitude);
          // 先按 30km 围栏定基地（可能切基地并重置 state.mapPoints/默认点），再判断是否在厂区内
          resolveCampusByLocation(c.latitude, c.longitude);
          apply(c.latitude, c.longitude);
          requestOrientationAfterLocation('navigator.geolocation.getCurrentPosition（地图初始化）');
        },
        (err) => {
          state.mapIsAtSchool = false;
          const def = state.mapDefaultPoint;
          if (def) state.start = defaultStartOf(def);
          syncMapInputs();
          renderCategoryMarkers();
          handleLocError(err, 'navigator.geolocation.getCurrentPosition（地图初始化）');
          toast('已使用默认位置：' + (def ? def.name : '默认点'), 2200);
        },
        options
      );
      locationDebug('getCurrentPosition 方法同步返回值', {
        returnValue: initialPositionReturn,
        returnType: typeof initialPositionReturn,
      });
    } else {
      const def = state.mapDefaultPoint;
      if (def) state.start = defaultStartOf(def);
      syncMapInputs();
      renderCategoryMarkers();
      locationDebugWarn('地图初始化定位失败：navigator.geolocation 不存在', {
        method: 'navigator.geolocation.getCurrentPosition',
        returnValue: undefined,
      });
      handleLocError(
        { message: '当前浏览器不支持 Geolocation API' },
        'navigator.geolocation.getCurrentPosition（地图初始化）'
      );
      toast('已使用默认位置：' + (def ? def.name : '默认点'), 2200);
    }
  }

  /* WGS-84 -> GCJ-02（国测局坐标）转换 */
  function wgs2gcj(lat, lng) {
    const PI = Math.PI;
    const A = 6378245.0;
    const EE = 0.00669342162296594323;
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return { lat, lng };
    const transformLat = (x, y) => {
      let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
      ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
      ret += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
      ret += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
      return ret;
    };
    const transformLng = (x, y) => {
      let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
      ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
      ret += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
      ret += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
      return ret;
    };
    let dLat = transformLat(lng - 105, lat - 35);
    let dLng = transformLng(lng - 105, lat - 35);
    const radLat = lat / 180 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = dLat * 180 / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = dLng * 180 / (A / sqrtMagic * Math.cos(radLat) * PI);
    return { lat: lat + dLat, lng: lng + dLng };
  }

  /* 点在多边形内 */
  function isPointInPolygon(point, polygon) {
    const toNum = ({ longitude, latitude }) => ({ longitude: +longitude, latitude: +latitude });
    point = toNum(point);
    polygon = (polygon || []).map(toNum);
    for (const v of polygon) {
      if (Math.abs(v.longitude - point.longitude) < 1e-9 && Math.abs(v.latitude - point.latitude) < 1e-9) return true;
    }
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const a = polygon[i], b = polygon[(i + 1) % n];
      if (isPointOnSegment(point, a, b)) return true;
    }
    let crossings = 0;
    for (let i = 0; i < n; i++) {
      const a = polygon[i], b = polygon[(i + 1) % n];
      const [aLat, bLat] = [a.latitude, b.latitude];
      const pLat = point.latitude;
      if (aLat >= pLat === bLat >= pLat) continue;
      if (aLat === bLat) continue;
      const t = (pLat - aLat) / (bLat - aLat);
      const intersectLon = a.longitude + t * (b.longitude - a.longitude);
      if (intersectLon > point.longitude + 1e-9) crossings++;
    }
    return crossings % 2 === 1;
  }
  function isPointOnSegment(p, a, b) {
    const toNum = (o) => ({ longitude: +o.longitude, latitude: +o.latitude });
    p = toNum(p); a = toNum(a); b = toNum(b);
    const cross = (p.longitude - a.longitude) * (b.latitude - a.latitude) - (p.latitude - a.latitude) * (b.longitude - a.longitude);
    if (Math.abs(cross) > 1e-9) return false;
    const minLon = Math.min(a.longitude, b.longitude), maxLon = Math.max(a.longitude, b.longitude);
    const minLat = Math.min(a.latitude, b.latitude), maxLat = Math.max(a.latitude, b.latitude);
    return p.longitude >= minLon - 1e-9 && p.longitude <= maxLon + 1e-9 && p.latitude >= minLat - 1e-9 && p.latitude <= maxLat + 1e-9;
  }

  /* ---------- 路线 ---------- */
  function modeChoose(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    $$('.map-modes .mode').forEach((m) => m.classList.toggle('choose', m.dataset.mode === mode));
    formSubmit();
  }

  function exchange() {
    if (!state.end.name) { toast('请选择终点！'); return; }
    const s = state.start, e = state.end;
    state.start = e; state.end = s;
    syncMapInputs();
    formSubmit();
  }

  function formSubmit() {
    if (!state.end.name) {
      // 该厂区配了固定引导路线时，点「路线」直接看整条引导路线
      if (guideRoutePoints.length >= 2) {
        try { map.fitBounds(L.latLngBounds(guideRoutePoints).pad(0.15)); } catch (e) {}
        return;
      }
      toast('请选择终点！');
      return;
    }
    const s = state.start, e = state.end;
    if (s.latitude === e.latitude && s.longitude === e.longitude) { toast('起点和终点不能相同'); return; }
    showRouteUI();
    requestRoute(s, e, state.mode);
  }

  async function requestRoute(s, e, mode) {
    const key = MAP.mapKey;
    const url = 'https://apis.map.qq.com/ws/direction/v1/' + mode + '/?from=' + s.latitude + ',' + s.longitude + '&to=' + e.latitude + ',' + e.longitude + '&key=' + key;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('http ' + res.status);
      const j = await res.json();
      if (j && j.status === 0 && j.result && j.result.routes && j.result.routes[0]) {
        applyRouteResult(j.result.routes[0]);
        return;
      }
      throw new Error((j && j.message) || 'route fail');
    } catch (err) {
      try {
        const r2 = await fetch('/api/route?mode=' + mode + '&from=' + s.latitude + ',' + s.longitude + '&to=' + e.latitude + ',' + e.longitude);
        if (!r2.ok) throw new Error('proxy ' + r2.status);
        const j2 = await r2.json();
        if (j2 && j2.status === 0 && j2.result && j2.result.routes && j2.result.routes[0]) {
          applyRouteResult(j2.result.routes[0]);
          return;
        }
        throw new Error('proxy-fail');
      } catch (e2) {
        estimateRoute(s, e, mode);
      }
    }
  }

  function applyRouteResult(route) {
    let coors = route.polyline;
    if (typeof coors === 'string') coors = coors.split(',').map(Number);
    if (!Array.isArray(coors)) coors = [];
    const pl = [];
    const kr = 1000000;
    const arr = coors.slice();
    for (let i = 2; i < arr.length; i++) arr[i] = Number(arr[i - 2]) + Number(arr[i]) / kr;
    for (let i = 0; i < arr.length; i += 2) pl.push({ latitude: arr[i], longitude: arr[i + 1] });
    drawRoute(pl, route.duration, route.distance, route.steps || []);
  }

  function estimateRoute(s, e, mode) {
    const dist = haversine(s, e);
    const speed = mode === 'driving' ? 30 : mode === 'bicycling' ? 15 : 5;
    const dur = Math.max(1, Math.round(dist / 1000 / speed * 60));
    const lat1 = +s.latitude, lng1 = +s.longitude, lat2 = +e.latitude, lng2 = +e.longitude;
    const mlat = (lat1 + lat2) / 2 + (lng2 - lng1) * 0.12;
    const mlng = (lng1 + lng2) / 2 - (lat2 - lat1) * 0.12;
    const pl = [{ latitude: lat1, longitude: lng1 }, { latitude: mlat, longitude: mlng }, { latitude: lat2, longitude: lng2 }];
    drawRoute(pl, dur, dist, [
      { instruction: '从起点出发（估算路线，仅供参考）' },
      { instruction: '沿厂区道路前行' },
      { instruction: '到达终点（估算）' },
    ]);
  }

  function haversine(a, b) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(+b.latitude - +a.latitude);
    const dLng = toRad(+b.longitude - +a.longitude);
    const la1 = toRad(+a.latitude), la2 = toRad(+b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }

  function drawRoute(pl, duration, distance, steps) {
    clearRouteLayers();
    state.route.polyline = L.polyline(pl.map((p) => [p.latitude, p.longitude]), { color: '#58c16c', weight: 8, opacity: 0.9 }).addTo(routeLayer);
    state.route.duration = duration;
    state.route.distance = Math.round(distance);
    state.route.steps = steps;
    $('#mapBottomBtn').classList.remove('hidden');

    const sIcon = L.divIcon({ className: '', html: '<div class="campus-marker start"><div class="marker-pin"><span class="marker-person"></span></div><div class="marker-label">当前位置</div></div>', iconSize: [40, 46], iconAnchor: [20, 40] });
    const eIcon = L.divIcon({ className: '', html: '<div class="campus-marker end"><div class="marker-pin"></div></div>', iconSize: [40, 46], iconAnchor: [20, 40] });
    L.marker([state.start.latitude, state.start.longitude], { icon: sIcon }).addTo(routeLayer);
    L.marker([state.end.latitude, state.end.longitude], { icon: eIcon }).addTo(routeLayer);

    animateCar(pl.map((p) => [p.latitude, p.longitude]));
    $('#mapBottomBtn').textContent = '🧭 路线详情';
    try { map.fitBounds(L.latLngBounds(pl.map((p) => [p.latitude, p.longitude])).pad(0.2)); } catch (e) {}
  }

  function animateCar(path) {
    if (!path || path.length < 2) return;
    const icon = L.divIcon({ className: '', html: '<div class="campus-marker start"><div class="marker-pin"><span class="marker-person"></span></div></div>', iconSize: [40, 46], iconAnchor: [20, 40] });
    const car = L.marker(path[0], { icon }).addTo(routeLayer);
    state.route.carMarker = car;
    const dur = 4000;
    const startTime = performance.now();
    function step(now) {
      const p = Math.min(1, (now - startTime) / dur);
      const idx = Math.min(path.length - 1, Math.floor(p * (path.length - 1)));
      car.setLatLng(path[idx]);
      if (p < 1) requestAnimationFrame(step);
      else { car.remove(); state.route.carMarker = null; }
    }
    requestAnimationFrame(step);
  }

  function clearRouteLayers() {
    if (!routeLayer) return;
    routeLayer.clearLayers();
    state.route.polyline = null;
    state.route.carMarker = null;
  }

  function showRouteUI() {
    $('#mapControl').style.display = 'none';
    $('#mapModes').classList.add('show');
    $('#mapRestoreBtn').classList.remove('hidden');
    $$('.map-modes .mode').forEach((m) => m.classList.toggle('choose', m.dataset.mode === state.mode));
  }
  function hideRouteUI() {
    $('#mapControl').style.display = 'block';
    $('#mapModes').classList.remove('show');
    $('#mapRestoreBtn').classList.add('hidden');
  }

  function restore() {
    if (state.route.polyline) {
      clearRouteLayers();
      hideRouteUI();
      renderCampusControl();
      renderCategoryMarkers();
      return;
    }
    // 无路线时：回到当前厂区的初始视角
    const campus = mapCampusData();
    if (map && campus) map.setView([campus.latitude, campus.longitude], campus.scale || MAP.scale || 16);
    renderCategoryMarkers();
  }

  function clickMapBottom() {
    if (state.route.polyline) {
      const stepsHTML = state.route.steps.map((s, i) => '<div style="padding:5px 0;font-size:14px">' + (i + 1) + '. ' + esc(s.instruction || '') + '</div>').join('');
      openModal('路线详情',
        '<div style="font-weight:600">耗时：' + state.route.duration + '分钟 距离：' + state.route.distance + '米</div>' +
        '<div style="margin-top:6px">起点：' + esc(state.start.name) + '</div>' +
        '<div style="margin-top:6px">' + stepsHTML + '</div>' +
        '<div style="margin-top:6px">终点：' + esc(state.end.name) + '</div>',
        [{ text: '关闭' }]);
    }
  }

  /* 切换基地（地图页顶部胶囊 / 基地介绍页右上角 / 搜索页切换共用）。
     两页共用 state.campus，切一次两页同步刷新。因为底部「青州地图」tab 已移除，
     这里不再走 hash 路由 —— 否则切换基地会顺带把页面跳来跳去。 */
  function switchCampus(i) {
    const next = Number(i) || 0;
    if (next === state.campus) return;
    state.campus = next;

    // 地图页可见时立刻重载数据、标记与起终点；
    // 地图页不可见时什么都不做，回到地图页由 onMapShow 按 appliedCampus 差异自动重载
    // （避免在 display:none 的容器上 invalidateSize 把尺寸量成 0）
    const mapPage = $('#page-map');
    if (state.mapInited && map && mapPage && mapPage.classList.contains('active')) {
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
  }

  function syncMapInputs() {
    const startInput = $('#mapStartInput');
    const endInput = $('#mapEndInput');
    if (!startInput || !endInput) return;
    startInput.value = state.start.name || '当前地点/起点';
    endInput.value = state.end.name || '请选择终点';
    // 搜索页跟随当前地图 tab 的厂区
    startInput.onclick = () => { state.searchTarget = 1; location.hash = '#/search?id=1'; };
    endInput.onclick = () => { state.searchTarget = 0; location.hash = '#/search?id=0'; };
  }

  /* =========================================================
     搜索页
     ========================================================= */
  /* 搜索页图标全部内联 SVG，不再依赖任何外部图片。
     原来「搜索结果」的标题图标走的是 data.js 里 media.searchIcon —— 那是个外链
     （https://ico.dongtiyan.com/tu-99.png），外网不通时就是一个破图；
     而且 MEDIA.searchIcon 为空时还会渲染成 <img src=""> ，同样是破图。
     「搜索历史」的时钟图标原本是栅格 png（assets/images/history.png），
     一起换成同风格矢量图标，两个标题样式才统一。 */
  const SEARCH_SVG = {
    search: '<svg class="shi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-3.9-3.9"/></svg>',
    clock: '<svg class="shi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.2v5.2l3.4 1.9"/></svg>',
    trash: '<svg class="shi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.6 7l.9 12.2h9l.9-12.2"/><path d="M10.2 10.6v5.2M13.8 10.6v5.2"/></svg>',
    empty: '<svg class="shi shi-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-3.9-3.9"/><path d="M8.2 11h5.6"/></svg>',
    arrow: '<svg class="ri-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></svg>',
    locate: '<svg class="shi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6.1"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><path d="M12 2.4v3.4M12 18.2v3.4M2.4 12h3.4M18.2 12h3.4"/></svg>',
  };

  function renderSearch() {
    $('#searchRoot').innerHTML =
      '<div class="search-bar">' +
      (MAP.site_data.length > 1
        ? '<button class="picker search-campus" id="searchCampusBtn" type="button">' +
          esc(campusLabel(mapCampusData()) || state.campus_name_list[state.campus]) + '</button>'
        : '') +
      '<label class="search-field">' + SEARCH_SVG.search +
      '<input class="search-input" id="searchInput" placeholder="请输入要搜索的地点" autocomplete="off" />' +
      '<button class="search-clear" id="searchClear" type="button" aria-label="清空输入">×</button>' +
      '</label>' +
      '<button class="search-go" id="searchGo" type="button">搜索</button>' +
      '</div>';

    const cb = $('#searchCampusBtn');
    if (cb) cb.addEventListener('click', () => showCampusPicker(
      (i) => { switchCampus(i); renderSearch(); },
      { labels: MAP.site_data.map((s) => s.base_name || s.name), current: state.campus }
    ));

    $('#searchGo').addEventListener('click', goSearch);
    const inp = $('#searchInput');
    const clr = $('#searchClear');
    const syncClear = () => clr.classList.toggle('show', !!inp.value);
    inp.value = state.searchContent || '';
    syncClear();
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') goSearch(); });
    inp.addEventListener('input', () => { state.searchContent = inp.value; syncClear(); });
    clr.addEventListener('click', () => {
      inp.value = '';
      state.searchContent = '';
      syncClear();
      $('#searchResult').innerHTML = '';
      inp.focus();
    });

    renderSearchHistory();
    $('#searchResult').innerHTML = '';
  }

  function renderSearchHistory() {
    const hist = getHistory();
    const box = $('#searchHistory');
    if (!hist.length) {
      box.innerHTML =
        '<div class="search-panel">' +
        '<div class="headline">' + SEARCH_SVG.clock +
        '<span class="title">搜索历史</span></div>' +
        '<div class="no-content">还没有搜索记录</div>' +
        '</div>';
      return;
    }
    box.innerHTML =
      '<div class="search-panel">' +
      '<div class="headline">' + SEARCH_SVG.clock +
      '<span class="title">搜索历史</span>' +
      '<span class="headline-count">' + hist.length + '</span>' +
      '<button class="headline-act" id="clearHist" type="button" aria-label="清空搜索历史">' + SEARCH_SVG.trash + '</button>' +
      '</div>' +
      '<div class="search-chunks">' + hist.map((h) => '<span class="search-chunk" data-q="' + esc(h) + '">' + esc(h) + '</span>').join('') + '</div>' +
      '</div>';
    $('#clearHist').addEventListener('click', clearHistory);
    $$('.search-chunk', box).forEach((c) => c.addEventListener('click', () => {
      const inp = $('#searchInput');
      if (inp) inp.value = c.dataset.q;
      state.searchContent = c.dataset.q;
      goSearch();
    }));
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem('glu_history') || '[]'); } catch (e) { return []; }
  }
  function saveHistory(content) {
    let h = getHistory();
    h = h.filter((x) => x !== content);
    h.unshift(content);
    if (h.length > 10) h = h.slice(0, 10);
    localStorage.setItem('glu_history', JSON.stringify(h));
  }
  function clearHistory() {
    localStorage.removeItem('glu_history');
    renderSearchHistory();
    toast('搜索历史已清空', 1400);
  }

  function goSearch() {
    const inp = $('#searchInput');
    const content = ((inp && inp.value) || '').trim();
    state.searchContent = content;
    if (!content) {
      toast('请输入要搜索的地点');
      if (inp) inp.focus();
      return;
    }
    saveHistory(content);
    renderSearchHistory();   // 立刻把新关键词显示在历史里
    const keyword = content.toLowerCase();
    const result = [];
    // 搜索池 = 地图页的分类（siteOnly 分类没有坐标，不进池）。
    // 一并记住点位所属分类名：结果弹窗（openGuideDialog）与地图标记配色都按分类名取，
    // 合并出来的「生产车间」点位自带 _catName（来源分类），要优先用它。
    mapSiteData().forEach((cat) => {
      (cat.list || []).forEach((p) => {
        const name = p.name ? String(p.name).toLowerCase() : '';
        const aliases = p.aliases ? String(p.aliases).toLowerCase() : '';
        if (name.indexOf(keyword) !== -1 || aliases.indexOf(keyword) !== -1) {
          result.push({ site: p, catName: p._catName || cat.name });
        }
      });
    });
    renderSearchResult(result);
    const clr = $('#searchClear');
    if (clr) clr.classList.toggle('show', !!content);
  }

  function renderSearchResult(result) {
    const box = $('#searchResult');
    const head =
      '<div class="headline">' + SEARCH_SVG.search +
      '<span class="title">搜索结果</span>' +
      (result.length ? '<span class="headline-count">' + result.length + '</span>' : '') +
      '</div>';

    if (!result.length) {
      box.innerHTML =
        '<div class="search-panel">' + head +
        '<div class="result-empty">' + SEARCH_SVG.empty +
        '<p>没有找到「' + esc(state.searchContent || '') + '」相关的地点</p>' +
        '<span>换个关键词试试，例如「车间」「仓库」「餐厅」</span>' +
        '</div></div>';
      return;
    }

    box.innerHTML =
      '<div class="search-panel">' + head +
      '<div class="result-list">' +
      result.map((r, i) =>
        '<div class="result-item" data-i="' + i + '">' +
        '<span class="ri-idx">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div class="ri-main">' +
        '<div class="name">' + esc(r.site.name) + '</div>' +
        '<div class="alias">' + esc(r.site.aliases || r.catName || '') + '</div>' +
        '</div>' +
        '<button class="ri-locate" data-i="' + i + '" type="button">' +
        SEARCH_SVG.locate + '<span>定位</span>' +
        '</button>' +
        SEARCH_SVG.arrow +
        '</div>').join('') +
      '</div>' +
      '<div class="result-foot">轻点结果可查看该区域讲解，点「定位」可在地图上找到它</div>' +
      '</div>';

    // 点整行 = 与「地图讲解」页点击点位完全相同的讲解弹窗
    $$('.result-item', box).forEach((el) => {
      const r = result[Number(el.dataset.i)];
      el.addEventListener('click', () => openGuideDialog(r.site, r.catName));
    });
    // 「定位」：以该点位为中心回到「地图讲解」页
    $$('.ri-locate', box).forEach((btn) => btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const r = result[Number(btn.dataset.i)];
      focusSearchPoint(r.site, r.catName);
    }));
  }

  /* 搜索结果「定位」：记住目标点位，回到「地图讲解」页后以它为中心。
     记住之后由 onMapShow() 里的 applyPendingFocus() 统一落地 —— 因为回到地图页时
     可能还要先按基地差异重载数据、重绘标记，视角必须在这些之后才定。 */
  function focusSearchPoint(p, catName) {
    if (!p || !p.latitude) return;
    state.focusPoint = {
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      name: p.name,
      category: displayCategoryIndexFor(p, catName),   // 该点位在地图分类条里的位置
    };
    hideSub();
    // hash 没变（已经在 #/map）时不会触发 hashchange，手动走一次
    if (location.hash === '#/map') onMapShow();
    else location.hash = '#/map';
  }

  /* =========================================================
     使用说明 / 简介 / 全景 / 指南详情 / 声明
     ========================================================= */
  function renderInstruction(name) {
    $('#instructionBody').innerHTML =
      '<div class="instruction-card"><div class="instruction-h"><img src="' + asset(MEDIA.map) + '" alt="" /><span>使用说明</span></div>' +
      '<div class="instruction-txt">&emsp;&emsp;“基地介绍”页展示了各地点类型的地点，可切换地点类型查看。点击可以查看地点讲解，搜索里点“定位”还能直接在地图上找到它。</div>' +
      '<button class="instruction-btn" id="instrSite">去“基地介绍”页</button>' +
      '<div class="instruction-txt">&emsp;&emsp;“地图讲解”页展示了厂区地图，可以在地图上选择地点或者搜索地点进行导航。</div>' +
      '<div class="instruction-row top"><div class="k">定位</div><div class="v">点击定位图标可以重新定位<br/>若不在厂区，默认位置为 ' + esc(name || '默认地点') + '</div></div>' +
      '<div class="instruction-row"><div class="k">搜索</div><div class="v">点击顶部“搜索地点”查找厂区地点<br/>结果里点“定位”可在地图上找到它</div></div>' +
      '<div class="instruction-row"><div class="k">点击</div><div class="v">地点类型栏可以滑动点击<br/>点击地点可查看讲解信息<br/>点击底部可查看当前地点类型地点</div></div>' +
      '<div class="instruction-txt" style="margin-top:14px">&emsp;&emsp;你学会了吗，快去试试吧！</div>' +
      '<button class="instruction-btn" id="instrMap">去“地图讲解”页</button>' +
      '</div>';
    $('#instrSite').addEventListener('click', () => { hideSub(); location.hash = '#/site'; });
    $('#instrMap').addEventListener('click', () => { hideSub(); location.hash = '#/map'; });
  }

  function renderIntroduction() {
    const si = SCHOOL.school_information;
    const slides = (MEDIA.swiper_background || []).map((u) => '<div class="slide"><img src="' + esc(u) + '" /></div>').join('');
    $('#introductionBody').innerHTML =
      '<div class="intro-swiper">' + slides + '</div>' +
      '<div class="intro-swiper-dots">' + MEDIA.swiper_background.map((_, i) => '<i class="' + (i === 0 ? 'on' : '') + '"></i>').join('') + '</div>' +
      '<div class="intro-nav" id="introNav"><img src="' + asset(MEDIA.navigation) + '" alt="导航" /></div>' +
      '<div class="intro-title"><span class="intro-kicker">FACTORY PROFILE</span><div class="cn">厂区简介</div><div class="intro-accent"></div><div class="intro-company"><span>' + esc(si.school_name_full) + '</span><span>' + esc(si.school_name_English_full) + '</span></div></div>' +
      '<div class="intro-text">' + esc(si.text) + '</div>' +
      '<div class="intro-footer">信息来源：英科医疗官网</div>';
    $('#introNav').addEventListener('click', () => { hideSub(); location.hash = '#/map'; });
    $$('.intro-swiper .slide img').forEach((img) => img.addEventListener('click', () => previewImage(img.src)));
  }

  function renderPano() {
    const panos = [
      { name: '厂区总览', src: asset(MEDIA.map_bottom), info: { title: '厂区总览', content: '安徽英科医疗厂区整体示意图，涵盖生产车间、仓储与生活配套区域。' } },
      { name: '厂区主入口', src: asset(MEDIA.map_bottom), info: { title: '厂区主入口', content: '厂区主出入口（工厂大门），来访车辆与人员由此进出。' } },
    ];
    let idx = state.panoIndex;
    $('#panoBody').innerHTML =
      '<div class="pano-hint">' + esc(panos[idx].name) + '</div>' +
      '<div class="pano-viewport" id="panoViewport"><img class="pano-img" id="panoImg" src="' + esc(panos[idx].src) + '" style="width:200%;max-width:none;left:0" alt="" /></div>' +
      '<div class="pano-btns">' +
      '<div class="pano-btn" id="panoSwitch"><img src="' + asset(MEDIA.more) + '" alt="" /><span>切换全景图</span></div>' +
      '<div class="pano-btn" id="panoView"><img src="' + asset(MEDIA.judge) + '" alt="" /><span>切换视角</span></div>' +
      '<div class="pano-btn" id="panoInfo"><img src="' + asset(MEDIA.text) + '" alt="" /><span>简介</span></div>' +
      '</div>';
    $('#panoView').addEventListener('click', () => {
      const img = $('#panoImg');
      const cur = parseFloat(img.style.left || 0);
      img.style.left = (cur === 0 ? -50 : 0) + '%';
    });
    $('#panoSwitch').addEventListener('click', () => {
      idx = (idx + 1) % panos.length;
      state.panoIndex = idx;
      $('#panoImg').src = panos[idx].src;
      $('#panoImg').style.left = '0%';
      $('.pano-hint', $('#panoBody')).textContent = panos[idx].name;
    });
    $('#panoInfo').addEventListener('click', () => {
      const m = panos[idx].info;
      openModal(m.title, m.content, [{ text: '关闭' }]);
    });
  }

  /* ---------- 启动 ---------- */
  function start() {
    navigate(location.hash || '#/map');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
