"""换「朝右小手」后的端到端校验：
  1) 从 app.js 里抽出真正写入的 <path d=... transform=...>（不是抄一份，是读线上那串）
  2) 按 SVG 变换语义还原几何 → 算内容包围盒 / 中心，核对 vertical-align 基准
  3) 按真实标签规格（icon 11px / text 10px / vertical-align -1.5px）渲染定稿图
  4) 校验 css 的 vertical-align、index.html 版本号、8000 端口返回的文件
产出 final_check.txt / final_label.png
"""
import sys, os, io, re, json, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
os.environ['SR_DEMO'] = '1'
import svg_raster as SR
from PIL import Image, ImageDraw, ImageFont

log = []
app = io.open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
css = io.open(os.path.join(ROOT, 'css', 'style.css'), encoding='utf-8').read()
html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

# ---------- 1) 抽取真实写入的 path / transform ----------
blk = app[app.index('const TAP_HAND_ICON'):]
blk = blk[:blk.index('</svg>')]
d = re.search(r'd="([^"]+)"', blk).group(1)
tf = re.search(r'transform="([^"]+)"', blk)
tf = tf.group(1) if tf else ''
log.append('app.js 写入的 transform: %s' % (tf or '(无)'))
log.append('path 长度 %d 字符，含 %d 个 moveto' % (len(d), len(re.findall(r'[Mm]', d))))

polys = SR.parse_path(d)


def apply_tf(polys, tf):
    """按 SVG 语义：transform="A B" 等价 A·B，即先对点做 B 再 A。"""
    ops = re.findall(r'(translate|rotate|scale)\s*\(([^)]*)\)', tf)
    for name, args in reversed(ops):
        v = [float(x) for x in re.split(r'[ ,]+', args.strip()) if x]
        if name == 'translate':
            dx, dy = v[0], (v[1] if len(v) > 1 else 0.0)
            polys = [[(x + dx, y + dy) for x, y in p] for p in polys]
        elif name == 'rotate':
            import math
            a = math.radians(v[0])
            cx, cy = (v[1], v[2]) if len(v) > 2 else (0.0, 0.0)
            ca, sa = math.cos(a), math.sin(a)
            polys = [[(cx + (x - cx) * ca - (y - cy) * sa,
                       cy + (x - cx) * sa + (y - cy) * ca) for x, y in p] for p in polys]
        elif name == 'scale':
            sx, sy = v[0], (v[1] if len(v) > 1 else v[0])
            polys = [[(x * sx, y * sy) for x, y in p] for p in polys]
    return polys


polys = apply_tf(polys, tf)
xs = [p[0] for poly in polys for p in poly]
ys = [p[1] for poly in polys for p in poly]
x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
cx24, cy24 = (x0 + x1) / 2, (y0 + y1) / 2
log.append('变换后 bbox24 = (%.2f, %.2f)-(%.2f, %.2f)   内容中心 (%.2f, %.2f)'
           % (x0, y0, x1, y1, cx24, cy24))

# 手指朝向判定：内容最右端的 y 应落在手掌主体中部 → 食指伸向右
right_pts = [p for poly in polys for p in poly if p[0] > x1 - 0.6]
ry = [p[1] for p in right_pts]
log.append('最右端（指尖）y 范围 %.2f..%.2f → 形态：%s'
           % (min(ry), max(ry), '手指朝右' if max(ry) - min(ry) < 6 else '需人工确认'))

# ---------- 2) vertical-align 基准 ----------
ICON = 11.0
off = (cy24 - 12.0) / 24.0 * ICON          # 内容中心相对画布中心的下偏量（px）
want = round(-1.5 + off, 2)
m = re.search(r'\.marker-label \.label-tap\s*\{([^}]*)\}', css)
va = re.search(r'vertical-align:\s*([-\d.]+)px', m.group(1)).group(1)
log.append('内容中心偏移 %+.3fpx  →  理论 vertical-align %+.2fpx'
           % (off, want))
