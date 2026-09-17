"""「引导点击」图标候选：手指朝右 + 点击波纹。
本机没有可用的 SVG 渲染后端，用 svg_raster 的 path 光栅化器自绘比对。
输出：tap_guide_sheet.png（尺寸梯度）、tap_guide_label.png（真实标签 3x）"""
import io, os, math, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import svg_raster as SR
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
HAND_D = ('m19.98 14.82-.63 4.46c-.14.99-.99 1.72-1.98 1.72h-6.16c-.53 0-1.29-.21-1.66-.59L5 15.62'
          'l.83-.84c.24-.24.58-.35.92-.28l3.25.74V4.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v6h.91'
          'c.31 0 .62.07.89.21l4.09 2.04c.77.39 1.21 1.22 1.09 2.07z')
HAND_POLYS = SR.parse_path(HAND_D)

# 手指朝右的合成变换：绕画布中心转 90°，再缩放、平移，把指尖放到 (XF, 12)
def hand_transform(s, xf):
    dx = xf - 12 - 9 * s
    dy = -0.5 * s          # 旋转后内容中心在 y=12.36（s=1 时），补正回 12
    return dx, dy, s

def apply_xf(polys, dx, dy, s, deg=90, ox=12.0, oy=12.0):
    c, sn = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    out = []
    for poly in polys:
        q = []
        for x, y in poly:
            rx, ry = x - ox, y - oy
            q.append(((c * rx - sn * ry) * s + ox + dx, (sn * rx + c * ry) * s + oy + dy))
        out.append(q)
    return out

def ring(cx, cy, r_in, r_out, a0, a1, n=56):
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + r_out * math.cos(a), cy + r_out * math.sin(a)))
    for i in range(n, -1, -1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + r_in * math.cos(a), cy + r_in * math.sin(a)))
    return pts

def ring_path(cx, cy, r_in, r_out, a0, a1):
    """外弧顺时针 + 内弧逆时针，闭合成可填充的环带（与预览光栅化完全同源）"""
    def pt(r, a):
        a = math.radians(a)
        return (cx + r * math.cos(a), cy + r * math.sin(a))
    large = 1 if abs(a1 - a0) > 180 else 0
    p1, p2 = pt(r_out, a0), pt(r_out, a1)
    p3, p4 = pt(r_in, a1), pt(r_in, a0)
    fmt = lambda p: ('%.3f %.3f' % p).rstrip('0').rstrip('.')
    return ('M%s A%.3f %.3f 0 %d 1 %s L%s A%.3f %.3f 0 %d 0 %s Z'
            % (fmt(p1), r_out, r_out, large, fmt(p2), fmt(p3),
               r_in, r_in, large, fmt(p4)))

# ---- 候选定义：s=手指缩放, xf=指尖 x；arcs=[(r_in,r_out,a0,a1) 以指尖为圆心] ----
S, XF = 0.76, 13.6
CANDS = [
    ('A 弧×2（细）', S, XF, [(3.0, 4.0, -52, 52), (5.4, 6.4, -46, 46)]),
    ('B 弧×2（粗）', S, XF, [(2.8, 4.4, -56, 56), (5.2, 6.8, -48, 48)]),
    ('C 环（指尖包一圈）', S, XF, [(2.9, 4.3, -180, 180)]),
    ('D 弧+环', S, XF, [(2.9, 4.3, -180, 180), (5.6, 7.0, -46, 46)]),
    ('E 弧×1（大）', S, XF, [(3.6, 5.2, -62, 62)]),
    ('F 弧×3', S, XF, [(2.6, 3.6, -50, 50), (4.6, 5.6, -46, 46), (6.6, 7.6, -42, 42)]),
    ('G 仅有手（当前线上）', S, XF, []),
]

