# -*- coding: utf-8 -*-
"""把 PPT 里三个基地的厂区平面示意图转成 webp 并放入 assets/images/bases/。"""
import os
from PIL import Image

SRC = r'C:\Users\INTCO\Desktop\桂校导航\web-guide\.workbuddy\ppt-media'
DST = r'C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images\bases'
os.makedirs(DST, exist_ok=True)

JOBS = [
    ('image26.png', 'guoyi-mold.webp'),    # 国毅手模厂 · 厂区平面
    ('image28.png', 'yingcai-box.webp'),   # 英彩箱盒厂 · 厂区平面
    ('image30.png', 'kaiser-latex.webp'),  # 凯泽乳胶厂 · 厂区平面
]

for src_name, dst_name in JOBS:
    p = os.path.join(SRC, src_name)
    im = Image.open(p)
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
    out = os.path.join(DST, dst_name)
    im.save(out, 'WEBP', quality=84, method=6)
    print('%-22s %4dx%-5d -> %-22s %8.1f KB' % (
        src_name, w, h, dst_name, os.path.getsize(out) / 1024))

print('\n目录:', DST)
for f in sorted(os.listdir(DST)):
    print('  ', f, round(os.path.getsize(os.path.join(DST, f)) / 1024, 1), 'KB')
