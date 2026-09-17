const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/';
const code = fs.readFileSync(ROOT + 'js/data.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const D = sandbox.window.GLU_DATA;
const out = [];
let total = 0;
const counter = {};
for (const site of D.map.site_data) {
  for (const cat of site.category_list) {
    for (const it of cat.list) {
      total++;
      counter[it.img] = (counter[it.img] || 0) + 1;
      if (it.name === '展厅' || it.name === '餐厅') {
        out.push(cat.name + ' / ' + it.name + ' -> ' + it.img + '  (' + it.latitude + ',' + it.longitude + ')');
      }
    }
  }
}
const head = ['点位总数: ' + total, '-- 展厅 / 餐厅 --'];
out.unshift(head[0]);
out.splice(1, 0, head[1]);
out.push('-- 图片引用统计 --');
Object.keys(counter).sort().forEach(k => out.push('  ' + counter[k] + ' x ' + k));
const missing = Object.keys(counter).filter(k => !fs.existsSync(ROOT + k));
out.push('缺失文件: ' + (missing.length ? missing.join(', ') : '无'));
fs.writeFileSync(ROOT + '.workbuddy/_verify.txt', out.join('\n'), 'utf8');
