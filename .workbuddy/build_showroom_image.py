# -*- coding: utf-8 -*-
"""把展厅新配图（剪贴板 PNG）转成 webp 放入 assets/images/。"""
import os
import traceback
from PIL import Image

SRC = r'C:\Users\INTCO\.workbuddy\clipboard-images\clipboard-2026-09-16T06-50-20-691Z-001824d7.png'
DST_DIR = r'C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images'
LOG = r'C:\Users\INTCO\Desktop\桂校导航\web-guide\.workbuddy\_out.txt'
DST = os.path.join(DST_DIR, 'showroom.webp')

lines = []


def log(s):
    lines.append(str(s))


def flush():
    with open(LOG, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))


try:
    for f in ('exhibition.webp',):
        p = os.path.join(DST_DIR, f)
        if os.path.exists(p):
            im0 = Image.open(p)
            log('现有 %s  %sx%s  %.1f KB' % (f, im0.size[0], im0.size[1], os.path.getsize(p) / 1024))

    im = Image.open(SRC)
    log('源图  %sx%s  mode=%s' % (im.size[0], im.size[1], im.mode))
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')

    w, h = im.size
    if w > 1280:
        im = im.resize((1280, round(h * 1280 / w)), Image.LANCZOS)

    im.save(DST, 'WEBP', quality=84, method=6)
    log('输出  showroom.webp  %sx%s  %.1f KB' % (im.size[0], im.size[1], os.path.getsize(DST) / 1024))
    log('OK')
except Exception:
    log('FAILED')
    log(traceback.format_exc())
finally:
    flush()
