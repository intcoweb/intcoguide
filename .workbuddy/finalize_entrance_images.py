import glob
import os
from PIL import Image

d = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images"
lines = []

# 1) 办公楼插画重命名
for p in glob.glob(os.path.join(d, "*办公楼外观*.png")):
    base = os.path.basename(p)
    dst = os.path.join(d, "office-illus.png")
    if os.path.exists(dst):
        os.remove(dst)
    os.rename(p, dst)
    lines.append("RENAME %s -> office-illus.png" % base)

# 2) 裁掉右下角水印
CUT = 110
for n in ["nitrile-entrance.png", "pvc-entrance.png", "office-illus.png"]:
    p = os.path.join(d, n)
    if not os.path.exists(p):
        lines.append(n + " MISSING")
        continue
    im = Image.open(p).convert("RGB")
    w, h = im.size
    out = im.crop((0, 0, w, h - CUT))
    out.save(p)
    lines.append("%s: %dx%d -> %dx%d %dKB" % (n, w, h, out.size[0], out.size[1], os.path.getsize(p) // 1024))

with open(os.path.join(d, "_entrance_result.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) if lines else "NO MATCH")
