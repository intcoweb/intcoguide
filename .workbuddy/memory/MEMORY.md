# 项目长期约定

## 素材与格式
- **用户给什么格式的图就用什么格式**，不要自作主张转 webp（2026-09-16 明确："直接换图片就行，不需要转化"）。需要转换时才用 `.workbuddy/png_to_webp.py`。
- 新增图片文件后必须确认 `server.js` 的 MIME 表含该扩展名（历史上 `.mp3`、`.webp` 都因缺 MIME 出过问题）。

## 分类名是「键」
- `AREA_GUIDES[分类名]`、`markerToneOf({name: 分类名})`、`renderSiteCategory()` 的 `icons[分类名]` 都按**分类名**取，改分类名必须全项目 grep 一并改。
- 只服务基地介绍页的分类在 data.js 上加 `"siteOnly": true`（自动被 `mapSiteData()` 与搜索池排除）。

## 编辑纪律
- 改同一个文件必须**逐条串行 Edit**，并行 Edit 会互相覆盖（lost update），改完回头 grep/实拉复核。
- 多行 JSON/大块删改写 node 脚本 + 断言，别手工 Edit。
- `index.html` 里 `?v=` 版本号改动前先重读。

## 本机工具
- 图像处理用 `C:\Python314\python.exe`（有 Pillow）；`binaries\python\envs\default` **没有 Pillow**。
- node 用 `C:\Users\INTCO\.workbuddy\binaries\node\versions\22.22.2-3\node.exe`。
- PowerShell 工具不回传 stdout：让脚本自己写结果文件，再用 Read 读；**不要用 `>` 重定向**（写成 UTF-16，Read 判为 binary）。

## 基地（厂区）索引只有一份：`state.campus`
- 2026-09-16 起统一：地图页顶部胶囊、基地介绍页 Hero 右上角、搜索页切换**共用** `state.campus`，任一处切换三处同步（旧的 `state.mapCampus` / `state.choose` 已全项目删除，grep 应为 0）。
- 显示名统一走 `campusLabel(campus)` = `base_name || name`；`site_data[].base_name` 是「英科医疗淮北基地 / 英科医疗青州基地」这类正式基地名。
- `state.appliedCampus` 记录"已经渲染到地图上的基地"，`onMapShow()` 按差异重载；地图不可见时不动地图（`display:none` 时 `invalidateSize()` 会量成 0）。
- 底部「青州地图」tab 已移除，但路由 `#/qingzhou-map` 保留（深链进来自动落到青州并高亮「地图」tab）。

## 地图页 overlay 是绝对定位竖排，加一层要整体让位
- 自上而下：`.map-base-bar`(top:10) → `.map-search-entry`(top:58) → `.map-control` 分类条(top:106) → `.map-modes`(top:158，有路线时) → `.map-right-tools`(top:254)。
- **在地图顶部加/删一行，必须把这五个 top 一起调**（当前基准步长 46px = 基地名 34px + 间距），否则会互相叠压。

## 「全部」是地图页专有，排位要求要分页判断
- `全部` 是 `mapDisplayCategories()` 造的**虚拟分类**，只在**地图页**分类条出现；**基地介绍页没有「全部」**，它直接用 `category_list`。
- `siteOnly: true` 的分类**不进地图页**（`mapSiteData()` 过滤）。
- ⇒ 同一个分类在 `category_list` 里的名次，在两个页面看到的"相邻项"不同。用户说「排到某某后面」时，先判断该分类/参照项各自在哪个页面可见，再定 index（例：把「展厅」放 index 1，地图页就是「全部 > 展厅」，基地介绍页就是「配套基地 > 展厅」，一次满足两条要求）。

## 分类名的三张映射表（改名必查）
1. `AREA_GUIDES[分类名]`（弹窗 en/subtitle/hideSteps/hideVoice）
2. `renderSiteCategory()` 里的 `icons[分类名]`（左侧分类图标，缺省落 📍）
3. `markerToneOf()` 里的 `tones[分类名]`（地图标记配色，缺省落 main）
可用的 tone：main / nitrile / pvc / storage(橙) / eco / life。

