"""图标光栅化器 v2：numpy + PIL 自实现 SVG path 光栅化（本机 svglib/renderPM 后端不可用）。
支持 M/m L/l H/h V/v C/c S/s Q/q T/t A/a Z/z。用于在小尺寸下目视比对图标。"""
import io, os, re, math, urllib.request
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')
CMDS = set('MmLlHhVvCcSsQqTtAaZz')


def tokenize(d):
    out, i = [], 0
    while i < len(d):
        ch = d[i]
        if ch in CMDS:
            out.append(ch); i += 1
        elif ch in ' ,\t\r\n':
            i += 1
        else:
            m = NUM.match(d, i)
            if not m:
                i += 1; continue
            out.append(float(m.group())); i = m.end()
    return out


def arc_beziers(x0, y0, rx, ry, phi_deg, fA, fS, x1, y1):
    if x0 == x1 and y0 == y1:
        return []
    rx, ry = abs(rx), abs(ry)
    if rx == 0 or ry == 0:
        return [((x0, y0), (x1, y1), (x1, y1))]
    phi = math.radians(phi_deg)
    cp, sp = math.cos(phi), math.sin(phi)
    dx2, dy2 = (x0 - x1) / 2.0, (y0 - y1) / 2.0
    x1p, y1p = cp * dx2 + sp * dy2, -sp * dx2 + cp * dy2
    lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam); rx *= s; ry *= s
    sign = -1.0 if fA == fS else 1.0
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    co = sign * math.sqrt(max(0.0, num / den)) if den else 0.0
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x0 + x1) / 2.0
    cy = sp * cxp + cp * cyp + (y0 + y1) / 2.0

    def ang(ux, uy, vx, vy):
        dot = ux * vx + uy * vy
        n = math.hypot(ux, uy) * math.hypot(vx, vy)
        a = math.acos(max(-1.0, min(1.0, dot / n))) if n else 0.0
        return -a if (ux * vy - uy * vx) < 0 else a

    th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not fS and dth > 0:
        dth -= 2 * math.pi
    elif fS and dth < 0:
        dth += 2 * math.pi
    n = max(2, int(math.ceil(abs(dth) / (math.pi / 8))))
    segs = []
    for i in range(n):
        t0 = th1 + dth * i / n
        t1 = th1 + dth * (i + 1) / n
        k = 4.0 / 3.0 * math.tan((t1 - t0) / 4.0)
        p0 = (cx + rx * math.cos(t0) * cp - ry * math.sin(t0) * sp,
              cy + rx * math.cos(t0) * sp + ry * math.sin(t0) * cp)
        p1 = (cx + rx * math.cos(t1) * cp - ry * math.sin(t1) * sp,
              cy + rx * math.cos(t1) * sp + ry * math.sin(t1) * cp)
        d0 = (-rx * math.sin(t0) * cp - ry * math.cos(t0) * sp,
              -rx * math.sin(t0) * sp + ry * math.cos(t0) * cp)
        d1 = (-rx * math.sin(t1) * cp - ry * math.cos(t1) * sp,
              -rx * math.sin(t1) * sp + ry * math.cos(t1) * cp)
        segs.append(((p0[0] + k * d0[0], p0[1] + k * d0[1]),
                     (p1[0] - k * d1[0], p1[1] - k * d1[1]), p1))
    return segs


