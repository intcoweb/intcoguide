import os
from PIL import Image

d = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images"
names = ["nitrile-plant.png", "pvc-plant.png", "sewage-plant.png", "coal-yard.png", "warehouse.png"]

lines = []
for n in names:
    p = os.path.join(d, n)
    if not os.path.exists(p):
        lines.append(n + " MISSING")
        continue
    before = os.path.getsize(p)
    im = Image.open(p)
    w, h = im.size
    cut = 80
    out = im.crop((0, 0, w, h - cut))
    out.save(p)
    after = os.path.getsize(p)
    lines.append("%s: %dx%d %dKB -> %dx%d %dKB" % (n, w, h, before // 1024, out.size[0], out.size[1], after // 1024))

with open(os.path.join(d, "_trim_result.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
