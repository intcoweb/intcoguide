/* 从 js/app.js 切出真实的「基地电子围栏」实现，在沙箱里跑断言。
   覆盖：最近基地判定、30km 阈值、兜底淮北+大门视角、只判一次、force 重判。 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

const start = src.indexOf('const CAMPUS_GEOFENCE_KM');
const end = src.indexOf('function locateMe()');
if (start < 0 || end < 0 || end <= start) {
  console.error('抽取失败：未能在 app.js 中定位围栏代码块');
  process.exit(1);
}
const code = src.slice(start, end);

const HUAIBEI = { id: 1, name: '安徽英科医疗', base_name: '英科医疗淮北基地', latitude: 33.87368, longitude: 116.7235 };
const QINGZHOU = { id: 2, name: '青州英科医疗', base_name: '英科医疗青州基地', latitude: 36.76472325, longitude: 118.38438492 };
const GATE = { name: '工厂大门', latitude: 33.8728310, longitude: 116.7269957 };

function makeEnv() {
  const state = {
    campus: 0,
    campusResolved: false,
    focusLock: 0,
    mapDefaultPoint: { ...GATE },
  };
  const env = { state, calls: [], toasts: [], views: [] };
  const MAP = { site_data: [{ ...HUAIBEI }, { ...QINGZHOU }] };
  const map = {
    setView(ll, zoom) { env.views.push({ ll, zoom }); },
  };
  const factory = new Function('state', 'MAP', 'switchCampus', 'toast', 'campusLabel', 'map', 'FOCUS_ZOOM',
    code + '\nreturn { haversineKm, campusIndexNear, fallbackCampusIndex, focusDefaultGate, resolveCampusByLocation, notice: () => locationNoticeShown, CAMPUS_GEOFENCE_KM };');
  return {
    env,
    api: factory(
      state,
      MAP,
      (i) => { env.calls.push(i); state.campus = i; state.mapDefaultPoint = (i === 0) ? { ...GATE } : { ...GATE, name: '青州大门' }; },
      (msg) => { env.toasts.push(String(msg)); },
      (c) => (c && (c.base_name || c.name)) || '',
      map,
      18
    ),
  };
}

let pass = 0; let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.log('  FAIL ' + name + (extra === undefined ? '' : '  -> ' + JSON.stringify(extra)));
}

/* A. 距离计算 */
{
  const { api } = makeEnv();
  const km = api.haversineKm(HUAIBEI.latitude, HUAIBEI.longitude, QINGZHOU.latitude, QINGZHOU.longitude);
  ok('淮北↔青州距离在 340~370km（实测约 355km）', km > 340 && km < 370, km);
  const near = api.haversineKm(33.87368, 116.7235, 33.87368 + 0.05, 116.7235);
  ok('0.05 纬度约 5.5km', Math.abs(near - 5.56) < 0.5, near);
}

/* B. 落在淮北 5km 内 */
{
  const { api, env } = makeEnv();
  ok('B1 命中淮北(index 0)', api.campusIndexNear(33.92, 116.7235) === 0);
  api.resolveCampusByLocation(33.92, 116.7235);
  ok('B2 已在淮北 → 不切基地', env.calls.length === 0, env.calls);
  ok('B3 不打扰：无提示', env.toasts.length === 0, env.toasts);
  ok('B4 判定标记已置位', env.state.campusResolved === true);
}

/* C. 落在青州附近（当前在淮北） */
{
  const { api, env } = makeEnv();
  ok('C1 命中青州(index 1)', api.campusIndexNear(36.80, 118.384) === 1);
  api.resolveCampusByLocation(36.80, 118.384);
  ok('C2 切到青州', env.calls.length === 1 && env.calls[0] === 1, env.calls);
  ok('C3 提示文案含基地名', env.toasts.length === 1 && env.toasts[0].indexOf('青州') >= 0, env.toasts);
  ok('C4 提示过就不再弹「已定位到当前位置」', api.notice() === true);
  ok('C5 没有把视角拉到大门口', env.views.length === 0, env.views);
}

/* D. 都不在（上海）→ 兜底淮北 + 大门视角 */
{
  const { api, env } = makeEnv();
  env.state.campus = 1;                       // 先假设用户在青州
  ok('D1 上海不命中任何基地', api.campusIndexNear(31.23, 121.47) === -1);
  api.resolveCampusByLocation(31.23, 121.47);
  ok('D2 兜底索引 = 淮北 0', api.fallbackCampusIndex() === 0);
  ok('D3 切回淮北', env.calls.length === 1 && env.calls[0] === 0, env.calls);
  ok('D4 提示 30 公里 + 工厂大门', env.toasts.length === 1
    && env.toasts[0].indexOf('30 公里') >= 0 && env.toasts[0].indexOf('工厂大门') >= 0, env.toasts);
  ok('D5 视角落到大门口坐标', env.views.length === 1
    && Math.abs(env.views[0].ll[0] - GATE.latitude) < 1e-9
    && Math.abs(env.views[0].ll[1] - GATE.longitude) < 1e-9, env.views);
  ok('D6 用 FOCUS_ZOOM=18', env.views.length === 1 && env.views[0].zoom === 18, env.views);
  ok('D7 上锁防 watch 抢视角', env.state.focusLock > Date.now(), env.state.focusLock);
}

/* E. 29.9km / 30.1km 边界 */
{
  const { api } = makeEnv();
  const latAt = (km) => HUAIBEI.latitude + (km / 111.32);
  ok('E1 29.9km 内命中', api.campusIndexNear(latAt(29.9), 116.7235) === 0);
  ok('E2 30.1km 外不命中', api.campusIndexNear(latAt(30.1), 116.7235) === -1);
}

/* F. 只判一次：用户手动切走后 watch 刷新不再抢回 */
{
  const { api, env } = makeEnv();
  api.resolveCampusByLocation(33.92, 116.7235);   // 首次：淮北，不切
  env.state.campus = 1;                            // 用户手动切到青州
  env.state.mapDefaultPoint = { ...GATE, name: '青州大门' };
  api.resolveCampusByLocation(33.92, 116.7235);   // watch 后续刷新（人在淮北）
  ok('F1 手动选择不被 watch 抢走', env.calls.length === 0, env.calls);
  ok('F2 也不重复提示', env.toasts.length === 0, env.toasts);
}

/* G. force（点侧边栏定位按钮）强制重判 */
{
  const { api, env } = makeEnv();
  api.resolveCampusByLocation(33.92, 116.7235);   // 首次
  env.state.campus = 1;                            // 用户切到青州
  api.resolveCampusByLocation(33.92, 116.7235, true); // 点定位：强制
  ok('G1 force 后切回淮北', env.calls.length === 1 && env.calls[0] === 0, env.calls);
  ok('G2 有切换提示', env.toasts.length === 1 && env.toasts[0].indexOf('淮北') >= 0, env.toasts);
}

/* H. 兜底基地识别：改名/换 id 也不至于找不到 */
{
  const { api } = makeEnv();
  ok('H1 当前数据兜底 = index 0', api.fallbackCampusIndex() === 0);
  ok('H2 阈值常量 = 30', api.CAMPUS_GEOFENCE_KM === 30);
}

console.log('断言通过 ' + pass + ' / ' + (pass + fail));
if (fail) { console.log('存在失败用例'); process.exit(1); }