def parse_path(d):
    t = tokenize(d)
    i, cur, start, polys, poly = 0, (0.0, 0.0), (0.0, 0.0), [], []
    prev_c2 = prev_q = None
    cmd = None
    while i < len(t):
        if isinstance(t[i], str):
            cmd = t[i]; i += 1
            if cmd in 'Zz':
                if poly:
                    poly.append(start); polys.append(poly); poly = []
                cur = start
                continue
        rel = cmd.islower()
        c = cmd.upper()

        def take(n):
            nonlocal i
            vals = t[i:i + n]; i += n; return vals

        nxt_c2 = None
        nxt_q = None
        if c == 'M':
            x, y = take(2)
            if rel: x, y = cur[0] + x, cur[1] + y
            if poly: poly.append(start); polys.append(poly); poly = []
            cur = start = (x, y); poly = [cur]
            cmd = 'l' if rel else 'L'
        elif c == 'L':
            x, y = take(2)
            if rel: x, y = cur[0] + x, cur[1] + y
            cur = (x, y); poly.append(cur)
        elif c == 'H':
            (x,) = take(1)
            x = cur[0] + x if rel else x
            cur = (x, cur[1]); poly.append(cur)
        elif c == 'V':
            (y,) = take(1)
            y = cur[1] + y if rel else y
            cur = (cur[0], y); poly.append(cur)
        elif c in ('C', 'S'):
            if c == 'C':
                x1, y1, x2, y2, x, y = take(6)
                if rel:
                    x1, y1, x2, y2, x, y = (cur[0] + x1, cur[1] + y1, cur[0] + x2,
                                            cur[1] + y2, cur[0] + x, cur[1] + y)
            else:
                x2, y2, x, y = take(4)
                if rel:
                    x2, y2, x, y = cur[0] + x2, cur[1] + y2, cur[0] + x, cur[1] + y
                x1, y1 = (2 * cur[0] - prev_c2[0], 2 * cur[1] - prev_c2[1]) if prev_c2 else cur
            for k in range(1, 25):
                u = k / 24.0
                a = (1 - u) ** 3; b = 3 * (1 - u) ** 2 * u; cc = 3 * (1 - u) * u * u; dd = u ** 3
                poly.append((a * cur[0] + b * x1 + cc * x2 + dd * x,
                             a * cur[1] + b * y1 + cc * y2 + dd * y))
            nxt_c2 = (x2, y2); cur = (x, y)
        elif c in ('Q', 'T'):
            if c == 'Q':
                x1, y1, x, y = take(4)
                if rel:
                    x1, y1, x, y = cur[0] + x1, cur[1] + y1, cur[0] + x, cur[1] + y
            else:
                x, y = take(2)
                if rel: x, y = cur[0] + x, cur[1] + y
                x1, y1 = (2 * cur[0] - prev_q[0], 2 * cur[1] - prev_q[1]) if prev_q else cur
            for k in range(1, 25):
                u = k / 24.0
                a = (1 - u) ** 2; b = 2 * (1 - u) * u; cc = u * u
                poly.append((a * cur[0] + b * x1 + cc * x, a * cur[1] + b * y1 + cc * y))
            nxt_q = (x1, y1); cur = (x, y)
        elif c == 'A':
            rx, ry, rot, fA, fS, x, y = take(7)
            if rel: x, y = cur[0] + x, cur[1] + y
            for c1, c2, p in arc_beziers(cur[0], cur[1], rx, ry, rot, int(fA), int(fS), x, y):
                for k in range(1, 13):
                    u = k / 12.0
                    a = (1 - u) ** 3; b = 3 * (1 - u) ** 2 * u; cc = 3 * (1 - u) * u * u; dd = u ** 3
                    poly.append((a * cur[0] + b * c1[0] + cc * c2[0] + dd * p[0],
                                 a * cur[1] + b * c1[1] + cc * c2[1] + dd * p[1]))
                cur = p
            cur = (x, y); poly.append(cur)
        else:
            i += 1
            continue
        prev_c2, prev_q = nxt_c2, nxt_q
    if poly:
        poly.append(start); polys.append(poly)
    return [p for p in polys if len(p) > 2]


def raster(polys, px, ss=10, op='xor'):
    size = px * ss
    k = size / 24.0
    mask = np.zeros((size, size), dtype=bool)
    for poly in polys:
        im = Image.new('L', (size, size), 0)
        ImageDraw.Draw(im).polygon([(x * k, y * k) for x, y in poly], fill=255)
        m = np.array(im) > 127
        mask = (mask | m) if op == 'or' else (mask ^ m)
    out = Image.fromarray(np.where(mask, 20, 255).astype('uint8'), 'L')
    return out.resize((px, px), Image.LANCZOS).convert('RGBA')