sizes, zoom, pad, label_w = [11, 13, 16, 24], 8, 16, 250
log, rows = [], []
for name, s, xf, arcs in CANDS:
    dx, dy, ss = hand_transform(s, xf)
    polys = apply_xf(HAND_POLYS, dx, dy, ss)
    xs = [p[0] for poly in polys for p in poly]
    ys = [p[1] for poly in polys for p in poly]
    tip = (xf, 12.0)
    for (ri, ro, a0, a1) in arcs:
        polys.append(ring(tip[0], tip[1], ri, ro, a0, a1))
        for ang in (a0, a1):
            xs.append(tip[0] + ro * math.cos(math.radians(ang)))
            ys.append(tip[1] + ro * math.sin(math.radians(ang)))
    xs.append(tip[0])
    ys.append(tip[1])
    rows.append((name, SR.raster(polys, 320, op='or')))
    log.append('%-22s bbox x %.2f..%.2f  y %.2f..%.2f   %s'
               % (name, min(xs), max(xs), min(ys), max(ys),
                  'OK' if (min(xs) > -0.01 and max(xs) < 24.01 and min(ys) > -0.01 and max(ys) < 24.01) else '↯ 超出画布'))

# 尺寸梯度
cell_w = max(sizes) * zoom + pad * 2
row_h = max(sizes) * zoom + pad
sheet = Image.new('RGB', (label_w + cell_w * len(sizes), row_h * len(rows) + 44), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
dr.text((14, 14), 'tap-guide icon candidates  (x8 nearest)', fill=(60, 60, 60))
for i, (name, big) in enumerate(rows):
    y0 = 44 + i * row_h
    dr.text((14, y0 + row_h // 2), name, fill=(20, 20, 20))
    dr.line([(0, y0), (sheet.width, y0)], fill=(232, 232, 232))
    for j, sz in enumerate(sizes):
        small = big.resize((sz, sz), Image.LANCZOS)
        z = small.resize((sz * zoom, sz * zoom), Image.NEAREST)
        cx = label_w + j * cell_w + (cell_w - sz * zoom) // 2
        dr.text((cx, y0 + 8), '%dpx' % sz, fill=(120, 120, 120))
        sheet.paste(z, (cx, y0 + row_h - sz * zoom - 10), z)
sheet.save(os.path.join(HERE, 'tap_guide_sheet.png'))

# 真实标签 mock（3x）
try:
    f10 = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 10 * 3)
except Exception:
    f10 = ImageFont.load_default()
Z = 3
PADX, PADY, ICON, GAP, LINE = 6, 2, 11, 2, 14
COLORS = [(29, 95, 189), (110, 60, 200), (13, 120, 110), (8, 123, 69)]
TEXTS = ['丁腈车间1', 'PVC车间2', '污水处理一期', '工厂门卫']
mock = Image.new('RGB', (760, len(rows) * (LINE * Z + 30) + 40), (244, 247, 250))
md = ImageDraw.Draw(mock)
md.text((14, 12), 'actual label (3x): 11px icon + 10px text', fill=(90, 90, 90))
for i, (name, big) in enumerate(rows):
    y = 40 + i * (LINE * Z + 30)
    md.text((14, y + 4), name[:14], fill=(60, 60, 60))
    x = 210
    txt = TEXTS[i % len(TEXTS)]
    col = COLORS[i % len(COLORS)]
    tw = md.textlength(txt, font=f10)
    w = PADX * 2 * Z + (ICON + GAP) * Z + tw
    h = LINE * Z + PADY * 2 * Z
    md.rounded_rectangle([x, y, x + w, y + h], radius=8 * Z, fill=(255, 255, 255), outline=(205, 205, 205))
    ic = big.resize((ICON * Z, ICON * Z), Image.LANCZOS)
    mask = Image.new('L', ic.size, 0)
    mask.paste(ic.split()[3], (0, 0))
    tint = Image.new('RGB', ic.size, col)
    mock.paste(tint, (int(x + PADX * Z), int(y + PADY * Z + 1 * Z)), mask)
    md.text((x + (PADX + ICON + GAP) * Z, y + PADY * Z - 2 * Z), txt, font=f10, fill=col)
mock.save(os.path.join(HERE, 'tap_guide_label.png'))

with io.open(os.path.join(HERE, 'tap_guide_out.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))
