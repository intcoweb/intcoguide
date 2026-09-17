# -*- coding: utf-8 -*-
"""扫描 PPT：列出每页文字 + 该页用到的图片（含尺寸），用于定位「国毅手模厂 / 英彩箱盒厂 / 凯泽乳胶厂」三页。"""
import zipfile, re, os, sys

PPT = r'C:\Users\INTCO\Downloads\2026年度内销客户答谢会策划方案V1.pptx'
z = zipfile.ZipFile(PPT)


def slide_text(i):
    s = z.read('ppt/slides/slide%d.xml' % i).decode('utf-8', 'ignore')
    return re.findall(r'<a:t>(.*?)</a:t>', s, re.S)


def slide_media(i):
    """返回该页引用到的媒体文件名（按 r:embed 关系解析）"""
    out = []
    try:
        rels = z.read('ppt/slides/_rels/slide%d.xml.rels' % i).decode('utf-8', 'ignore')
    except KeyError:
        return out
    relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    s = z.read('ppt/slides/slide%d.xml' % i).decode('utf-8', 'ignore')
    for rid in re.findall(r'r:(?:embed|link)="([^"]+)"', s):
        t = relmap.get(rid, '')
        if 'media/' in t:
            out.append(os.path.basename(t))
    seen, uniq = set(), []
    for m in out:
        if m not in seen:
            seen.add(m)
            uniq.append(m)
    return uniq


def media_size(name):
    try:
        return z.getinfo('ppt/media/' + name).file_size
    except KeyError:
        return 0


KEY = ['国毅', '英彩', '凯泽', '手模', '箱盒', '乳胶']
print('=== 命中关键字的幻灯片 ===')
for i in range(1, 42):
    ts = slide_text(i)
    joined = ' '.join(ts)
    if any(k in joined for k in KEY):
        ms = slide_media(i)
        print('\n[slide%d]' % i)
        print('  文字: ' + ' | '.join(ts))
        for m in ms:
            print('    img %-18s %8.1f KB' % (m, media_size(m) / 1024))

print('\n=== 全部 41 页文字索引 ===')
for i in range(1, 42):
    ts = slide_text(i)
    print('slide%-3d %s' % (i, (' | '.join(ts))[:90]))
