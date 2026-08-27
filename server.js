/* 桂院校园导航 · 网页复刻版
   本地静态服务器 + 代理接口
   - 将 /api/weather 代理到和风天气（解决跨域）
   - 将 /api/route 代理到腾讯位置服务方向 API（解决跨域与额度时降级）
   用法：node server.js  然后访问 http://localhost:8000
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const WEATHER_KEY = 'de1f89544449420cb217032e79b9527c';
const MAP_KEY = 'ZQWBZ-NQBLV-W7CPF-U7QIR-5HBNQ-AOFUE';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function getJson(url, cb) {
  https.get(url, (r) => {
    let s = '';
    r.on('data', (d) => (s += d));
    r.on('end', () => {
      try { cb(null, JSON.parse(s)); }
      catch (e) { cb(e); }
    });
  }).on('error', cb);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  if (p === '/api/weather') {
    const url = 'https://devapi.qweather.com/v7/weather/now?location=116.7235,33.87368&key=' + WEATHER_KEY;
    return getJson(url, (err, data) => {
      if (err) return json(res, 502, { error: 'weather proxy fail' });
      json(res, 200, data);
    });
  }

  if (p === '/api/route') {
    const mode = u.searchParams.get('mode') || 'walking';
    const from = u.searchParams.get('from') || '';
    const to = u.searchParams.get('to') || '';
    const url = 'https://apis.map.qq.com/ws/direction/v1/' + mode + '/?from=' + from + '&to=' + to + '&key=' + MAP_KEY;
    return getJson(url, (err, data) => {
      if (err) return json(res, 502, { error: 'route proxy fail' });
      json(res, 200, data);
    });
  }

  // 静态文件
  let filePath = path.normalize(path.join(ROOT, p === '/' ? 'index.html' : p));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404); return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => console.log('桂院校园导航网页版已启动: http://localhost:' + PORT));