log.append('css 实际 vertical-align: %spx   %s'
           % (va, 'OK' if abs(float(va) - want) < 0.06 else '需复核'))

# ---------- 3) 渲染定稿标签图 ----------
FONT_PATH = 'C:/Windows/Fonts/msyh.ttc'
ZOOM = 12
big = SR.raster(polys, 320, op='xor')
FONT = ImageFont.truetype(FONT_PATH, 10 * ZOOM)
LINE = int(10 * 1.35 * ZOOM)
PAD_X, PAD_Y, RADIUS, GAP = 6 * ZOOM, 1 * ZOOM, 8 * ZOOM, 2 * ZOOM
ICONP = int(ICON * ZOOM)
TEXT, COLOR = '丁腈车间1', (36, 93, 183)
tw = int(ImageDraw.Draw(Image.new('RGB', (10, 10))).textlength(TEXT, font=FONT))
lw, lh = PAD_X * 2 + ICONP + GAP + tw, LINE + PAD_Y * 2
H = lh + 2 * 26 * ZOOM
img = Image.new('RGB', (lw + 2 * 30 * ZOOM, H), (243, 244, 246))
dr = ImageDraw.Draw(img)
f_tag = ImageFont.truetype(FONT_PATH, 13 * ZOOM // 2)
dr.text((14 * ZOOM // 2, 10 * ZOOM // 2), '定稿 · 标签内 x%d 放大（icon 11px / text 10px）' % ZOOM,
        font=f_tag, fill=(90, 94, 100))
y0b = int(26 * ZOOM)
x = int(30 * ZOOM)
dr.rounded_rectangle([x, y0b, x + lw, y0b + lh], radius=RADIUS, fill=(255, 255, 255),
                     outline=(204, 204, 204), width=1)
ic = big.resize((ICONP, ICONP), Image.LANCZOS)
# 模拟 inline 基线对齐：盒子底边 = 基线 + (-vertical-align)
baseline = y0b + PAD_Y + int(10 * ZOOM * 0.9)
iy = int(baseline + float(va) * ZOOM - ICONP)
img.paste(ic, (x + PAD_X, iy), ic)
dr.text((x + PAD_X + ICONP + GAP, y0b + PAD_Y + int(2.5 * ZOOM)), TEXT, font=FONT, fill=COLOR)
img.save(os.path.join(HERE, 'final_label.png'))
log.append('定稿图 -> final_label.png %s' % (img.size,))

# ---------- 4) 版本号 + 服务端 ----------
vs = re.findall(r'(?:style\.css|data\.js|app\.js)\?v=(\d+-\d+)', html)
log.append('index.html 版本号: CSS v%s / data v%s / app v%s'
           % (vs[0] if len(vs) > 0 else '?', vs[1] if len(vs) > 1 else '?',
              vs[2] if len(vs) > 2 else '?'))
try:
    served_html = urllib.request.urlopen('http://127.0.0.1:8000/index.html', timeout=8).read().decode('utf-8')
    served_app = urllib.request.urlopen('http://127.0.0.1:8000/js/app.js', timeout=8).read().decode('utf-8')
    served_css = urllib.request.urlopen('http://127.0.0.1:8000/css/style.css', timeout=8).read().decode('utf-8')
    log.append('8000 端口: html_v%s=%s  app 已含 rotate(90 12 12)=%s  css 已含 -1.5px=%s  旧 gesture-tap path 残留=%d'
               % (vs[0], (vs[0] in served_html), ('rotate(90 12 12)' in served_app),
                  ('vertical-align: -1.5px' in served_css), served_app.count('M10,9A1,1')))
except Exception as e:
    log.append('8000 端口未响应: %s' % e)

io.open(os.path.join(HERE, 'final_check.txt'), 'w', encoding='utf-8').write('\n'.join(log))
