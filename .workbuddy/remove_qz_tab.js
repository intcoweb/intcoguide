const fs = require('fs');
const p = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/index.html';
let s = fs.readFileSync(p, 'utf8');
const oldStr = [
  '      <!-- 青州地图入口：与「地图」共用同一套实现，只切换厂区数据 -->',
  '      <a class="tab-item" data-route="#/qingzhou-map">',
  '        <img class="tab-icon" src="assets/images/tabbar/icon_map.png" data-alt="assets/images/tabbar/icon_map_HL.png" alt="青州地图" /><span>青州地图</span>',
  '      </a>',
  '',
].join('\r\n');
const newStr = '      <!-- 「青州地图」tab 已移除：基地切换改由地图页顶部胶囊 / 基地介绍页右上角承担 -->\r\n';
const n = s.split(oldStr).length - 1;
if (n !== 1) {
  fs.writeFileSync('C:/Users/INTCO/Desktop/桂校导航/web-guide/.workbuddy/apply2.log', 'FAIL 命中 ' + n + ' 次\n', 'utf8');
  process.exit(1);
}
s = s.split(oldStr).join(newStr);
fs.writeFileSync(p, s, 'utf8');
const tabCount = (s.match(/class="tab-item"/g) || []).length;
fs.writeFileSync('C:/Users/INTCO/Desktop/桂校导航/web-guide/.workbuddy/apply2.log',
  'OK 移除青州地图 tab x1\ntab-item 剩余=' + tabCount + '\nqingzhou-map 残留=' + ((s.match(/qingzhou-map/g) || []).length) + '\n', 'utf8');
