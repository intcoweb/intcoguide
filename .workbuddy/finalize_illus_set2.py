import glob
import os
from PIL import Image

d = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images"
lines = []

# 0) 删掉那张 prompt 里混进乱码的仓库图（已重生成替代）
for junk in glob.glob(os.path.join(d, "*ing_智能立体仓库与仓储物流中心外观*.png")) + glob.glob(os.path.join(d, "*internal*.png")):
    os.remove(junk)
    lines.append("DELETE " + os.path.basename(junk))

RULES = [
    ("*污水处理厂全景*", "sewage-illus.png"),
    ("*封闭式煤场*", "coal-illus.png"),
    ("*智能立体仓库内部*", "warehouse-illus.png"),
    ("*员工食堂餐厅*", "restaurant-illus.png"),
    ("*员工公寓宿舍小区*", "apartment-illus.png"),
]

CUT = 110
for pat, target in RULES:
    hits = glob.glob(os.path.join(d, pat + ".png"))
    if not hits:
        lines.append("NO MATCH " + pat)
        continue
    # 同一规则匹配到多张时取最新的一张
    hits.sort(key=os.path.getmtime)
    src = hits[-1]
    dst = os.path.join(d, target)
    if os.path.exists(dst):
        os.remove(dst)
    os.rename(src, dst)
    im = Image.open(dst).convert("RGB")
    w, h = im.size
    out = im.crop((0, 0, w, h - CUT))
    out.save(dst)
    lines.append("%s -> %s %dx%d %dKB" % (os.path.basename(src), target, out.size[0], out.size[1], os.path.getsize(dst) // 1024))
    print(target)

with open(os.path.join(d, "_illus_set_result.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
