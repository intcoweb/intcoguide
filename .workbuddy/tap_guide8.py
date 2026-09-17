"""第八轮（定稿比对）：13px 图标下，指尖波纹的五种写法 —— 目标：既不像钥匙，也不糊。"""
import io, os, math, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import svg_raster as SR
from PIL import Image, ImageDraw, ImageFont, ImageOps
from tap_guide import HAND_POLYS, hand_transform, apply_xf, ring

HERE = os.path.dirname(os.path.abspath(__file__))

def arc(cx, cy, r, t, a0, a1, n=48):
    return ring(cx, cy, r - t / 2.0, r + t / 2.0, a0, a1, n)

S, XF = 0.80, 16.3
DX, DY, SS = hand_transform(S, XF)
HAND = apply_xf(HAND_POLYS, DX, DY, SS)
TIP = (XF, 12.0)

C = [
    ('R1 环(圆心=指尖) r2.4', [arc(TIP[0], TIP[1], 2.4, 1.7, -180, 180)]),
    ('R2 环(圆心=指尖) r3.4', [arc(TIP[0], TIP[1], 3.4, 1.7, -180, 180)]),
    ('R3 开口弧 ) r2.8',      [arc(TIP[0], TIP[1], 2.8, 1.9, -52, 52)]),
    ('R4 双开口弧 ))',        [arc(TIP[0], TIP[1], 2.5, 1.7, -50, 50), arc(TIP[0], TIP[1], 4.6, 1.5, -42, 42)]),
    ('R5 环右偏 1.6 单位',    [arc(TIP[0] + 1.6, TIP[1], 2.8, 1.8, -180, 180)]),
    ('R6 对照：无波纹',       []),
]

SIZES = [12, 13, 14, 16, 24]
zoom, pad, label_w = 8, 14, 240
cell_w = max(SIZES) * zoom + pad * 2
row_h = max(SIZES) * zoom + pad
sheet = Image.new('RGB', (label_w + cell_w * len(SIZES), row_h * len(C) + 44), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
dr.text((14, 14), 'round 8 final: fingertip ripple variants  (x8 nearest)', fill=(60, 60, 60))
log = []
for i, (name, acc) in enumerate(C):
    polys = HAND + acc
    ink = ImageOps.invert(SR.raster(polys, 320, op='or').convert('L'))
    big = Image.new('RGB', (320, 320), (255, 255, 255))
    big.paste(Image.new('RGB', (320, 320), (20, 20, 20)), (0, 0), ink)
    xs = [p[0] for poly in polys for p in poly]; ys = [p[1] for poly in polys for p in poly]
    log.append('%-22s bbox x %.2f..%.2f y %.2f..%.2f %s' % (name, min(xs), max(xs), min(ys), max(ys),
               'OK' if min(xs) > -0.01 and max(xs) < 24.01 else '↯超'))
    y0 = 44 + i * row_h
    dr.text((14, y0 + row_h // 2), name, fill=(20, 20, 20))
    dr.line([(0, y0), (sheet.width, y0)], fill=(232, 232, 232))
    for j, sz in enumerate(SIZES):
        z = big.resize((sz, sz), Image.LANCZOS).resize((sz * zoom, sz * zoom), Image.NEAREST)
        cx = label_w + j * cell_w + (cell_w - sz * zoom) // 2
        dr.text((cx, y0 + 8), '%dpx' % sz, fill=(120, 120, 120))
        sheet.paste(z, (cx, y0 + row_h - sz * zoom - 10))
sheet.save(os.path.join(HERE, 'tap_guide8_sheet.png'))

# 动效：波纹从小扩散到消失（模拟 CSS 动画）——用 R3 与 R1 各出一组
try:
    FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 30)
except Exception:
    FONT = ImageFont.load_default()
Z, PADX, PADY, GAP, LH = 3, 6, 2, 2, 14
TXT, COL = '丁腈车间1', (29, 95, 189)

def frame_img(kind, t):
    sc = 0.55 + 0.95 * t
    op = max(0.0, 0.95 * (1 - t) ** 1.3)
    press = math.sin(min(1.0, t / 0.30) * math.pi) * 0.55 if t < 0.30 else 0.0
    h = apply_xf(HAND_POLYS, DX + press, DY, SS)
    if kind == 'R1':
        a = [arc(TIP[0], TIP[1], 2.4 * sc, 1.7, -180, 180)]
    else:
        a = [arc(TIP[0], TIP[1], 2.8 * sc, 1.9, -52, 52)]
    img = Image.new('RGB', (320, 320), (255, 255, 255))
    img.paste(Image.new('RGB', (320, 320), (20, 20, 20)), (0, 0), ImageOps.invert(SR.raster(h, 320, op='or').convert('L')))
    am = ImageOps.invert(SR.raster(a, 320, op='or').convert('L')).point(lambda v: int(v * op))
    img.paste(Image.new('RGB', (320, 320), (20, 20, 20)), (0, 0), am)
    return img

N, ISZ = 6, 13
mock = Image.new('RGB', (240 + (N + 1) * 120, 3 * 90 + 40), (244, 247, 250))
md = ImageDraw.Draw(mock)
md.text((14, 12), 'animation (3x, icon 13px): rows = R1 ring / R3 arc / R6 none', fill=(90, 90, 90))
for r, kind in enumerate(('R1', 'R3', 'R6')):
    y = 40 + r * 90
    for k in range(N + 1):
        img = frame_img(kind, k / float(N))
        x = 240 + k * 120
        tw = md.textlength(TXT, font=FONT) if k == 0 else 0
        w = (PADX * Z * 2 + (ISZ + GAP) * Z + tw) if k == 0 else ISZ * Z + 14
        h = LH * Z + PADY * Z * 2
        if k == 0:
            md.rounded_rectangle([x, y, x + w, y + h], radius=8 * Z, fill=(255, 255, 255), outline=(205, 205, 205))
            ic = img.resize((ISZ * Z, ISZ * Z), Image.LANCZOS)
            mk = ImageOps.invert(ic.convert('L')).point(lambda v: 255 if v > 30 else int(v * 8.5))
            mock.paste(Image.new('RGB', ic.size, COL), (int(x + PADX * Z), int(y + PADY * Z) + 1), mk)
            md.text((x + (PADX + ISZ + GAP) * Z, y + PADY * Z - 2 * Z), TXT, font=FONT, fill=COL)
        else:
            big = img.resize((ISZ * Z, ISZ * Z), Image.LANCZOS)
            md.rectangle([x, y, x + ISZ * Z, y + h], outline=(228, 228, 228))
            mk = ImageOps.invert(big.convert('L')).point(lambda v: 255 if v > 30 else int(v * 8.5))
            mock.paste(Image.new('RGB', big.size, COL), (x, y + PADY * Z + 1), mk)
            md.text((x + 6, y + h + 2), 't=%.2f' % (k / float(N)), fill=(130, 130, 130))
mock.save(os.path.join(HERE, 'tap_guide8_anim.png'))

with io.open(os.path.join(HERE, 'tap_guide8_out.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))
