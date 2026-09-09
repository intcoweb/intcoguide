(function () {
  'use strict';

  /* ---------- 全局数据 ---------- */
  const D = window.GLU_DATA;
  const MAP = D.map;
  const DATA = D.data;
  const SCHOOL = D.school;
  const MEDIA = D.media;
  const MINI_NAME = DATA.miniprogram_name;

  /* 青州地图模块（可整段删除） */
  const QINGZHOU_MAP_CONFIG = {
    center: [36.76472325, 118.38438492],
    zoom: 16,
    overlay: {
      image: 'assets/images/qingzhou-intco-old-map.svg?v=20260829-5',
      bounds: [[36.75901813, 118.3804614], [36.76873218, 118.3881691]],
    },
  };
  const QINGZHOU_GUIDE_ROUTE = [
    [36.767321, 118.384215],
    [36.766827, 118.384283],
    [36.766688, 118.382893],
    [36.765153, 118.382848],
    [36.765126, 118.385274],
    [36.764166, 118.385273],
    [36.764152, 118.383295],
    [36.764256, 118.383252],
    [36.764248, 118.382672],
    [36.765115, 118.382845],
    [36.766665, 118.382866],
    [36.766822, 118.384302],
  ];

  const AREA_GUIDES = {
    '主要地点': {
      en: 'MAIN / AREA', subtitle: '核心功能区域',
      steps: [
        { t: '登记进入', d: '经工厂大门核实登记后进入厂区。' },
        { t: '厂区导览', d: '沿主路参观办公楼与生产区域。' },
        { t: '前往目标', d: '根据导航前往目的车间或设施。' }
      ]
    },
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
    '仓储与配料': {
      en: 'STORAGE / AREA', subtitle: '仓储与动力保障',
      steps: [
        { t: '原料入库', d: '原料按品类分类存储并登记。' },
        { t: '按需配送', d: '按生产计划向车间配送物料。' },
        { t: '能源保障', d: '变电、锅炉与气体供应保障生产。' }
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
        { t: '用餐休息', d: '食堂与餐厅提供员工用餐休息。' },
        { t: '休闲运动', d: '篮球场与绿化区提供休闲空间。' },
        { t: '安全服务', d: '门卫室与卫生间提供保障服务。' }
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
    qingzhouMapInited: false,
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
    siteCategory: 0,
  };

  /* ---------- 园区数据辅助 ---------- */
  function currentCampus() {
    return MAP.site_data[state.choose] || MAP.site_data[0];
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
    if (!c.site_id) return null;
    const cat = cats.find((x) => x.id === c.site_id[0]);
    return (cat && cat.list && cat.list.find((x) => x.id === c.site_id[1])) || null;
  }

  /* =========================================================
     路由
     ========================================================= */
  const TAB_ROUTES = ['map', 'qingzhou-map', 'site', 'home'];

  function setActiveTab(tab) {
    state.tab = tab;
    $$('.page').forEach((p) => p.classList.remove('active'));
    const page = $('#page-' + tab);
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
      if (name === 'map') onMapShow();
      if (name === 'qingzhou-map') onQingzhouMapShow();
      if (name === 'site') onSiteShow();
      if (name === 'home') onHomeShow();
    } else if (name === 'search') {
      state.searchTarget = Number(query.id) || 0;
      showSub('search');
      renderSearch();
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
     地点汇总 Tab
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
    const icons = { '主要地点': '🏢', '丁腈车间': '🏭', 'PVC车间': '🧤', '仓储与配料': '📦', '环保设施': '♻️', '生活配套': '🍽️' };
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

  /* 青州地图模块（可整段删除） */
  let qingzhouMap = null;
  let qingzhouMapMarker = null;
  let qingzhouMapOverlay = null;
  let qingzhouMapRoute = null;
  let qingzhouMapRouteMarkers = [];
  let qingzhouMapRouteArrows = [];
  let qingzhouMapOverlayVisible = true;
  let qingzhouUserMarker = null;      // 用户当前位置 marker
  let qingzhouWatchId = null;         // watchPosition 句柄
  let qingzhouUserHeading = -1;       // 陀螺仪朝向（度，-1 表示未知）
  let qingzhouLocationWatching = false;
  let qingzhouCompassInited = false;

  function qingzhouRouteBearing(start, end) {
    const latitude = ((start[0] + end[0]) / 2) * Math.PI / 180;
    return Math.atan2((end[1] - start[1]) * Math.cos(latitude), end[0] - start[0]) * 180 / Math.PI;
  }

  function onQingzhouMapShow() {
    if (!state.qingzhouMapInited) {
      state.qingzhouMapInited = true;
      initQingzhouMap();
    } else if (qingzhouMap) {
      qingzhouMap.invalidateSize();
    }
  }

  /* 用户位置 marker（带朝向箭头） */
  function qingzhouUserIcon(heading) {
    // 箭头为 CSS 三角形，默认朝北（0°），直接按朝向角度旋转
    const deg = (typeof heading === 'number' && heading >= 0) ? heading : 0;
    return L.divIcon({
      className: 'qingzhou-user-marker-icon',
      html: '<div class="user-heading" style="--heading:' + deg + 'deg"></div><div class="user-dot"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  /* 浏览器定位 WGS-84 -> 地图 GCJ-02 */
  function qingzhouToGcj(lat, lng) {
    const g = wgs2gcj(lat, lng);
    return [g.lat, g.lng];
  }

  function updateQingzhouUserMarker(latLng, heading) {
    if (!qingzhouMap) return;
    if (!qingzhouUserMarker) {
      qingzhouUserMarker = L.marker(latLng, {
        icon: qingzhouUserIcon(heading),
        zIndexOffset: 500,
        interactive: false,
      }).addTo(qingzhouMap);
    } else {
      qingzhouUserMarker.setLatLng(latLng);
      qingzhouUserMarker.setIcon(qingzhouUserIcon(heading));
    }
  }

  function startQingzhouLocationWatch() {
    const options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 };
    const onSuccess = (pos) => {
      const [lat, lng] = qingzhouToGcj(pos.coords.latitude, pos.coords.longitude);
      updateQingzhouUserMarker([lat, lng], qingzhouUserHeading);
      qingzhouMap.setView([lat, lng], Math.max(qingzhouMap.getZoom(), 16));
    };
    const onError = (err) => {
      if (err && err.code === err.PERMISSION_DENIED) {
        toast('定位失败，请检查浏览器权限');
      } else {
        toast('定位失败，请到空旷处重试');
      }
    };
    qingzhouLocationWatching = true;
    qingzhouWatchId = navigator.geolocation.watchPosition(onSuccess, onError, options);
  }

  function stopQingzhouLocationWatch() {
    if (qingzhouWatchId !== null) {
      navigator.geolocation.clearWatch(qingzhouWatchId);
      qingzhouWatchId = null;
    }
    qingzhouLocationWatching = false;
    if (qingzhouUserMarker) {
      qingzhouMap.removeLayer(qingzhouUserMarker);
      qingzhouUserMarker = null;
    }
  }

  /* 陀螺仪方向（罗盘） */
  function updateQingzhouCompass(heading) {
    const arrow = $('#qingzhouCompassArrow');
    const deg = $('#qingzhouCompassDeg');
    if (arrow) arrow.style.transform = 'rotate(' + heading + 'deg)';
    if (deg) deg.textContent = Math.round(heading) + '°';
  }

  function onQingzhouOrientation(e) {
    // iOS Safari: webkitCompassHeading；Android/标准: deviceorientationabsolute
    let heading = -1;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      heading = e.webkitCompassHeading;
    } else if (typeof e.alpha === 'number' && e.absolute === true) {
      heading = e.alpha;
    }
    if (heading < 0 || heading > 360) return;
    qingzhouUserHeading = heading;
    updateQingzhouCompass(heading);
    if (qingzhouUserMarker) qingzhouUserMarker.setIcon(qingzhouUserIcon(heading));
  }

  function initQingzhouCompass() {
    if (qingzhouCompassInited) return;
    qingzhouCompassInited = true;
    if (window.DeviceOrientationEvent) {
      // iOS 13+ 需要用户手势触发才能获取方向数据
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        window.DeviceOrientationEvent.requestPermission()
          .then((res) => {
            if (res === 'granted') {
              window.addEventListener('deviceorientationabsolute', onQingzhouOrientation, true);
              window.addEventListener('deviceorientation', onQingzhouOrientation, true);
            }
          })
          .catch(() => {});
      } else {
        window.addEventListener('deviceorientationabsolute', onQingzhouOrientation, true);
        window.addEventListener('deviceorientation', onQingzhouOrientation, true);
      }
    } else {
      const arrow = $('#qingzhouCompassArrow');
      const deg = $('#qingzhouCompassDeg');
      if (arrow) arrow.style.opacity = '.35';
      if (deg) deg.textContent = '无';
    }
  }

  function initQingzhouMap() {
    qingzhouMap = L.map('qingzhouMap', { zoomControl: false, attributionControl: true });
    qingzhouMap.setView(QINGZHOU_MAP_CONFIG.center, QINGZHOU_MAP_CONFIG.zoom);
    L.control.zoom({ position: 'bottomleft' }).addTo(qingzhouMap);
    L.tileLayer('https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={y}&type=vector&styleid=0', {
      tms: true,
      subdomains: '0123',
      maxZoom: 20,
      minZoom: 3,
      attribution: '© 腾讯地图',
    }).addTo(qingzhouMap);

    qingzhouMapOverlay = L.imageOverlay(
      QINGZHOU_MAP_CONFIG.overlay.image,
      QINGZHOU_MAP_CONFIG.overlay.bounds,
      { opacity: 1, interactive: false }
    ).addTo(qingzhouMap);

    qingzhouMapRoute = L.polyline(QINGZHOU_GUIDE_ROUTE, {
      color: '#ef4444',
      weight: 4,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(qingzhouMap);
    qingzhouMapRouteArrows = QINGZHOU_GUIDE_ROUTE.slice(0, -1).map((point, index) => {
      const nextPoint = QINGZHOU_GUIDE_ROUTE[index + 1];
      const midpoint = [(point[0] + nextPoint[0]) / 2, (point[1] + nextPoint[1]) / 2];
      const angle = qingzhouRouteBearing(point, nextPoint) - 90;
      return L.marker(midpoint, {
        icon: L.divIcon({
          className: 'qingzhou-route-arrow-icon',
          html: '<span style="transform: rotate(' + angle + 'deg)">➤</span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        interactive: false,
      }).addTo(qingzhouMap);
    });
    qingzhouMapRouteMarkers = QINGZHOU_GUIDE_ROUTE.map((point, index) => L.circleMarker(point, {
      radius: index === 0 || index === QINGZHOU_GUIDE_ROUTE.length - 1 ? 5 : 2.5,
      color: '#fff',
      weight: 2,
      fillColor: '#ef4444',
      fillOpacity: 1,
      interactive: false,
    }).addTo(qingzhouMap));

    qingzhouMapMarker = L.marker(QINGZHOU_MAP_CONFIG.center).addTo(qingzhouMap);

    $('#qingzhouMapRestoreBtn').addEventListener('click', () => {
      qingzhouMap.setView(QINGZHOU_MAP_CONFIG.center, QINGZHOU_MAP_CONFIG.zoom);
    });
    $('#qingzhouMapLocationBtn').addEventListener('click', () => {
      if (!navigator.geolocation) {
        toast('当前浏览器不支持定位');
        return;
      }
      // 点击再次触发：停止监听并清除用户 marker
      if (qingzhouLocationWatching) {
        stopQingzhouLocationWatch();
        toast('已停止定位跟随');
        return;
      }
      startQingzhouLocationWatch();
    });
    $('#qingzhouMapLayerToggle').addEventListener('click', (e) => {
      qingzhouMapOverlayVisible = !qingzhouMapOverlayVisible;
      if (qingzhouMapOverlay) qingzhouMapOverlay.setOpacity(qingzhouMapOverlayVisible ? 1 : 0);
      e.currentTarget.textContent = qingzhouMapOverlayVisible ? '隐藏贴图' : '显示贴图';
    });
    $('#qingzhouMapExchangeBtn').addEventListener('click', () => {
      const input = $('#qingzhouMapEndInput');
      const value = input.value;
      input.value = value ? '当前位置' : '';
      input.placeholder = value ? '请选择终点' : '当前位置';
    });
    $('#qingzhouMapRouteBtn').addEventListener('click', () => {
      if (qingzhouMapRoute) qingzhouMap.fitBounds(qingzhouMapRoute.getBounds(), { padding: [40, 40] });
    });
    initQingzhouCompass();
    setTimeout(() => { if (qingzhouMap) qingzhouMap.invalidateSize(); }, 60);
  }

  function onMapShow() {
    if (!state.mapInited) {
      state.mapInited = true;
      initMap();
    } else {
      if (map) map.invalidateSize();
      syncMapInputs();
    }
  }

  function initMap() {
    state.campus_list = MAP.site_data.map((s) => ({ id: s.id, name: s.name }));
    state.campus_name_list = MAP.site_data.map((s) => s.name);
    state.mapDefaultPoint = defaultPointOf(MAP.site_data[state.choose]);

    map = L.map('leafletMap', { zoomControl: false, attributionControl: true });
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
    $('#mapExchangeBtn').addEventListener('click', exchange);
    $('#mapRouteBtn').addEventListener('click', formSubmit);
    $('#mapLocationBtn').addEventListener('click', locateMe);
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
    locateMe();
    syncMapInputs();
    setTimeout(() => { if (map) map.invalidateSize(); }, 60);
    setTimeout(() => { if (map) map.invalidateSize(); }, 350);
  }

  function applyCampus() {
    const campus = MAP.site_data[state.choose];
    state.mapPoints = campus.range || [];
    state.mapDefaultPoint = defaultPointOf(campus);
    state.mapCategory = 0;
    state.route.polyline = null;
    state.route.duration = 0;
    state.route.distance = 0;
    state.route.steps = [];
    clearRouteLayers();
    renderCampusControl();
    renderCampusOverlay();
    renderCategoryMarkers();
    if (map) {
      map.setView([campus.latitude, campus.longitude], MAP.scale || 16);
    }
  }

  function renderCampusControl() {
    $('#mapCampusWrap').style.display = MAP.site_data.length > 1 ? 'flex' : 'none';
    $('#mapCampusBtn').textContent = state.campus_name_list[state.choose];
    const cats = currentSiteData();
    $('#mapCategories').innerHTML = cats.map((c, i) =>
      '<div class="map-cat' + (i === state.mapCategory ? ' choose' : '') + '" data-i="' + i + '">' + esc(c.name) + '</div>').join('');
    $$('#mapCategories .map-cat').forEach((el) => el.addEventListener('click', () => changeCategory(Number(el.dataset.i))));
    $('#mapBottomBtn').classList.add('hidden');
    hideRouteUI();
  }

  function renderCampusOverlay() {
    const campus = currentCampus();
    if (groundOverlay) { map.removeLayer(groundOverlay); groundOverlay = null; }
    if (polygonLayer) { map.removeLayer(polygonLayer); polygonLayer = null; }
    // 默认叠加厂区示意图；右上角可切换真实底图和厂区边界。
    if (state.showMapImg && campus.isUseMapImg && campus.img && campus.bounds) {
      const b = campus.bounds;
      const token = ++overlayToken;
      const image = new Image();
      const addOverlay = (bounds) => {
        if (token !== overlayToken || !state.showMapImg) return;
        const overlay = L.imageOverlay(campus.img, bounds, { opacity: b.opacity || 0.8 }).addTo(map);
        const resetOverlay = overlay._reset.bind(overlay);
        overlay._reset = function () {
          resetOverlay();
          const element = this.getElement();
          if (!element) return;
          element.style.transformOrigin = '100% 100%';
          element.style.transform = element.style.transform.replace(/\s*rotate\([^)]*\)/g, '') + ' rotate(0deg)';
        };
        overlay._reset();
        groundOverlay = overlay;
      };
      image.onload = () => {
        const centerLatitude = (b.north + b.south) / 2;
        const imageScale = 0.54;
        const latitudeSpan = (b.north - b.south) * imageScale;
        const imageRatio = image.naturalWidth / image.naturalHeight;
        const longitudeSpan = latitudeSpan * imageRatio / Math.cos(centerLatitude * Math.PI / 180);
        const imageOffset = { latitude: 0.00022, longitude: 0.00038 };
        const adjustedCenterLatitude = centerLatitude + imageOffset.latitude;
        const centerLongitude = (b.east + b.west) / 2 + imageOffset.longitude;
        addOverlay([
          [adjustedCenterLatitude - latitudeSpan / 2, centerLongitude - longitudeSpan / 2],
          [adjustedCenterLatitude + latitudeSpan / 2, centerLongitude + longitudeSpan / 2],
        ]);
      };
      image.onerror = () => addOverlay([[b.south, b.west], [b.north, b.east]]);
      image.src = campus.img;
    } else if (campus.range && campus.range.length) {
      overlayToken += 1;
      polygonLayer = L.polygon(campus.range.map((p) => [p.latitude, p.longitude]), {
        color: '#789cff', weight: 2, fillColor: '#d5dff2', fillOpacity: 0.2,
      }).addTo(map);
    }
  }

  function renderCategoryMarkers() {
    if (!markerLayer) return;
    markerLayer.clearLayers();
    const cat = currentSiteData()[state.mapCategory];
    if (!cat) return;
    const tone = markerToneOf(cat);

    let markers = [];
    const loc = (state.start && state.start.latitude) ? state.start : null;
    if (loc) markers.push(formMarker(loc, 'location', -1));
    cat.list.forEach((site, i) => {
      const isCurrent = loc && Math.abs(Number(site.latitude) - Number(loc.latitude)) < 0.000001 && Math.abs(Number(site.longitude) - Number(loc.longitude)) < 0.000001;
      if (!isCurrent) markers.push(formMarker(site, 'site', i + 1, tone, cat.name));
    });
    fitMarkers(markers);
  }

  function markerToneOf(category) {
    const tones = {
      1: 'main',
      2: 'nitrile',
      3: 'pvc',
      4: 'storage',
      5: 'eco',
      6: 'life',
    };
    return tones[category.id] || 'main';
  }

  function formMarker(site, type, id, tone, categoryName) {
    const label = type === 'location' ? '当前位置' : site.name;
    const toneClass = type === 'site' && tone ? ' tone-' + tone : '';
    const icon = L.divIcon({
      className: '',
      html: '<div class="campus-marker' + toneClass + (type === 'location' ? ' start' : '') + '"><div class="marker-pin">' + (type === 'location' ? '<span class="marker-person"></span>' : '') + '</div><div class="marker-label">' + esc(label) + '</div></div>',
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
    const guide = AREA_GUIDES[categoryName] || AREA_GUIDES['主要地点'];
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
    const campus = currentCampus();
    const latlngs = (campus.range || []).map((p) => [p.latitude, p.longitude]);
    latlngs.push(...markers.map((m) => [m.site.latitude, m.site.longitude]));
    try {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.06), { paddingTopLeft: [24, 172], paddingBottomRight: [24, 72] });
    } catch (e) {}
  }

  function changeCategory(i) {
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
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = toMapCoords(pos.coords.latitude, pos.coords.longitude);
          apply(c.latitude, c.longitude);
        },
        () => {
          state.mapIsAtSchool = false;
          const def = state.mapDefaultPoint;
          if (def) state.start = { name: def.name, latitude: def.latitude, longitude: def.longitude };
          syncMapInputs();
          renderCategoryMarkers();
          toast('定位失败，默认位置设为' + (def ? def.name : '默认点'), 2000);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    } else {
      const def = state.mapDefaultPoint;
      if (def) state.start = { name: def.name, latitude: def.latitude, longitude: def.longitude };
      syncMapInputs();
      renderCategoryMarkers();
      toast('设备不支持定位，默认位置设为' + (def ? def.name : '默认点'), 2000);
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
    if (!state.end.name) { toast('请选择终点！'); return; }
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
    } else {
      renderCategoryMarkers();
    }
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
    state.choose = i;
    applyCampus();
    syncMapInputs();
    if (map) map.invalidateSize();
  }

  function syncMapInputs() {
    $('#mapStartInput').value = state.start.name || '当前地点/起点';
    $('#mapEndInput').value = state.end.name || '请选择终点';
    $('#mapStartInput').onclick = () => { state.searchTarget = 1; location.hash = '#/search?id=1'; };
    $('#mapEndInput').onclick = () => { state.searchTarget = 0; location.hash = '#/search?id=0'; };
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
      for (const cat of site_data) {
        for (const p of cat.list) {
          if ((p.name && p.name.match(content)) || (p.aliases && p.aliases.match(content))) result.push(p);
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
        location.hash = '#/map';
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
      '<div class="instruction-txt">&emsp;&emsp;“地点汇总”页展示了各地点类型的地点，可切换地点类型查看。点击可以查看地点介绍，设置为起点或终点并跳转到地图。</div>' +
      '<button class="instruction-btn" id="instrSite">去“地点汇总”页</button>' +
      '<div class="instruction-txt">&emsp;&emsp;“地图”页展示了厂区地图，可以在地图上选择地点或者搜索地点进行导航。</div>' +
      '<div class="instruction-row top"><div class="k">定位</div><div class="v">点击定位图标可以重新定位<br/>若不在厂区，设置 ' + esc(name || '默认地点') + ' 为起点</div></div>' +
      '<div class="instruction-row"><div class="k">搜索</div><div class="v">点击搜索栏起点 / 终点输入框<br/>即可跳转到对应搜索页</div></div>' +
      '<div class="instruction-row"><div class="k">点击</div><div class="v">地点类型栏可以滑动点击<br/>点击地点可查看信息，并设为起点/终点<br/>点击底部可查看当前地点类型地点或路线信息</div></div>' +
      '<div class="instruction-row"><div class="k">导航</div><div class="v">点击路线按钮即可进行导航<br/>点击切换图标即可对调起点和终点</div></div>' +
      '<div class="instruction-txt" style="margin-top:14px">&emsp;&emsp;你学会了吗，快去试试吧！</div>' +
      '<button class="instruction-btn" id="instrMap">去“地图”页</button>' +
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
    navigate(location.hash || '#/home');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
