const fs = require('fs');
const p = require('path');

const dir = 'C:/Users/INTCO/Desktop/桂校导航/web-guide/assets/images';
const targets = ['nitrile-plant.png', 'pvc-plant.png', 'sewage-plant.png', 'coal-yard.png', 'warehouse.png'];

const files = fs
  .readdirSync(dir)
  .filter((f) => /2026-09-17T05-4.*\.png$/.test(f))
  .map((f) => ({ f, t: fs.statSync(p.join(dir, f)).mtimeMs }))
  .sort((a, b) => a.t - b.t);

const lines = [];
lines.push('matched=' + files.length);
files.forEach((x, i) => {
  const to = targets[i];
  if (!to) return;
  fs.renameSync(p.join(dir, x.f), p.join(dir, to));
  lines.push(x.f + '\n    -> ' + to + '  exists=' + fs.existsSync(p.join(dir, to)));
});

fs.writeFileSync(p.join(dir, '_rename_result.txt'), lines.join('\n'), 'utf8');
