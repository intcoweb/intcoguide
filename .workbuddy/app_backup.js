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
    '环保设施': {
      en: 'ENVIRONMENT', subtitle: '绿色环保处理系统',
      steps: [
        { t: '集中收集', d: '生产废水经管网集中收集。' },
        { t: '净化处理', d: '通过沉淀、生化等工艺净化水质。' },
        { t: '循环利用', d: '达标后回用或合规排放，践行绿色生产。' }
      ]
    },
    '生活配套': {
      en: 'LIFE / AREA', subtitle: '员工生活服务区',
      steps: [
        { t: '住宿区域', d: '公寓为员工提供住宿服务。' },
        { t: '进出厂区', d: '从工厂大门进出并按要求登记。' },
        { t: '办公区域', d: '办公室提供日常行政与接待服务。' },
        { t: '门岗登记', d: '工厂门卫负责访客登记与进出管理。' }
      ]
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
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  $('#modalMask').addEventListener('click', (e) => { if (e.target === $('#modalMask')) hideModal(); });

  /* 图片预览（lightbox 风格弹窗） */
  function previewImage(url) {
    openModal('图片预览', '<div style="text-align:center"><img src="' + esc(url) + '" style="max-height:70vh" /></div>', [{ text: '关闭' }]);
  }

  /* ---------- 全局共享状态 ---------- */
  const state = {
    tab: 'home',
    sub: null,
    choose: 0,             // 园区索引
    campus_list: [],
    campus_name_list: [],
    start: { name: '', latitude: '', longitude: '' },
    end: { name: '', latitude: '', longitude: '' },
    mode: 'walking',
    mapCategory: 1,
    mapIsAtSchool: false,
    mapDefaultPoint: null,
    mapPoints: [],
    mapInited: false,
    mapCampus: 0,        // 地图页当前厂区（0=淮北 1=青州）
    appliedCampus: -1,   // 已经渲染到地图上的厂区
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
    siteCategory: 0,
    visitDay: 1,
  };

  /* ---------- 园区数据辅助 ---------- */
  function currentCampus() {
    return MAP.site_data[state.choose] || MAP.site_data[0];
  }
  /* 地图页当前厂区：由底部 tab（地图 / 青州地图）决定 */
  function mapCampusData() {
    return MAP.site_data[state.mapCampus] || MAP.site_data[0];
  }
  function mapSiteData() {
    return mapCampusData().category_list || [];
  }
  function currentSiteData() {
    return currentCampus().category_list || [];
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
    return null;
  }

  /* =========================================================
     路由
     ========================================================= */
  const TAB_ROUTES = ['map', 'qingzhou-map', 'site', 'visit-guide', 'home'];

  function setActiveTab(tab) {
    state.tab = tab;
    $$('.page').forEach((p) => p.classList.remove('active'));
    // 「地图」与「青州地图」共用同一个页面，只是厂区数据不同
    const pageId = (tab === 'qingzhou-map') ? 'map' : tab;
    const page = $('#page-' + pageId);
    if (page) page.classList.add('active');

    $$('.tab-item').forEach((t) => {
      const active = t.dataset.route === '#/' + tab;
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
    let h = hash || location.hash || '#/home';
    if (h.indexOf('#/') !== 0) h = '#/home';
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
      if (name === 'map') { state.mapCampus = 0; onMapShow(); }
      if (name === 'qingzhou-map') { state.mapCampus = 1; onMapShow(); }
      if (name === 'site') onSiteShow();
      if (name === 'visit-guide') onVisitGuideShow();
      if (name === 'home') onHomeShow();
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
      hideSub();
      setActiveTab('home');
      onHomeShow();
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
     首页
     ========================================================= */
  let homeRendered = false;
  function onHomeShow() {
    if (homeRendered) return;
    homeRendered = true;
    renderHome();
  }
  function renderHome() {
    const si = SCHOOL.school_information;
    const labelSpan = $('#homeLabel span');
    if (labelSpan) labelSpan.textContent = '厂区简介';
    $('#homeSchoolName').textContent = si.home_title || si.school_name_full;
    $('#homeEnglish').textContent = si.school_name_English_full || 'ANHUI INTCO MEDICAL';

    // 荣誉 / 上市标签
    $('#homeTags').innerHTML =
      '<span class="tag tag-accent">' + esc(si.honor) + '</span>' +
      '<span class="tag">股票代码 300677</span>';

    // 企业使命
    $('#homeMotto').innerHTML =
      '<span class="quote-label">基地简介</span>' +
      '<p class="quote-text">' + esc(si.home_intro || si.motto) + '</p>';

    // 数据速览
    $('#homeInfo').innerHTML =
      '<div class="quick-grid">' +
      '<div class="quick"><span class="quick-label">建立时间</span><strong>' + esc(si.build_time) + '</strong></div>' +
      '<div class="quick"><span class="quick-label">企业类型</span><strong>' + esc(si.school_type) + '</strong></div>' +
      '<div class="quick"><span class="quick-label">业务领域</span><strong>' + esc(si.institution_type) + '</strong></div>' +
      '<div class="quick"><span class="quick-label">所在地</span><strong>安徽 · 淮北</strong></div>' +
      '</div>' +
      '<div class="quick-addr"><img src="' + asset(MEDIA.little_location) + '" alt="" /><span>' + esc(si.location) + '</span></div>';

    // 欢迎条
    $('#homeBanner').innerHTML =
      '<img class="banner-ic" src="' + asset(MEDIA.laba) + '" alt="" /><span>欢迎使用' + esc(MINI_NAME) + '小程序</span>';

    // 常用功能
    const funcConf = [
      { icon: '🧭', label: '地图导航', sub: '厂区路径 · 规划路线', grad: 'orange', act: () => { location.hash = '#/map'; } },
      { icon: '🏭', label: '厂区地图', sub: '全厂点位 · 一键找点', grad: 'teal', act: () => { location.hash = '#/site'; } },
      { icon: '🌐', label: '英文官网', sub: 'INTCO Medical · Global', grad: 'blue', act: () => openLink('https://www.intcomedical.com') },
      { icon: '🌏', label: '中文官网', sub: '英科医疗 · 官网', grad: 'green', act: () => openLink('https://www.intcomedical.com.cn') },
    ];
    $('#homeFunctions').innerHTML = funcConf.map((f, i) =>
      '<button class="func-card grad-' + f.grad + '" data-i="' + i + '">' +
      '<span class="func-card-icon">' + f.icon + '</span>' +
      '<span class="func-card-label">' + esc(f.label) + '</span>' +
      '<span class="func-card-sub">' + esc(f.sub) + '</span>' +
      '</button>').join('');
    $$('#homeFunctions .func-card').forEach((btn) => {
      const idx = Number(btn.dataset.i);
      btn.addEventListener('click', () => funcConf[idx] && funcConf[idx].act());
    });

    // 厂区简介跳转
    $('#homeLabel').addEventListener('click', () => { location.hash = '#/introduction'; });

    // 页脚
    $('#homeFooter').textContent = MINI_NAME + ' · 智慧厂区服务';

    // 获取天气
    fetchWeather();
  }

  /* ---- 打开外部官网 ---- */
  function openLink(url) {
    const win = window.open(url, '_blank', 'noopener');
    if (!win) location.href = url;
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

  /* ---- 天气 ---- */
  async function fetchWeather() {
    const loc = parseFloat(MAP.longitude).toFixed(2) + ',' + parseFloat(MAP.latitude).toFixed(2);
    try {
      const res = await fetch('https://devapi.qweather.com/v7/weather/now?location=' + loc + '&key=' + DATA.weatherKey);
      const j = await res.json();
      if (j && j.now) { renderWeather(j.now); return; }
      throw new Error('bad');
    } catch (e) {
      try {
        const r2 = await fetch('/api/weather');
        const j2 = await r2.json();
        if (j2 && j2.now) { renderWeather(j2.now); return; }
      } catch (e2) {}
      renderWeather(null);
    }
  }
  function renderWeather(now) {
    const si = SCHOOL.school_information;
    const card = $('#weatherCard');
    const hasWeather = Boolean(now);
    const icon = hasWeather ? 'https://icons.qweather.com/assets/icons/' + now.icon + '.svg' : '';
    const conditionIcon = hasWeather
      ? '<img class="icon" src="' + esc(icon) + '" alt="' + esc(now.text) + '" />'
      : '<div class="weather-empty-icon">—</div>';
    const wind = hasWeather ? esc(now.windDir) + ' ' + esc(now.windScale) + '级' : '--';
    const humidity = hasWeather ? esc(now.humidity) + '%' : '--';
    const pressure = hasWeather ? esc(now.pressure) + ' hPa' : '--';
    const feelsLike = hasWeather && now.feelsLike ? '体感 ' + esc(now.feelsLike) + '°C' : (hasWeather ? '实时观测' : '稍后自动重试');
    card.innerHTML =
      '<div class="weather-card-content">' +
      '<div class="weather-location"><span class="weather-label">当前厂区</span><strong>' + esc(si.location) + '</strong></div>' +
      '<div class="weather-summary">' +
      '<div class="weather-temp"><span>' + (hasWeather ? esc(now.temp) : '--') + '</span><sup>°C</sup></div>' +
      '<div class="weather-condition">' + conditionIcon + '<div class="weather-condition-copy"><strong>' + (hasWeather ? esc(now.text) : '天气暂不可用') + '</strong><span>' + feelsLike + '</span></div></div>' +
      '</div>' +
      '<div class="weather-info">' +
      '<div class="weather-metric"><span>风力</span><strong>' + wind + '</strong></div>' +
      '<div class="weather-metric"><span>湿度</span><strong>' + humidity + '</strong></div>' +
      '<div class="weather-metric"><span>气压</span><strong>' + pressure + '</strong></div>' +
      '</div>' +
      '</div>' +
      '<img class="weather-wave" src="' + asset(MEDIA.wave) + '" alt="" />';
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
      $('#siteCampusBtn').textContent = state.campus_name_list[state.choose];
    } else {
      $('#siteCampusWrap').style.display = 'none';
    }
  }
  function initSite() {
    state.campus_list = MAP.site_data.map((s) => ({ id: s.id, name: s.name }));
    state.campus_name_list = MAP.site_data.map((s) => s.name);
    updateSiteCampusBtn();
    $('#siteCampusBtn').addEventListener('click', () => showCampusPicker((i) => {
      state.choose = i;
      state.siteCategory = 0;
      updateSiteCampusBtn();
      renderSiteCategory();
    }));
    renderSiteCategory();
  }
  function renderSiteCategory() {
    const data = currentSiteData();
    const cat = data[state.siteCategory] || data[0];
    if (!cat) return;
    const icons = { '丁腈车间': '🏭', 'PVC车间': '🧤', '环保设施': '♻️', '生活配套': '🍽️' };
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
      return '<button class="site-card" data-i="' + i + '">' +
        '<span class="site-card-media"><img class="site-card-img" src="' + esc(p.img) + '" alt="" style="object-position:' + pos + '" loading="lazy" />' +
        '<span class="site-card-num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="site-card-type">' + esc(cat.name) + '</span></span>' +
        '<span class="site-card-body"><strong class="site-card-name">' + esc(p.name) + '</strong>' +
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
  function showCampusPicker(onPick) {
    const body = state.campus_name_list.map((n, i) =>
      '<div class="picker-opt' + (i === state.choose ? ' on' : '') + '" data-i="' + i + '" style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;font-size:16px;display:flex;justify-content:space-between">' + esc(n) + (i === state.choose ? ' <span style="color:var(--menu)">✓</span>' : '') + '</div>').join('');
    openModal('切换园区', body, [{ text: '取消' }]);
    $$('.picker-opt', $('#modalBody')).forEach((el) => el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      hideModal();
      if (i !== state.choose) onPick && onPick(i);
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

  function locateAndCenter(lat, lng) {
    updateUserMarker([lat, lng], true);
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
      mapOrientationPermissionDenied = true;
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
    orientationDebug('当前环境需要用户手势后请求设备朝向权限；请点击定位按钮');
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
      updateUserMarker([lat, lng], isFirst); // 仅首次定位成功时居中一次
      if (isFirst) toast('已定位到当前位置', 1200);
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
      return;
    }
    // 地图 / 青州地图 共用同一套实现：只有真正换了厂区才重载数据，
    // 同一个 tab 来回切（如从搜索页返回）保留已选起终点。
    if (state.mapCampus !== state.appliedCampus) {
      applyCampus();
      renderGuideRoute(mapCampusData());
    }
    if (map) map.invalidateSize();
    syncMapInputs();
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

    $('#mapCampusBtn').addEventListener('click', () => showCampusPicker((i) => switchCampus(i)));
    $('#mapSearchBtn').addEventListener('click', () => {
      const input = $('#mapSearchInput');
      const content = input ? input.value.trim() : '';
      if (!content) {
        toast('请输入要搜索的地点');
        if (input) input.focus();
        return;
      }
      state.choose = state.mapCampus;
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
        toast(granted ? '朝向权限已允许' : '未获得朝向权限，请查看浏览器设置', 1800);
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
            locateAndCenter(lat, lng);
            toast('已定位到当前位置', 1200);
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
    $('#mapLayerToggle').addEventListener('click', (e) => {
      state.showMapImg = !state.showMapImg;
      e.currentTarget.textContent = state.showMapImg ? '真实地图' : '示意图';
      renderCampusOverlay();
    });
    $('#mapLayerToggle').textContent = state.showMapImg ? '真实地图' : '示意图';
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

  function applyCampus() {
    const campus = mapCampusData();
    state.mapPoints = campus.range || [];
    state.mapDefaultPoint = defaultPointOf(campus);
    // 切厂区时重置起终点，避免残留上一个厂区的点位
    const def = state.mapDefaultPoint;
    state.start = (def && def.latitude)
      ? { name: def.name, latitude: def.latitude, longitude: def.longitude }
      : { name: '', latitude: '', longitude: '' };
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
    state.appliedCampus = state.mapCampus;
    if (map) {
      map.setView([campus.latitude, campus.longitude], MAP.scale || 16);
    }
  }

  function renderCampusControl() {
    // 厂区由底部 tab（地图 / 青州地图）决定，地图页内不再重复放切换按钮
    $('#mapCampusWrap').style.display = 'none';
    $('#mapCampusBtn').textContent = mapCampusData().name || '';
    const cats = mapSiteData();
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
    const cat = mapSiteData()[state.mapCategory];
    if (!cat) return;
    const tone = markerToneOf(cat);

    let markers = [];
    const loc = (state.start && state.start.latitude) ? state.start : null;
    // 默认位置是工厂大门时使用门楼图标，真实当前位置仍使用人物定位图标
    if (loc && loc.name !== '当前位置') {
      const isGate = loc.name === '工厂大门';
      markers.push(formMarker(loc, isGate ? 'site' : 'location', -1, isGate ? 'life' : undefined, isGate ? '生活配套' : undefined));
    }
    cat.list.forEach((site, i) => {
      const isCurrent = loc && Math.abs(Number(site.latitude) - Number(loc.latitude)) < 0.000001 && Math.abs(Number(site.longitude) - Number(loc.longitude)) < 0.000001;
      if (!isCurrent) markers.push(formMarker(site, 'site', i + 1, tone, cat.name));
    });
    fitMarkers(markers);
  }

  function markerToneOf(category) {
    const tones = { '丁腈车间': 'nitrile', 'PVC车间': 'pvc', '环保设施': 'eco', '生活配套': 'life' };
    return tones[category.name] || 'main';
  }

  function formMarker(site, type, id, tone, categoryName) {
    const label = type === 'location' ? (site.name || '当前位置') : site.name;
    const toneClass = type === 'site' && tone ? ' tone-' + tone : '';
    const gateClass = type === 'site' && site.name === '工厂大门' ? ' gate' : '';
    const icon = L.divIcon({
      className: '',
      html: '<div class="campus-marker' + toneClass + gateClass + (type === 'location' ? ' start' : '') + '"><div class="marker-pin">' + (type === 'location' ? '<span class="marker-person"></span>' : (gateClass ? '<span class="gate-symbol"><i></i></span>' : '')) + '</div><div class="marker-label">' + esc(label) + '</div></div>',
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

  function speakSite(site, button, overrideText) {
    const IDLE_HTML = '<span class="voice-play">▶</span><span class="voice-label">开始讲解</span><span class="voice-en">VOICE GUIDE</span>';
    const PLAY_HTML = '<span class="voice-play">■</span><span class="voice-label">停止讲解</span><span class="voice-en">VOICE GUIDE</span>';
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      toast('当前浏览器暂不支持语音讲解');
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (button) {
        button.classList.remove('playing');
        button.innerHTML = IDLE_HTML;
      }
      return;
    }
    const text = overrideText || [site.name, site.aliases, site.desc].filter(Boolean).join('。');
    const utterance = new SpeechSynthesisUtterance(text || site.name);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    if (button) {
      button.classList.add('playing');
      button.innerHTML = PLAY_HTML;
    }
    const reset = () => {
      if (!button) return;
      button.classList.remove('playing');
      button.innerHTML = IDLE_HTML;
    };
    utterance.onend = reset;
    utterance.onerror = reset;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function openGuideDialog(site, categoryName) {
    if (!site) return;
    const guide = AREA_GUIDES[categoryName] || AREA_GUIDES['生活配套'];
    const stepsHtml = (guide.steps || []).map((s, i) =>
      '<div class="explain-step"><span class="step-num">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<strong class="step-title">' + esc(s.t) + '</strong></div>'
    ).join('<span class="step-arrow">→</span>');

    $('#modalTitle').textContent = '';
    $('#modalBox').classList.add('explain-mode');
    $('#modalBody').innerHTML =
      '<button class="explain-close" id="explainClose" type="button">×</button>' +
      '<div class="explain-hero">' +
      '<img class="explain-bg" src="' + esc(site.img) + '" alt="" />' +
      '<div class="explain-overlay"></div>' +
      '<div class="explain-head">' +
      '<span class="explain-kicker">' + esc(guide.en || 'AREA') + '</span>' +
      '<div class="explain-title">' + esc(site.name) + '</div>' +
      '<div class="explain-subtitle">' + esc(guide.subtitle || site.aliases || '') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="explain-content">' +
      '<p class="explain-desc">' + esc(site.desc || '暂无详细介绍') + '</p>' +
      '<div class="explain-process-head"><span>参观重点</span><span class="process-en">PROCESS</span></div>' +
      '<div class="explain-steps">' + stepsHtml + '</div>' +
      '<button class="voice-btn explain-voice" id="explainVoiceBtn" type="button">' +
      '<span class="voice-play">▶</span><span class="voice-label">开始讲解</span><span class="voice-en">VOICE GUIDE</span>' +
      '</button>' +
      '</div>';
    $('#modalFooter').innerHTML = '';
    $('#modalMask').classList.add('show');

    $('#explainClose').addEventListener('click', hideModal);
    const voiceBtn = $('#explainVoiceBtn');
    if (voiceBtn) {
      const guideText = [
        site.name,
        guide.subtitle,
        site.desc,
        '参观重点：' + (guide.steps || []).map((s, i) => (i + 1) + '. ' + s.t + '，' + s.d).join('；')
      ].filter(Boolean).join('。');
      voiceBtn.addEventListener('click', () => speakSite(site, voiceBtn, guideText));
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
          state.start = { name: def.name, latitude: def.latitude, longitude: def.longitude };
          syncMapInputs();
          toast('当前位置不在厂区内\n默认位置设为' + def.name, 2200);
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
          apply(c.latitude, c.longitude);
          requestOrientationAfterLocation('navigator.geolocation.getCurrentPosition（地图初始化）');
        },
        (err) => {
          state.mapIsAtSchool = false;
          const def = state.mapDefaultPoint;
          if (def) state.start = { name: def.name, latitude: def.latitude, longitude: def.longitude };
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
      if (def) state.start = { name: def.name, latitude: def.latitude, longitude: def.longitude };
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

  function switchCampus(i) {
    state.mapCampus = i;
    applyCampus();
    syncMapInputs();
    if (map) map.invalidateSize();
  }

  function syncMapInputs() {
    const startInput = $('#mapStartInput');
    const endInput = $('#mapEndInput');
    if (!startInput || !endInput) return;
    startInput.value = state.start.name || '当前地点/起点';
    endInput.value = state.end.name || '请选择终点';
    // 搜索页跟随当前地图 tab 的厂区
    startInput.onclick = () => { state.choose = state.mapCampus; state.searchTarget = 1; location.hash = '#/search?id=1'; };
    endInput.onclick = () => { state.choose = state.mapCampus; state.searchTarget = 0; location.hash = '#/search?id=0'; };
  }

  /* =========================================================
     搜索页
     ========================================================= */
  function renderSearch() {
    $('#searchRoot').innerHTML =
      (MAP.site_data.length > 1 ? '<button class="picker" id="searchCampusBtn">' + esc(state.campus_name_list[state.choose] || currentCampus().name) + '</button>' : '') +
      '<input class="search-input" id="searchInput" placeholder="请输入要搜索的地点" style="flex:1 1 0;min-width:0;width:0" />' +
      '<button class="search-go" id="searchGo" style="flex:0 0 auto;white-space:nowrap">搜索</button>';

    const cb = $('#searchCampusBtn');
    if (cb) cb.addEventListener('click', () => showCampusPicker((i) => { state.choose = i; renderSearch(); }));

    $('#searchGo').addEventListener('click', goSearch);
    const inp = $('#searchInput');
    inp.value = state.searchContent || '';
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') goSearch(); });
    inp.addEventListener('input', () => { state.searchContent = inp.value; });

    renderSearchHistory();
    $('#searchResult').innerHTML = '';
  }

  function renderSearchHistory() {
    const hist = getHistory();
    const box = $('#searchHistory');
    if (!hist.length) {
      box.innerHTML = '<div class="headline"><img src="' + asset(MEDIA.history) + '" alt="" /><span class="title">搜索历史</span></div><div class="no-content">搜索历史为空</div>';
      return;
    }
    box.innerHTML =
      '<div class="headline"><img src="' + asset(MEDIA.history) + '" alt="" /><span class="title">搜索历史</span><img src="' + asset(MEDIA.delete) + '" id="clearHist" alt="清除" style="cursor:pointer" /></div>' +
      '<div class="search-chunks">' + hist.map((h) => '<span class="search-chunk" data-q="' + esc(h) + '">' + esc(h) + '</span>').join('') + '</div>';
    $('#clearHist').addEventListener('click', clearHistory);
    $$('.search-chunk', box).forEach((c) => c.addEventListener('click', () => {
      $('#searchInput').value = c.dataset.q;
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
  }

  function goSearch() {
    const content = ($('#searchInput').value || '').trim();
    state.searchContent = content;
    const site_data = currentSiteData();
    const result = [];
    if (content) {
      saveHistory(content);
      const keyword = content.toLowerCase();
      for (const cat of site_data) {
        for (const p of cat.list) {
          const name = p.name ? String(p.name).toLowerCase() : '';
          const aliases = p.aliases ? String(p.aliases).toLowerCase() : '';
          if (name.includes(keyword) || aliases.includes(keyword)) result.push(p);
        }
      }
      renderSearchResult(result);
      if (!result.length) toast('未找到结果');
    } else {
      toast('请输入内容');
    }
  }

  function renderSearchResult(result) {
    const box = $('#searchResult');
    let html = '<div class="headline"><img src="' + (MEDIA.searchIcon ? asset(MEDIA.searchIcon) : '') + '" alt="" /><span>搜索结果</span></div>';
    if (result.length) {
      html += result.map((p) => '<div class="result-item"><div class="name">' + esc(p.name) + '</div><div class="alias">' + esc(p.aliases || '') + '</div></div>').join('');
      box.innerHTML = html;
      $$('.result-item', box).forEach((el, i) => el.addEventListener('click', () => {
        const p = result[i];
        if (state.searchTarget === 1) state.start = { name: p.name, latitude: p.latitude, longitude: p.longitude };
        else state.end = { name: p.name, latitude: p.latitude, longitude: p.longitude };
        hideSub();
        // 从「青州地图」发起的搜索，选完点后回到「青州地图」
        location.hash = state.tab === 'qingzhou-map' ? '#/qingzhou-map' : '#/map';
        syncMapInputs();
      }));
    } else {
      box.innerHTML = html + '<div class="result-empty">抱歉，没有找到您想找的地点</div>';
    }
  }

  /* =========================================================
     使用说明 / 简介 / 全景 / 指南详情 / 声明
     ========================================================= */
  function renderInstruction(name) {
    $('#instructionBody').innerHTML =
      '<div class="instruction-card"><div class="instruction-h"><img src="' + asset(MEDIA.map) + '" alt="" /><span>使用说明</span></div>' +
      '<div class="instruction-txt">&emsp;&emsp;“基地介绍”页展示了各地点类型的地点，可切换地点类型查看。点击可以查看地点介绍，设置为起点或终点并跳转到地图。</div>' +
      '<button class="instruction-btn" id="instrSite">去“基地介绍”页</button>' +
      '<div class="instruction-txt">&emsp;&emsp;“地图”页展示了厂区地图，可以在地图上选择地点或者搜索地点进行导航。</div>' +
      '<div class="instruction-row top"><div class="k">定位</div><div class="v">点击定位图标可以重新定位<br/>若不在厂区，设置 ' + esc(name || '默认地点') + ' 为起点</div></div>' +
      '<div class="instruction-row"><div class="k">搜索</div><div class="v">点击顶部“搜索地点”查找厂区地点</div></div>' +
      '<div class="instruction-row"><div class="k">点击</div><div class="v">地点类型栏可以滑动点击<br/>点击地点可查看信息，并设为起点/终点<br/>点击底部可查看当前地点类型地点或路线信息</div></div>' +
      '<div class="instruction-txt" style="margin-top:14px">&emsp;&emsp;你学会了吗，快去试试吧！</div>' +
      '<button class="instruction-btn" id="instrMap">去“地图”页</button>' +
      '</div>';
    $('#instrSite').addEventListener('click', () => { hideSub(); location.hash = '#/site'; });
    $('#instrMap').addEventListener('click', () => { hideSub(); location.hash = '#/map'; });
  }

  function onVisitGuideShow() {
    renderVisitGuide(state.visitDay);
  }

  function renderVisitGuide(day) {
    const days = {
      1: {
        label: 'DAY 1 · 接站入住',
        hero: 'assets/images/itinerary/day1-hotel.jpg',
        heroSub: '抵达淮北 · 伯瑞特酒店入住',
        gallery: [
          { src: 'assets/images/itinerary/day1-lobby.png', title: '酒店大厅', text: '抵达酒店后完成签到，领取专属伴手礼。' },
          { src: 'assets/images/itinerary/day1-room.png', title: '酒店空间', text: '入住环境展示。' },
          { src: 'assets/images/itinerary/day1-buffet.png', title: '酒店空间', text: '接待环境展示。' },
          { src: 'assets/images/itinerary/day1-leisure.png', title: '酒店环境', text: '酒店环境展示。' },
        ],
        steps: [
          { time: '09:00 - 18:00', title: '专车接站', text: '覆盖淮北站、淮北北站、宿州东站、徐州东站四个高铁站及徐州观音机场，安排专人专车无缝衔接，直达酒店。' },
          { time: '全天', title: '签到入住', text: '伯瑞特酒店大堂签到，领取专属伴手礼，完成入住并调整状态。' },
        ],
      },
      2: {
        label: 'DAY 2 · 战略合作',
        hero: 'assets/images/itinerary/day2-conference.jpg',
        heroSub: '产业链参访 · 战略合作 · 答谢晚宴',
        gallery: [
          { src: 'assets/images/itinerary/day2-conference.jpg', title: '战略会议', text: '感恩同行，深化合作，共谋发展。' },
          { src: 'assets/images/itinerary/day2-lab-visit.jpg', title: '研发与制造', text: '了解产品研发与智能生产。' },
          { src: 'assets/images/itinerary/day2-factory.png', title: '产业链基地', text: '英科手套厂及上游配套企业参访。' },
          { src: 'assets/images/itinerary/day2-boat.jpg', title: '画舫游湖', text: '泛舟中湖，欣赏淮北秋日风光。' },
        ],
        steps: [
          { time: '09:00 - 11:30', title: '上游产业链探访', text: '国毅手模厂、英彩箱盒厂、凯泽乳胶厂，见证全产业链垂直一体化。' },
          { time: '11:30 - 13:00', title: '工厂参观 + 午餐', text: '探访全球最大单体手套厂全自动产线，安排商务午餐。' },
          { time: '13:00 - 16:00', title: '战略会议', text: '展示企业实力与新品，颁发战略合作奖项。' },
          { time: '16:30 - 18:30', title: '掼蛋 / 画舫游湖', text: '趣味掼蛋友谊赛，乘画舫游中湖观日落。' },
          { time: '18:30 - 21:00', title: '答谢晚宴', text: '互动游戏、幸运抽奖、演艺节目、特色徽菜，共杯共叙情谊。' },
        ],
        extraTitle: '产业链参访点位',
        extra: [
          { time: '11:30 - 12:00', title: '英科手套厂', text: '全球最大的单体一次性手套生产基地，深入 PVC 与丁腈手套智能生产车间，观摩自动化产线运作。' },
          { time: '12:00 - 12:30', title: '研发实验室', text: '选择性参观体验，了解产品研发与检测流程。' },
          { time: '12:00 - 13:00', title: '英科餐厅三楼', text: '分流用餐，享用午餐。' },
          { time: '13:00 - 13:30', title: '国毅手模厂', text: '走进高精度模具智造车间，了解模具设计、烤制与抛光全流程。' },
          { time: '13:30 - 14:00', title: '英彩箱盒厂', text: '参观智能化纸箱印刷与成型产线，了解包装设计、环保材料应用及配套物流体系。' },
          { time: '15:00 - 15:30', title: '凯泽乳胶厂', text: '深入丁腈胶乳核心原料生产基地，了解从原材料配方研发到规模化生产的全链条。' },
        ],
      },
      3: {
        label: 'DAY 3 · 景区游览',
        hero: 'assets/images/itinerary/day3-museum.jpg',
        heroSub: '工业文化参观 · 午餐 · 专车送站',
        gallery: [
          { src: 'assets/images/itinerary/day3-museum.jpg', title: '淮北工业博物馆', text: '感受地域人文风貌，了解百年工业历史。' },
          { src: 'assets/images/itinerary/day3-sunset.png', title: '淮北风光', text: '在轻松的城市风景中结束本次行程。' },
        ],
        steps: [
          { time: '09:00 - 12:00', title: '景区游玩', text: '游览代表性文旅景点——淮北工业博物馆，感受地域人文风貌，体会百年淮北市工业历史，增进伙伴间交流，留存美好记忆。' },
          { time: '12:00 - 18:00', title: '午餐与送站', text: '品尝地道美食后，根据返程航班或高铁车次，安排专车送抵机场或高铁站，满载收获与情谊结束行程。' },
        ],
        extraTitle: '淮北工业博物馆',
        extra: [
          { time: '位置', title: '淮北市区内', text: '距离酒店车程约 10 分钟，行程衔接高效。' },
          { time: '参观特点', title: '人文历史 + 科技互动', text: '室内参观，不受天气影响，淮北工业文化特色鲜明。' },
        ],
      },
    };
    const currentDay = days[day] || days[1];
    state.visitDay = Number(day) || 1;
    const dayTabLabels = { 1: '接站入住', 2: '战略合作', 3: '景区游览' };
    $('#visitGuideBody').innerHTML =
      '<div class="visit-guide-tabs" role="tablist" aria-label="行程日期">' + [1, 2, 3].map((item) =>
        '<button class="visit-guide-tab ' + (item === state.visitDay ? 'active' : '') + '" data-day="' + item + '" role="tab" aria-selected="' + (item === state.visitDay ? 'true' : 'false') + '"><span class="visit-guide-tab-day">DAY ' + item + '</span><small>' + dayTabLabels[item] + '</small></button>'
      ).join('') + '</div>' +
      '<div class="visit-guide-hero"><img src="' + esc(currentDay.hero) + '" alt="' + esc(currentDay.label) + '" /><div class="visit-guide-hero-overlay"></div><div class="visit-guide-hero-content"><div class="visit-guide-kicker">THREE-DAY ITINERARY</div><h1>' + esc(currentDay.label) + '</h1><p>' + esc(currentDay.heroSub) + '</p></div></div>' +
      '<div class="visit-guide-section-title">今日安排</div>' +
      '<div class="visit-guide-timeline">' + currentDay.steps.map((step) =>
        '<div class="visit-guide-step"><div class="visit-guide-time">' + esc(step.time) + '</div>' +
        '<div class="visit-guide-step-body"><div class="visit-guide-step-title">' + esc(step.title) + '</div><div class="visit-guide-step-text">' + esc(step.text) + '</div></div></div>'
      ).join('') + '</div>' +
      (state.visitDay === 1 ? '<section class="visit-guide-hotel"><div class="visit-guide-hotel-copy"><div class="visit-guide-kicker visit-guide-kicker-dark">BRIGHT HOTEL HUAI BEI</div><h2>淮北伯瑞特酒店</h2><div class="visit-guide-hotel-en">Bright Hotel Huaibei · 五星级豪华商务酒店</div>' +
      '<div class="visit-guide-info-title">基本信息</div><div class="visit-guide-info-grid"><div><span>地址</span><strong>淮北市相山区龙山路207号</strong></div><div><span>酒店风格</span><strong>欧式宫廷风格</strong></div></div>' +
      '</div>' +
      '<p class="visit-guide-hotel-desc">酒店坐落于东湖湿地公园畔，拥有得天独厚的临湖景观，将欧式宫廷建筑美学与自然生态完美融合。</p></section>' : '') +
      '<section class="visit-guide-gallery-section"><div class="visit-guide-info-title">行程亮点</div><div class="visit-guide-gallery">' + currentDay.gallery.map((item, index) =>
        '<figure class="visit-guide-gallery-card ' + (index === 0 ? 'featured' : '') + '"><img src="' + esc(item.src) + '" alt="' + esc(item.title) + '" /><figcaption><strong>' + esc(item.title) + '</strong><span>' + esc(item.text) + '</span></figcaption></figure>'
      ).join('') + '</div></section>' +
      (currentDay.extra ? '<section class="visit-guide-extra"><div class="visit-guide-info-title">' + esc(currentDay.extraTitle) + '</div><div class="visit-guide-extra-list">' + currentDay.extra.map((item) => '<div class="visit-guide-extra-item"><div class="visit-guide-extra-time">' + esc(item.time) + '</div><div><strong>' + esc(item.title) + '</strong><span>' + esc(item.text) + '</span></div></div>').join('') + '</div></section>' : '') +
      '<div class="visit-guide-note">具体时间以现场通知和实际交通安排为准。</div>';
    $$('.visit-guide-tab', $('#visitGuideBody')).forEach((button) => button.addEventListener('click', () => {
      renderVisitGuide(Number(button.dataset.day));
    }));
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
    navigate(location.hash || '#/home');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