def rr(x, y, w, h, r):
    """圆角矩形 → path（用于复刻旧图标的 <rect> 写法）"""
    return ('M %f,%f H %f A %f,%f 0 0 1 %f,%f V %f A %f,%f 0 0 1 %f,%f H %f '
            'A %f,%f 0 0 1 %f,%f V %f A %f,%f 0 0 1 %f,%f Z') % (
        x + r, y, x + w - r, r, r, x + w, y + r, y + h - r, r, r,
        x + w - r, y + h, x + r, r, r, x, y + h - r, y + r, r, r, x + r, y)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'replace')


def paths_of(svg):
    return re.findall(r'<path[^>]*\sd="([^"]+)"', svg)


BASE = 'https://unpkg.com/@material-design-icons/svg@latest/'

# 当前线上用的图标（app.js 里 TAP_HAND_ICON 的三个 rect 原样复刻）
OLD_PATHS = [
    rr(9.2, 2.4, 5.6, 13, 2.8),
    rr(4.0, 10.6, 16.0, 11.0, 3.8),
    rr(3.2, 8.0, 4.0, 7.4, 2.0),
]
# 自绘候选：去掉「拇指」，只剩食指 + 手掌，轮廓更干净
CLEAN_PATHS = [
    rr(9.6, 2.2, 4.8, 13.4, 2.4),
    rr(5.6, 12.0, 12.8, 9.4, 3.6),
]

ICONS = [
    ('A 旧图标（当前线上）', None, OLD_PATHS, 'or'),
    ('B 自绘 · 无拇指', None, CLEAN_PATHS, 'or'),
    ('C pan_tool_alt', BASE + 'filled/pan_tool_alt.svg', None, 'xor'),
    ('D touch_app', BASE + 'filled/touch_app.svg', None, 'xor'),
]

if not os.environ.get('SR_DEMO'):
    ICONS = []   # 被其它脚本 import 时不触发演示下载，设 SR_DEMO=1 可跑下方演示

log, rows = [], []
for name, url, paths, op in ICONS:
    try:
        ds = paths if url is None else paths_of(fetch(url))
        polys = []
        for d in ds:
            polys += parse_path(d)
        if not polys:
            log.append('%s: 解析失败' % name); continue
        rows.append((name, raster(polys, 320, op=op)))
        log.append('%s: ok' % name)
    except Exception as e:
        log.append('%s: FAIL %s' % (name, e))

if rows:
    sizes, zoom, pad, label_w = [11, 13, 16, 24], 8, 16, 230
    cell_w = max(sizes) * zoom + pad * 2
    row_h = max(sizes) * zoom + pad
    sheet = Image.new('RGB', (label_w + cell_w * len(sizes), row_h * len(rows) + 44), (255, 255, 255))
    dr = ImageDraw.Draw(sheet)
    dr.text((14, 14), 'icon comparison  (x8 nearest-neighbour)', fill=(60, 60, 60))
    for i, (name, big) in enumerate(rows):
        y0 = 44 + i * row_h
        dr.text((14, y0 + row_h // 2), name, fill=(20, 20, 20))
        dr.line([(0, y0), (sheet.width, y0)], fill=(232, 232, 232))
        for j, s in enumerate(sizes):
            small = big.resize((s, s), Image.LANCZOS)
            z = small.resize((s * zoom, s * zoom), Image.NEAREST)
            cx = label_w + j * cell_w + (cell_w - s * zoom) // 2
            dr.text((cx, y0 + 8), '%dpx' % s, fill=(120, 120, 120))
            sheet.paste(z, (cx, y0 + row_h - s * zoom - 10), z)
    sheet.save(os.path.join(HERE, 'hand_icon_sheet.png'))
    log.append('sheet ok: hand_icon_sheet.png %s' % (sheet.size,))

    strip = Image.new('RGB', (700, 92), (255, 255, 255))
    d2 = ImageDraw.Draw(strip)
    d2.text((10, 8), 'actual size in label (11px icon + 10px text)', fill=(80, 80, 80))
    x = 14
    for name, big in rows:
        small = big.resize((11, 11), Image.LANCZOS)
        strip.paste(small, (x, 52), small)
        d2.text((x + 16, 54), name[:12], fill=(30, 30, 30))
        x += 170
    strip.save(os.path.join(HERE, 'hand_icon_real.png'))
    log.append('real ok: hand_icon_real.png')

with io.open(os.path.join(HERE, 'render_icons_out.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))
