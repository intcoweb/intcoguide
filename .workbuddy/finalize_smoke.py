import glob
import os
from PIL import Image

d = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images"
CUT = 110
lines = []

hits = sorted(glob.glob(os.path.join(d, "*烟气回收与余热利用设备区*.png")), key=os.path.getmtime)
if not hits:
    lines.append("NO MATCH")
else:
    src = hits[-1]
    dst = os.path.join(d, "smoke-illus.png")
    if os.path.exists(dst):
        os.remove(dst)
    os.rename(src, dst)
    im = Image.open(dst).convert("RGB")
    w, h = im.size
    out = im.crop((0, 0, w, h - CUT))
    out.save(dst)
    lines.append("%s -> smoke-illus.png %dx%d %dKB" % (os.path.basename(src), out.size[0], out.size[1], os.path.getsize(dst) // 1024))

with open(os.path.join(d, "_smoke_result.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
