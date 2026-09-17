# -*- coding: utf-8 -*-
"""从 PPT 中提取三个基地页面的图片到临时目录，并打印尺寸。"""
import zipfile, os

PPT = r'C:\Users\INTCO\Downloads\2026年度内销客户答谢会策划方案V1.pptx'
OUT = r'C:\Users\INTCO\Desktop\桂校导航\web-guide\.workbuddy\ppt-media'
os.makedirs(OUT, exist_ok=True)

TARGETS = ['image26.png', 'image27.png', 'image28.png',
           'image29.png', 'image30.png', 'image31.png']

z = zipfile.ZipFile(PPT)
for name in TARGETS:
    arc = 'ppt/media/' + name
    data = z.read(arc)
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(data)
    # PNG 尺寸：IHDR 在偏移 16
    w = int.from_bytes(data[16:20], 'big')
    h = int.from_bytes(data[20:24], 'big')
    print('%-14s %8.1f KB  %dx%d  (%s)' % (name, len(data) / 1024, w, h, data[:8].hex()))

try:
    import PIL
    print('Pillow 可用:', PIL.__version__)
except ImportError:
    print('Pillow 不可用')