## iOS Safari 权限（定位 / 方向）——两条铁律
1. **`DeviceOrientationEvent.requestPermission()` 必须由页面内的用户手势触发**（transient activation）。
   定位权限弹窗上的「允许」是**系统弹窗，不算页面手势**——所以「定位成功回调里自动申请朝向」在 iOS 上必然
   `NotAllowedError`。系统不提供权限状态查询，但**只有状态为 `granted` 时**才允许无手势静默调用成功，
   因此"已授权过 → 进入页面静默恢复、0 点击"是可行的。
2. **`NotAllowedError`（缺手势）≠ `denied`（用户拒绝）**，必须分开处理：
   前者**不能**置 `mapOrientationPermissionDenied`，否则自己被锁死，之后所有非 forceRetry 的申请全被拦掉。
   `denied` 才隐藏引导条不再打扰，手动入口 `#mapOrientationBtn` 走 `forceRetry=true` 可重试。

配套：`localStorage['glu.orientation.granted']` 记授权；首次进入用 `armOrientationGesture()`
在 `#page-map` 上挂一次性 `touchend`/`click`（capture）+ 底部引导条 `#mapOrientHint`；
手势回调里延迟 240ms 再申请（避免与这次点击自己的弹窗叠在一起，transient activation 有数秒有效期）。

## 图标一律内联 SVG，别用外链
- `data.js` 的 `media.*` 里混着**外链图标**（如 `searchIcon = https://ico.dongtiyan.com/tu-99.png`），
  外网不通就是破图；而且 `MEDIA.x` 为空时老代码还渲染成 `<img src="">`，同样是破图。
- 页面上要新加图标时**直接写内联 SVG**（`fill="none" stroke="currentColor"`，颜色跟主题变量走）。
  搜索页的 `SEARCH_SVG` 就是这样一套（search / clock / trash / empty / arrow）。

## 搜索页（`#/search`）
- **点结果整行 = `openGuideDialog(site, catName)`**，与地图页点标记完全同一个弹窗；
  行内**「定位」按钮** = 以该点位为中心回地图讲解页（2026-09-17 由「起点/终点」改成）。
- **定位链路**：`focusSearchPoint()` 记 `state.focusPoint = {lat,lng,name,category}` → `#/map` →
  **`onMapShow()` 末尾**的 `applyPendingFocus()` 落地（`invalidateSize()` → `setView(..., FOCUS_ZOOM=18)` → toast）。
  必须放末尾：回地图页可能先 `applyCampus()`→`renderCategoryMarkers()`→`fitMarkers()` 缩到整片点位，视角只能最后定。
  落地时置 `state.focusLock = now+3000`，`watchPosition` 首次居中那行要 `isFirst && Date.now() >= state.focusLock`，否则 GPS 首个 fix 会抢走视角。
- **`displayCategoryIndexFor(site, catName)` 必须 `continue` 掉 `cats[i].virtual`**：虚拟「全部」的池子里装着所有点位，
  不跳过就永远返回 0，切分类永不生效（地图上也就看不到那个标记）。合并分类按 `_catName` 匹配来源分类名。
- `catName` 必须取 `p._catName || cat.name` —— 合并出来的「生产车间」点位靠 `_catName` 记住来源分类，
  否则弹窗会退化成兜底配置（甚至丢掉语音按钮）。
- 页体是 `overflow-y:auto` + `.sub-nav` sticky + `.search-result` 留 `--tabbar-h` 的下边距，
  子页 `inset:0` 会盖到底部 tabbar 下面，不留边距最后几条点不到。
- **路线规划在 UI 上已不可达**：`#mapStartInput/#mapEndInput` 随首页模块删掉了 → `syncMapInputs()` 空转，
  `formSubmit()` 没有任何可见入口。`state.start` 现在只作为地图上的"当前/默认位置"标记用，别再按"起终点"理解。

## 配图有「实拍」和「插画」两套，`data.js` 的 `img` 指向哪套就生效
- 两套文件都留在 `assets/images/`，切换只改 `data.js` 一行 + 升 `data.js?v=`，**别删另一套**（用户会来回切）。
- 插画命名：`*-illus.png`（办公楼/污水/煤场/仓库/餐厅/公寓/展厅/烟气回收）、`*-entrance.png`（丁腈·PVC 车间门口）。
- 实拍原图：`exhibition.webp`（公寓）、`office.png`（办公室）、`showroom.webp`（展厅，餐厅曾借它占位）。
- **两个不能 `replace_all` 的名字**：`exhibition.webp` 还被 `app.js` 的 `DEFAULT_SITE_IMG` 兜底引用；
  `showroom.webp` 同时是展厅的图 → 改餐厅/公寓必须带上下文精确 Edit。
