const fs = require('fs');

const target = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/js/data.js';
const oldImg = '"img": "assets/images/exhibition.webp"';

const map = {
  '丁腈车间1': 'nitrile-plant.png',
  '丁腈车间2': 'nitrile-plant.png',
  '丁腈车间3': 'nitrile-plant.png',
  '丁腈车间4': 'nitrile-plant.png',
  '丁腈车间5': 'nitrile-plant.png',
  '丁腈车间6': 'nitrile-plant.png',
  'PVC车间1': 'pvc-plant.png',
  'PVC车间2': 'pvc-plant.png',
  'PVC车间3': 'pvc-plant.png',
  'PVC车间4': 'pvc-plant.png',
  '污水处理一期': 'sewage-plant.png',
  '污水处理二期': 'sewage-plant.png',
  '煤场一期': 'coal-yard.png',
  '煤场二期': 'coal-yard.png',
  '烟气回收设备': 'warehouse.png',
  '仓库': 'warehouse.png',
};

const lines = fs.readFileSync(target, 'utf8').split('\n');
let lastName = '';
const changed = [];
const skipped = [];

const out = lines.map((l) => {
  const m = l.match(/"name":\s*"([^"]+)"/);
  if (m) lastName = m[1];
  if (l.indexOf(oldImg) >= 0) {
    const to = map[lastName];
    if (to) {
      changed.push(lastName + ' -> ' + to);
      return l.replace('assets/images/exhibition.webp', 'assets/images/' + to);
    }
    skipped.push(lastName);
  }
  return l;
});

fs.writeFileSync(target, out.join('\n'), 'utf8');

const report =
  'changed=' + changed.length + '\n' +
  changed.join('\n') +
  '\n--- kept as exhibition.webp (' + skipped.length + ') ---\n' +
  skipped.join('\n');

fs.writeFileSync('C:/Users/INTCO/Desktop/桂校导航/web-guide/.workbuddy/img_result.txt', report, 'utf8');
