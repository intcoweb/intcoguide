# -*- coding: utf-8 -*-
"""通用：把任意图片转成项目用的 webp。

用法:
    python png_to_webp.py <源文件> <输出文件名.webp> [最大宽度]
"""
import os
import sys
import traceback
from PIL import Image

ROOT = r'C:\Users\INTCO\Desktop\桂校导航\web-guide'
DST_DIR = os.path.join(ROOT, 'assets', 'images')
LOG = os.path.join(ROOT, '.workbuddy', '_out.txt')

lines = []


def main():
    src = sys.argv[1]
    out_name = sys.argv[2]
    max_w = int(sys.argv[3]) if len(sys.argv) > 3 else 1280

    im = Image.open(src)
    lines.append('源图  %s  %sx%s  mode=%s  %.1f KB' % (
        os.path.basename(src), im.size[0], im.size[1], im.mode, os.path.getsize(src) / 1024))

    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')

    w, h = im.size
    if w > max_w:
        im = im.resize((max_w, round(h * max_w / w)), Image.LANCZOS)
        lines.append('缩放  %sx%s -> %sx%s' % (w, h, im.size[0], im.size[1]))
    else:
        lines.append('尺寸未超 %d，保持原样' % max_w)

    dst = os.path.join(DST_DIR, out_name)
    im.save(dst, 'WEBP', quality=84, method=6)
    lines.append('输出  assets/images/%s  %sx%s  %.1f KB' % (
        out_name, im.size[0], im.size[1], os.path.getsize(dst) / 1024))
    lines.append('OK')


try:
    main()
except Exception:
    lines.append('FAILED')
    lines.append(traceback.format_exc())
finally:
    with open(LOG, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