- 2026-09-17 末态：展厅·公寓·办公室·餐厅=实拍；丁腈/PVC 门口·污水·煤场·仓库·烟气回收=插画。

## ImageGen 出图流水线（本机固定套路）
1. 生成：`size 1536x1024`、`quality high`、`output_dir` 直接指 `assets/images`；
   插画风 prompt 固定前缀「3D卡通动画风格插画 / 扁平化3D插画 / 等距透视 / 无人物」。
   想要"按现有图改风格"时，**先 `Read` 原图看清构图**，把标志性物件逐条写进 prompt，出图才对得上。
2. 输出**固定带右下角水印**，用 Pillow 裁底部 **110px**（80px 会留残影），成品 1536×914。
3. 重命名/裁切/清理一律走 Python glob 按**中文关键词**匹配（别在 shell 里拼中文长文件名），脚本存 `.workbuddy/finalize_*.py`。
4. 接入：精确 Edit `data.js` 的 `img` 行 → 升 `index.html` 里 `data.js?v=`。
5. 校验：`.workbuddy/verify_img_refs.py`（`node --check` + 全部 `img` 引用落盘检查 + 回读版本号）；
   它的 MISS 里带 `?v=` 的地图路径和 http 外链是正常噪声。

## 定位 → 基地自动切换（30km 电子围栏）
- `CAMPUS_GEOFENCE_KM = 30`；`campusIndexNear(lat,lng)` 取最近基地中心，超 30km 返回 -1；
  `fallbackCampusIndex()` 兜底淮北（base_name/name 含「淮北」→ id===1 → index 0，别写死 0）。
- `resolveCampusByLocation(lat,lng,force)`：命中 → `switchCampus(idx)`；都没命中 → 切回淮北 + `focusDefaultGate()`
  （视角落 `state.mapDefaultPoint`，同时置 `state.focusLock` 防 watch 首次居中抢走）+ toast 提示。
- `state.campusResolved` 保证**只自动判一次** —— 否则 watchPosition 每次刷新都会把用户手动选的基地抢回去；
  用户点右侧定位按钮走 `force=true` 强制重判（那是"我现在在哪"的明确意图）。
- `locationNoticeShown` 模块级标记：围栏已提示过时，旧的「不在厂区内 / 已定位到当前位置」不再弹，避免两条 toast 打架。
- `locateAndCenter(lat,lng,center)` 的第三参数：兜底到大门口时传 `false`，只更新蓝点不居中（否则视角被用户点拉走）。
- 三个调用点：`locateMe()`（初始化定位）、`startLocationWatch()` 首帧、`#mapLocationBtn` 点击。`toGcj` 转换后再判距离。
- 验证脚本 `.workbuddy/verify_geofence.js`（从 app.js 切真实实现，26 条断言：距离/阈值边界/兜底/只判一次/force）。

## 无头浏览器核对移动端页面（本机可用）
`"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox
 --hide-scrollbars --window-size=390,844 --user-data-dir=<临时目录> --virtual-time-budget=9000
 --screenshot=<绝对路径.png> <url>`
- **坑：Chrome 无头窗口有最小宽度（实测 500px），`--window-size=390` 不生效**，截出来是 500 宽布局的左侧裁切。
  绕过办法：在页面 `<head>` 注入 `#app{position:fixed;left:0;top:0;width:390px!important;max-width:390px!important}`，
  截图就是真实 390px 移动布局。
- 要驱动页面（切路由 + 填输入框 + 点按钮）时，把 `index.html` 拷一份、在 `</body>` 前插一段 `load` 后 setTimeout 的脚本，
  再用 `--virtual-time-budget` 等它跑完。截图完记得删掉这份临时 html。
- **伪造定位必须用 `Object.defineProperty(navigator,'geolocation',{value:stub,configurable:true})`** ——
  `navigator.geolocation = stub` 是只读访问器，赋值会被静默忽略，看起来"没生效"其实是真实定位在跑。
- 判断"基地是否真的切了"，别只信地图底图（虚拟时间下瓦片可能还是旧的）：**用 `--dump-dom` 抓 DOM，
  看厂区示意覆盖层的 img 是 `huai-bei-intco-map` 还是 `qingzhou-intco-old-map`**，比截图可靠。

