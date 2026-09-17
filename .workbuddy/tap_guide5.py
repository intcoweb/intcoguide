"""第五轮：涟漪环与指尖相切（不重叠手指），并加厚到能在 11~13px 读出的程度。"""
import io, os, math, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import svg_raster as SR
from PIL import Image, ImageDraw, ImageFont, ImageOps
from tap_guide import HAND_POLYS, hand_transform, apply_xf, ring

HERE = os.path.dirname(os.path.abspath(__file__))

def scene(s, xf, rings, press=0.0):
    """rings = [(cx_off, cy_off, r, thickness), ...]，圆心相对指尖"""
    dx, dy, ss = hand_transform(s, xf)
    hand = apply_xf(HAND_POLYS, dx + press, dy, ss)
    polys, tip = list(hand), (xf, 12.0)
    for (ox, oy, r, t) in rings:
        polys.append(ring(tip[0] + ox, tip[1] + oy, r - t / 2.0, r + t / 2.0, -180, 180))
    xs = [p[0] for poly in polys for p in poly]; ys = [p[1] for poly in polys for p in poly]
    return polys, (min(xs), max(xs), min(ys), max(ys))

def render(polys_hand, polys_ring, ring_op, size_px=320):
    img = Image.new('RGBA', (size_px, size_px), (255, 255, 255, 255))
    if polys_hand:
        ink = ImageOps.invert(SR.raster(polys_hand, size_px, op='or').convert('L'))
        img.paste(Image.new('RGB', (size_px, size_px), (20, 20, 20)), (0, 0), ink)
    if polys_ring and ring_op > 0.01:
        a = ImageOps.invert(SR.raster(polys_ring, size_px, op='or').convert('L')).point(lambda v: int(v * ring_op))
        img.paste(Image.new('RGB', (size_px, size_px), (20, 20, 20)), (0, 0), a)
    return img.convert('RGB')

# 候选：切环（圆心 = 指尖 + r，环左缘刚好碰指尖）
C1 = (0.80, 16.2, [(3.0, 0, 3.0, 2.2)])            # 单个切环
C2 = (0.78, 15.6, [(2.6, 0, 2.4, 1.9), (4.4, 0, 4.0, 1.6)])   # 双切环
C3 = (0.80, 16.2, [(3.4, 0, 3.4, 2.6)])            # 单个切环（更厚更大）
C4 = (0.78, 15.6, [(2.4, 0, 2.2, 1.8), (5.0, 0, 4.6, 1.6)])   # 双切环（更分开）
CANDS = [('U 单切环 r3.0 t2.2', C1), ('V 双切环', C2), ('W 单切环 r3.4 t2.6', C3), ('X 双切环(分开)', C4)]

