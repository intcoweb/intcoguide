/* 校验 iOS 方向权限流程改动：
   1) 从 app.js 里切出真实实现（不另写一份），在 vm 沙箱里模拟 iOS 跑状态机
   2) 核对 index.html / style.css / app.js 的关键字与版本号
   结果写入 .workbuddy/verify.log */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'verify.log');
const lines = [];
let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) { pass += 1; lines.push('  ok   ' + name); }
  else { fail += 1; lines.push('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

const appSrc = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');

/* ---------- 切出实现 ---------- */
function slice(startMark, endMark, label) {
  const a = appSrc.indexOf(startMark);
  if (a < 0) throw new Error('找不到起始标记：' + label);
  const b = appSrc.indexOf(endMark, a);
  if (b < 0) throw new Error('找不到结束标记：' + label);
  return appSrc.slice(a, b);
}
const sliceHint = slice('  const ORIENT_STORE_KEY', '  let guideRouteLayer', 'iOS 引导块');
const sliceCore = slice('  function normalizeHeading(value) {', '  /* 持续定位：只更新蓝点位置', '朝向核心');

/* ---------- 迷你 DOM ---------- */
function makeEl(name) {
  const classes = new Set();
  const listeners = {};
  return {
    name,
    style: {},
    _classes: classes,
    _listeners: listeners,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
    },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { if (listeners[t]) listeners[t] = listeners[t].filter((f) => f !== fn); },
    fire(t) { (listeners[t] || []).slice().forEach((fn) => fn({ type: t })); },
  };
}

function buildSandbox(opts) {
  const options = opts || {};
  const hintEl = makeEl('hint');
  const pageEl = makeEl('page-map');
  const btnEl = makeEl('orient-btn');
  const arrowEl = makeEl('arrow');
  const els = {
    '#mapOrientHint': hintEl,
    '#page-map': pageEl,
    '#mapOrientationBtn': btnEl,
    '.map-user-marker-icon .user-heading': arrowEl,
  };

  const store = {};
  if (options.storedGranted) store['glu.orientation.granted'] = '1';

  const timers = [];
  const deviceListeners = {};
  let requestCalls = 0;

  const win = {
    isSecureContext: true,
    screen: { orientation: { angle: 0, type: 'portrait-primary' } },
    orientation: 0,
    ondeviceorientation: null,
    ondeviceorientationabsolute: null,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    addEventListener(t, fn) { (deviceListeners[t] = deviceListeners[t] || []).push(fn); },
    removeEventListener(t, fn) { if (deviceListeners[t]) deviceListeners[t] = deviceListeners[t].filter((f) => f !== fn); },
  };
  function DeviceOrientationEvent() {}
  DeviceOrientationEvent.requestPermission = function () {
    requestCalls += 1;
    // iOS 的真实行为：没有页面手势且权限状态为 prompt 时 reject NotAllowedError
    if (options.allowAfterFirstCall && requestCalls > 1) return Promise.resolve('granted');
    if (options.denyAlways) return Promise.resolve('denied');
    if (options.needGesture && !sandbox.__gestureHappened) {
      const err = new Error('requires a user gesture to prompt');
      err.name = 'NotAllowedError';
      return Promise.reject(err);
    }
    return Promise.resolve('granted');
  };
  win.DeviceOrientationEvent = DeviceOrientationEvent;

  const sandbox = {
    window: win,
    document: {},
    navigator: {},
    console: { log() {}, warn() {}, error() {} },
    orientationDebug: () => {},
    orientationDebugWarn: () => {},
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    Promise,
    $: (sel) => els[sel] || null,
    $$: () => [],
    Number, Math, Date, JSON, Array, Object, String, Boolean, Error,
    __gestureHappened: false,
  };
  sandbox.globalThis = sandbox;

  const preamble = [
    'let mapOrientationAttached = false;',
    'let mapOrientationPermissionPromise = null;',
    'let mapOrientationPermissionDenied = false;',
    'let mapOrientationAbsoluteAt = 0;',
    'let mapCurrentHeading = null;',
    'let mapOrientationEventCount = 0;',
    'let mapOrientationLastLogAt = 0;',
    'let mapOrientationNoEventTimer = null;',
    'let mapOrientationArrowMissingLogged = false;',
    'let mapLocationUserRequested = false;',
  ].join('\n');

  const expose = [
    'globalThis.__expose = {',
    '  initOrientation, requestOrientationPermission, requestOrientationAfterLocation, armOrientationGesture,',
    '  flags: function () { return {',
    '    attached: mapOrientationAttached, denied: mapOrientationPermissionDenied,',
    '    needsGesture: mapOrientationNeedsGesture, armed: mapOrientationGestureArmed,',
    '    tries: mapOrientationGestureTries, pending: Boolean(mapOrientationPermissionPromise) }; },',
    '  setUserRequested: function (v) { mapLocationUserRequested = v; } };',
  ].join('\n');

  vm.createContext(sandbox);
  vm.runInContext(preamble + '\n' + sliceHint + '\n' + sliceCore + '\n' + expose, sandbox);

  return {
    sandbox,
    api: sandbox.__expose,
    hintEl, pageEl, btnEl, arrowEl,
    store, timers, deviceListeners,
    requestCalls: () => requestCalls,
    flushTimers() { const t = timers.splice(0); t.forEach((fn) => fn()); },
    gesture() { sandbox.__gestureHappened = true; pageEl.fire('touchend'); },
  };
}

const flushMicro = () => new Promise((r) => setImmediate(r));

(async function main() {
  lines.push('=== A. iOS 首次进入：不静默申请，改为「首触即申请」+ 引导条 ===');
  {
    const env = buildSandbox({ needGesture: true, storedGranted: false });
    env.api.initOrientation();
    await flushMicro();
    ok('首次进入没有静默调用 requestPermission', env.requestCalls() === 0, env.requestCalls());
    ok('引导条已出现（#mapOrientHint.on）', env.hintEl._classes.has('on'));
    ok('页面标记 orient-hint-on（底部按钮条让位）', env.pageEl._classes.has('orient-hint-on'));
    ok('「首触即申请」监听已挂上 page-map',
      (env.pageEl._listeners.touchend || []).length === 1 && (env.pageEl._listeners.click || []).length === 1);
    ok('此刻还没有绑定 deviceorientation',
      !(env.deviceListeners.deviceorientation || []).length);

    lines.push('');
    lines.push('=== B. 用户第一次触摸页面 → 完成申请并生效 ===');
    env.gesture();
    ok('触摸后先让一拍再申请（未同步弹窗）', env.requestCalls() === 0, env.requestCalls());
    env.flushTimers();
    await flushMicro();
    await flushMicro();
    ok('手势触发后调用了 requestPermission', env.requestCalls() === 1, env.requestCalls());
    ok('deviceorientation 监听已绑定', (env.deviceListeners.deviceorientation || []).length === 1);
    ok('deviceorientationabsolute 监听已绑定', (env.deviceListeners.deviceorientationabsolute || []).length === 1);
    ok('引导条已消失', !env.hintEl._classes.has('on') && !env.pageEl._classes.has('orient-hint-on'));
    ok('右侧按钮进入「已授权」态', env.btnEl._classes.has('granted'));
    ok('已写入本地授权记录', env.store['glu.orientation.granted'] === '1');
    ok('手势监听已摘除（只申请一次）',
      (env.pageEl._listeners.touchend || []).length === 0 && (env.pageEl._listeners.click || []).length === 0);
  }

  lines.push('');
  lines.push('=== C. 再次进入（本地有记录）：静默恢复，0 次点击 ===');
  {
    const env = buildSandbox({ needGesture: false, storedGranted: true });
    env.api.initOrientation();
    await flushMicro();
    await flushMicro();
    ok('进入页面即调用 requestPermission（无手势）', env.requestCalls() === 1, env.requestCalls());
    ok('deviceorientation 监听已绑定', (env.deviceListeners.deviceorientation || []).length === 1);
    ok('没有展示引导条', !env.hintEl._classes.has('on'));
    ok('没有挂「首触即申请」', (env.pageEl._listeners.touchend || []).length === 0);
  }

  lines.push('');
  lines.push('=== D. 恢复失败（记录在但系统已重置）→ 自动回落到手势流程 ===');
  {
    const env = buildSandbox({ needGesture: true, storedGranted: true });
    env.api.initOrientation();
    await flushMicro();
    await flushMicro();
    ok('静默申请被拒（NotAllowedError）', env.requestCalls() === 1, env.requestCalls());
    ok('没有被误判为「用户拒绝」', env.api.flags().denied === false, env.api.flags());
    ok('引导条补上，等待用户触摸', env.hintEl._classes.has('on'));
    ok('已挂上手势监听', (env.pageEl._listeners.touchend || []).length === 1);
  }

  lines.push('');
  lines.push('=== E. 无手势直接申请：NotAllowedError 不再把自己锁死 ===');
  {
    const env = buildSandbox({ needGesture: true, storedGranted: false });
    const r = await env.api.requestOrientationPermission();
    ok('返回 false（本次未拿到）', r === false, r);
    ok('denied 未被置位（可再次申请）', env.api.flags().denied === false, env.api.flags());
    ok('标记为「需要页面手势」', env.api.flags().needsGesture === true, env.api.flags());
    ok('监听未绑定', !(env.deviceListeners.deviceorientation || []).length);
  }

  lines.push('');
  lines.push('=== F. 用户明确选「不允许」→ 不再打扰 ===');
  {
    const env = buildSandbox({ denyAlways: true, allowAfterFirstCall: true });
    env.api.initOrientation();
    await flushMicro();
    env.gesture();
    env.flushTimers();
    await flushMicro();
    await flushMicro();
    ok('调用了一次 requestPermission', env.requestCalls() === 1, env.requestCalls());
    ok('被判定为拒绝', env.api.flags().denied === true, env.api.flags());
    ok('引导条不展示', !env.hintEl._classes.has('on') && !env.pageEl._classes.has('orient-hint-on'));
    ok('没有重新挂「首触即申请」', (env.pageEl._listeners.touchend || []).length === 0);
    const before = env.requestCalls();
    await env.api.requestOrientationPermission();
    ok('拒绝后不再重复调用 requestPermission', env.requestCalls() === before, env.requestCalls());
    const forced = await env.api.requestOrientationPermission(true);
    ok('右侧按钮 forceRetry 仍可手动重试', forced === true && env.requestCalls() === before + 1, env.requestCalls());
  }

  lines.push('');
  lines.push('=== G. 定位成功但非用户主动点击 → 仍不自动申请（行为不变） ===');
  {
    const env = buildSandbox({ needGesture: true, storedGranted: false });
    env.api.setUserRequested(false);
    env.api.requestOrientationAfterLocation('watchPosition');
    ok('未发起申请', env.requestCalls() === 0, env.requestCalls());
  }

  lines.push('');
  lines.push('=== H. 静态资源与关键字 ===');
  ok('index.html 含引导条元素', htmlSrc.indexOf('id="mapOrientHint"') > -1);
  ok('index.html 含引导文案', htmlSrc.indexOf('轻触屏幕，开启方向指引') > -1);
  ok('style.css 版本已升级', htmlSrc.indexOf('css/style.css?v=20260916-19') > -1);
  ok('app.js 版本已升级', htmlSrc.indexOf('js/app.js?v=20260916-26') > -1);
  ok('style.css 含引导条样式', cssSrc.indexOf('.map-orient-hint.on') > -1);
  ok('style.css 含底部让位规则', cssSrc.indexOf('.page-map.orient-hint-on .map-bottom') > -1);
  ok('app.js 区分 NotAllowedError', appSrc.indexOf("error.name === 'NotAllowedError'") > -1);
  ok('未再出现「请点击定位按钮」旧提示', appSrc.indexOf('请点击定位按钮') === -1);

  lines.push('');
  lines.push('--------------------------------------------------');
  lines.push('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  process.exitCode = fail ? 1 : 0;
})();
