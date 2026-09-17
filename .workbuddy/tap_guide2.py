"""第二轮：手形放大 + 更耐缩的「点击」点缀，并同时看 11px / 13px。"""
import io, os, math, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import svg_raster as SR
from PIL import Image, ImageDraw, ImageFont
from tap_guide import HAND_D, HAND_POLYS, hand_transform, apply_xf, ring

HERE = os.path.dirname(os.path.abspath(__file__))

def wedge(cx, cy, r_in, r_out, a0, a1, n=48):
    """实心扇形块（外弧 + 圆心侧直边）——比细环更耐缩小"""
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + r_out * math.cos(a), cy + r_out * math.sin(a)))
    if r_in > 0:
        for i in range(n, -1, -1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            pts.append((cx + r_in * math.cos(a), cy + r_in * math.sin(a)))
    return pts

def star(cx, cy, r, w=0.34):
    pts = []
    for k in range(4):
        a = math.radians(90 * k)
        for da, rr in ((-w, r), (w, r)):
            pass
    # 四角星：外点 4 个 + 内点 4 个
    for k in range(8):
        a = math.radians(45 * k - 90)
        rr = r if k % 2 == 0 else r * 0.34
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

SIZES = [11, 13, 16, 24]

def build(s, xf, accents):
    dx, dy, ss = hand_transform(s, xf)
    polys = apply_xf(HAND_POLYS, dx, dy, ss)
    tip = (xf, 12.0)
    for acc in accents:
        kind = acc[0]
        if kind == 'ring':
            _, ri, ro, a0, a1 = acc
            polys.append(ring(tip[0], tip[1], ri, ro, a0, a1))
        elif kind == 'wedge':
            _, ri, ro, a0, a1 = acc
            polys.append(wedge(tip[0], tip[1], ri, ro, a0, a1))
        elif kind == 'dot':
            _, r = acc
            polys.append([(tip[0] + r * math.cos(math.radians(t)), tip[1] + r * math.sin(math.radians(t)))
                          for t in range(0, 361, 12)])
        elif kind == 'star':
            _, r, sox, soy = acc
            polys.append(star(tip[0] + sox, tip[1] + soy, r))
    return polys, tip

CANDS = [
    ('H 只有手 (s=1.00)',            1.00, 21.0, []),
    ('I 手 s=.90 + 粗环×2',           0.90, 16.2, [('ring', 2.3, 3.7, -50, 50), ('ring', 4.6, 6.0, -44, 44)]),
    ('J 手 s=.90 + 环×1',            0.90, 16.2, [('ring', 2.6, 4.6, -58, 58)]),
    ('K 手 s=.90 + 楔形×2',           0.90, 16.2, [('wedge', 2.0, 4.4, -48, 48), ('wedge', 5.0, 6.6, -34, 34)]),
    ('L 手 s=.90 + 落点圆',           0.90, 16.2, [('dot', 2.3)]),
    ('M 手 s=.90 + 点击星 (右下)',      0.90, 16.2, [('star', 3.6, 3.2, -2.6)]),
    ('N 手 s=.86 + 楔×2 + 落点',      0.86, 15.0, [('wedge', 2.2, 4.6, -46, 46), ('wedge', 5.0, 6.4, -32, 32), ('dot', 1.5)]),
]

zoom, pad, label_w = 8, 16, 236
cell_w = max(SIZES) * zoom + pad * 2
row_h = max(SIZES) * zoom + pad
sheet = Image.new('RGB', (label_w + cell_w * len(SIZES), row_h * len(CANDS) + 44), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
dr.text((14, 14), 'round 2: bigger hand + durable click accents (x8 nearest)', fill=(60, 60, 60))
log = []
for i, (name, s, xf, accents) in enumerate(CANDS):
    polys, tip = build(s, xf, accents)
    xs = [p[0] for poly in polys for p in poly]; ys = [p[1] for poly in polys for p in poly]
    big = SR.raster(polys, 320, op='or')
    log.append('%-26s bbox x %.2f..%.2f y %.2f..%.2f %s' % (name, min(xs), max(xs), min(ys), max(ys),
               'OK' if (min(xs) > -0.01 and max(xs) < 24.01) else '↯超'))
    y0 = 44 + i * row_h
    dr.text((14, y0 + row_h // 2), name, fill=(20, 20, 20))
    dr.line([(0, y0), (sheet.width, y0)], fill=(232, 232, 232))
    for j, sz in enumerate(SIZES):
        small = big.resize((sz, sz), Image.LANCZOS)
        z = small.resize((sz * zoom, sz * zoom), Image.NEAREST)
        cx = label_w + j * cell_w + (cell_w - sz * zoom) // 2
        dr.text((cx, y0 + 8), '%dpx' % sz, fill=(120, 120, 120))
        sheet.paste(z, (cx, y0 + row_h - sz * zoom - 10), z)
sheet.save(os.path.join(HERE, 'tap_guide2_sheet.png'))

try:
    fnt = lambda n: ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', n)
except Exception:
    fnt = lambda n: ImageFont.load_default()

Z = 3
PADX, PADY, GAP, LH = 6, 2, 2, 14
COL = (29, 95, 189)
TXT = '丁腈车间1'
mock = Image.new('RGB', (720, len(CANDS) * 3 * 36 + 40), (244, 247, 250))
md = ImageDraw.Draw(mock)
md.text((14, 12), 'actual label (3x): icon 11 / 12 / 13px, text 10px', fill=(90, 90, 90))
for i, (name, s, xf, accents) in enumerate(CANDS):
    polys, tip = build(s, xf, accents)
    big = SR.raster(polys, 320, op='or')
    y = 40 + i * 3 * 36
    md.text((14, y + 4), name[:16], fill=(60, 60, 60))
    for k, isz in enumerate((11, 12, 13)):
        f = fnt(10 * Z)
        tw = md.textlength(TXT, font=f)
        x = 240 + k * 160
        w = PADX * Z * 2 + (isz + GAP) * Z + tw
        h = LH * Z + PADY * Z * 2
        md.rounded_rectangle([x, y, x + w, y + h], radius=8 * Z, fill=(255, 255, 255), outline=(205, 205, 205))
        ic = big.resize((isz * Z, isz * Z), Image.LANCZOS)
        tint = Image.new('RGB', ic.size, COL)
        mock.paste(tint, (int(x + PADX * Z), int(y + PADY * Z) + 1), ic.split()[3])
        md.text((x + (PADX + isz + GAP) * Z, y + PADY * Z - 2 * Z), TXT, font=f, fill=COL)
mock.save(os.path.join(HERE, 'tap_guide2_label.png'))

with io.open(os.path.join(HERE, 'tap_guide2_out.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))