SIZES = [11, 12, 13, 16, 24]
zoom, pad, label_w = 8, 14, 210
cell_w = max(SIZES) * zoom + pad * 2
row_h = max(SIZES) * zoom + pad
sheet = Image.new('RGB', (label_w + cell_w * len(SIZES), row_h * len(CANDS) + 44), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
dr.text((14, 14), 'round 5: ring tangent to fingertip (no overlap)  (x8 nearest)', fill=(60, 60, 60))
log = []
for i, (name, (s, xf, rings)) in enumerate(CANDS):
    polys, bb = scene(s, xf, rings)
    dx, dy, ss = hand_transform(s, xf)
    hand = apply_xf(HAND_POLYS, dx, dy, ss)
    ring_polys = [p for p in polys if p not in hand]
    big = render(hand, ring_polys, 1.0)
    log.append('%-22s bbox x %.2f..%.2f y %.2f..%.2f %s' % (name, bb[0], bb[1], bb[2], bb[3],
               'OK' if bb[0] > -0.01 and bb[1] < 24.01 else '↯超'))
    y0 = 44 + i * row_h
    dr.text((14, y0 + row_h // 2), name, fill=(20, 20, 20))
    dr.line([(0, y0), (sheet.width, y0)], fill=(232, 232, 232))
    for j, sz in enumerate(SIZES):
        z = big.resize((sz, sz), Image.LANCZOS).resize((sz * zoom, sz * zoom), Image.NEAREST)
        cx = label_w + j * cell_w + (cell_w - sz * zoom) // 2
        dr.text((cx, y0 + 8), '%dpx' % sz, fill=(120, 120, 120))
        sheet.paste(z, (cx, y0 + row_h - sz * zoom - 10))
sheet.save(os.path.join(HERE, 'tap_guide5_sheet.png'))

# 动效条（以 U 为例）：环扩散 + 手指推进
s, xf, rings = C1
dx, dy, ss = hand_transform(s, xf)
N = 8
strip = Image.new('RGB', (150 + N * (24 * 6 + 14), 24 * 6 + 44), (255, 255, 255))
sd = ImageDraw.Draw(strip)
sd.text((14, 12), 'animation (x6): finger press + ring expands  [U]', fill=(60, 60, 60))
for k in range(N):
    t = k / float(N)
    sc = 0.62 + 0.72 * t
    op = max(0.0, 0.95 * (1 - t) ** 1.3)
    press = math.sin(min(1.0, t / 0.30) * math.pi) * 0.6 if t < 0.30 else 0.0
    hand = apply_xf(HAND_POLYS, dx + press, dy, ss)
    rp = [ring(xf + 3.0 * sc, 12, 3.0 * sc - 1.1, 3.0 * sc + 1.1, -180, 180)]
    img = render(hand, rp, op)
    z = img.resize((24 * 6, 24 * 6), Image.NEAREST)
    x = 150 + k * (24 * 6 + 14)
    strip.paste(z, (x, 34))
    sd.rectangle([x - 1, 33, x + 24 * 6, 33 + 24 * 6], outline=(228, 228, 228))
    sd.text((x, 18), 't=%d/%d' % (k, N), fill=(120, 120, 120))
strip.save(os.path.join(HERE, 'tap_guide5_anim.png'))

# 真实标签（3x）
try:
    FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 30)
except Exception:
    FONT = ImageFont.load_default()
Z, PADX, PADY, GAP, LH = 3, 6, 2, 2, 14
TXT, COL = '丁腈车间1', (29, 95, 189)
rows = []
for name, (s, xf, rings) in CANDS:
    rows.append((name, 12, scene(s, xf, rings)[0]))
rows.append(('U 静止（不显示环）', 12, apply_xf(HAND_POLYS, *hand_transform(*C1[:2]))))
mock = Image.new('RGB', (760, len(rows) * (LH * Z + 32) + 44), (244, 247, 250))
md = ImageDraw.Draw(mock)
md.text((14, 12), 'actual label (3x): icon 12px, text 10px', fill=(90, 90, 90))
for i, (name, isz, polys) in enumerate(rows):
    y = 44 + i * (LH * Z + 32)
    md.text((14, y + 10), name[:18], fill=(60, 60, 60))
    x = 230
    tw = md.textlength(TXT, font=FONT)
    w = PADX * Z * 2 + (isz + GAP) * Z + tw
    h = LH * Z + PADY * Z * 2
    md.rounded_rectangle([x, y, x + w, y + h], radius=8 * Z, fill=(255, 255, 255), outline=(205, 205, 205))
    img = render(None, polys, 1.0)
    ic = img.resize((isz * Z, isz * Z), Image.LANCZOS)
    ink = ImageOps.invert(ic.convert('L')).point(lambda v: 255 if v > 30 else int(v * 8.5))
    mock.paste(Image.new('RGB', ic.size, COL), (int(x + PADX * Z), int(y + PADY * Z) + 1), ink)
    md.text((x + (PADX + isz + GAP) * Z, y + PADY * Z - 2 * Z), TXT, font=FONT, fill=COL)
mock.save(os.path.join(HERE, 'tap_guide5_label.png'))

with io.open(os.path.join(HERE, 'tap_guide5_out.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))
