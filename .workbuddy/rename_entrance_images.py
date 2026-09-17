import glob
import os

d = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images"
lines = []
for p in glob.glob(os.path.join(d, "*生产车间入口外观*.png")):
    base = os.path.basename(p)
    target = "pvc-entrance.png" if "PVC" in base else "nitrile-entrance.png"
    dst = os.path.join(d, target)
    if os.path.exists(dst):
        os.remove(dst)
    os.rename(p, dst)
    lines.append("%s -> %s (%dKB)" % (base, target, os.path.getsize(dst) // 1024))

with open(os.path.join(d, "_rename_result.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) if lines else "NO FILE MATCHED")
