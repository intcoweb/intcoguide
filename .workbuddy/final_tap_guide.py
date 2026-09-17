"""定稿校验：从 app.js 抽真实 path 与 transform，算出「指尖」坐标，
换算成 11px 图标下的 CSS 像素，核对 .tap-ripple 的定位是否落在指尖上。"""
import io, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import svg_raster as SR
from tap_guide import apply_xf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
log = []

app = io.open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
css = io.open(os.path.join(ROOT, 'css', 'style.css'), encoding='utf-8').read()

# 1) SVG 里那把手的 path + transform
m = re.search(r'<path transform="([^"]+)" d="([^"]+)"/>', app)
assert m, '未找到 path/transform'
tr, d = m.group(1), m.group(2)
log.append('transform: %s' % tr)
assert 'rotate(90 12 12)' in tr
log.append('path 与线上一致: %s' % (d.startswith('m19.98 14.82')))

# 2) 复算变换后的几何
polys = apply_xf(SR.parse_path(d), 0.0, -0.5, 1.0, deg=90, ox=12.0, oy=12.0)
xs = [p[0] for poly in polys for p in poly]
ys = [p[1] for poly in polys for p in poly]
tip_x = max(xs)
tip_y = sum(p[1] for poly in polys for p in poly if abs(p[0] - tip_x) < 1e-9) / 1.0
tip_ys = [p[1] for poly in polys for p in poly if p[0] > tip_x - 0.6]
tip_y = sum(tip_ys) / len(tip_ys)
log.append('24 画布 bbox: x %.2f..%.2f  y %.2f..%.2f' % (min(xs), max(xs), min(ys), max(ys)))
log.append('指尖（最右点）: (%.2f, %.2f)   [最右端 y 跨度 %.2f..%.2f]'
           % (tip_x, tip_y, min(tip_ys), max(tip_ys)))

# 3) 换算到 11px 图标
ICON, BOX, BD = 11.0, 5.0, 1.25
cx, cy = tip_x / 24.0 * ICON, tip_y / 24.0 * ICON
log.append('11px 图标内的指尖: (%.3f, %.3f) px' % (cx, cy))

# 4) CSS 里 .tap-ripple 的定位
blk = css[css.find('.marker-label .tap-ripple {'):]
left = float(re.search(r'left:\s*([\d.]+)px', blk).group(1))
top = float(re.search(r'top:\s*([\d.]+)px', blk).group(1))
w = float(re.search(r'width:\s*([\d.]+)px', blk).group(1))
rc_x, rc_y = left + w / 2.0, top + w / 2.0
log.append('波纹盒子 left/top = %.3f / %.3f，宽 %.2f → 弧心 (%.3f, %.3f)' % (left, top, w, rc_x, rc_y))
log.append('弧心 - 指尖 = (%+.3f, %+.3f) px  → %s'
           % (rc_x - cx, rc_y - cy,
              'OK' if abs(rc_x - cx) < 0.35 and abs(rc_y - cy) < 0.35 else '需微调'))

# 5) 其它断言
log.append('波纹只留右边框（开口弧）: %s' % ('border-right-color: currentColor' in blk))
log.append('波纹不是闭环: %s' % ('border: 1.25px solid transparent' in blk))
log.append('两个波纹错峰: %s' % ('.tap-ripple-b { animation-delay: -0.95s; }' in css))
log.append('手指轻推动画: %s' % ('@keyframes tapPress' in css))
log.append('降级分支保留静止波纹: %s' % ('transform: scale(1);' in css[css.rfind('.marker-label .tap-ripple {'):][:400]))
log.append('label-tap 已改为容器: %s' % ('position: relative;' in css[css.find('.marker-label .label-tap {'):][:120]))
log.append('JS 里 label-tap 是 span 容器: %s' % ("'<span class=\"label-tap\"" in app))
log.append('JS 里两个波纹元素: %s' % (app.count('class="tap-ripple') == 2))

# 6) 渲染定稿图（静态中段帧）
from PIL import Image, ImageDraw, ImageFont, ImageOps
from tap_guide import HAND_POLYS, hand_transform, ring
import math
HAND = apply_xf(HAND_POLYS, *hand_transform(1.0, 21.0)[:2], 1.0)
frames = []
tipc = (21.0, 11.5)
for t in (0.0, 0.2, 0.4, 0.6, 0.8):
    sc = 0.45 + (1.5 - 0.45) * t
    op = 0.9 if t == 0 else (0.34 + (0.0 - 0.34) * (t - 0.65) / 0.35 if t > 0.65 else 0.9 - (0.9 - 0.34) * (t / 0.65))
    press = math.sin(min(1.0, t / 0.30) * math.pi) * 0.7 if t < 0.30 else 0.0
    h = apply_xf(HAND_POLYS, press * 0.0, 0.0, 1.0) if False else apply_xf(HAND_POLYS, 0, 0, 1.0, deg=0)
    h = [ [(x + press, y) for (x, y) in poly] for poly in HAND ]
    r = BOX / 2.0 / (ICON / 24.0)            # 5px 盒子 → 画布单位半径
    r = (w / 2.0) / ICON * 24.0 * sc
    arcs = [ring(tipc[0], tipc[1] - 0.25, max(0.2, r - 0.7 * sc), r + 0.7 * sc, -38, 38)]
    img = Image.new('RGB', (320, 320), (255, 255, 255))
    img.paste(Image.new('RGB', (320, 320), (20, 20, 20)), (0, 0),
              ImageOps.invert(SR.raster(h, 320, op='or').convert('L')))
    am = ImageOps.invert(SR.raster(arcs, 320, op='or').convert('L')).point(lambda v: int(v * max(0.0, min(1.0, op))))
    img.paste(Image.new('RGB', (320, 320), (20, 20, 20)), (0, 0), am)
    frames.append(img)
try:
    FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 30)
except Exception:
    FONT = ImageFont.load_default()
Z = 3
mock = Image.new('RGB', (200 + 5 * 110, 90), (244, 247, 250))
md = ImageDraw.Draw(mock)
md.text((12, 8), 'final: hand + tap ripple (3x, icon 11px)', fill=(90, 90, 90))
x = 200
for i, img in enumerate(frames):
    big = img.resize((11 * Z, 11 * Z), Image.LANCZOS)
    mk = ImageOps.invert(big.convert('L')).point(lambda v: 255 if v > 30 else int(v * 8.5))
    mock.paste(Image.new('RGB', big.size, (29, 95, 189)), (x, 24), mk)
    md.text((x, 62), 't=%.1f' % (i / 4.0), fill=(130, 130, 130))
    x += 110
md.rounded_rectangle([12, 24, 12 + 170, 24 + 40], radius=20, fill=(255, 255, 255), outline=(205, 205, 205))
big = frames[1].resize((11 * Z, 11 * Z), Image.LANCZOS)
mk = ImageOps.invert(big.convert('L')).point(lambda v: 255 if v > 30 else int(v * 8.5))
mock.paste(Image.new('RGB', big.size, (29, 95, 189)), (20, 30), mk)
md.text((20 + 11 * Z + 3, 36), '丁腈车间1', font=FONT, fill=(29, 95, 189))
mock.save(os.path.join(HERE, 'final_tap_guide.png'))
log.append('定稿图: final_tap_guide.png')

with io.open(os.path.join(HERE, 'final_tap_guide.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))
