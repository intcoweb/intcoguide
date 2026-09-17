import glob
import os

d = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\assets\images"
lines = []
for p in glob.glob(os.path.join(d, "*3D*立体仓库与仓储物流中心外观*.png")) + glob.glob(os.path.join(d, "*3D*".replace("3D", "3D") ) + "立体仓库与仓储物流中心外观*.png"):
    pass

# 精确按文件名删除那张 prompt 混了乱码的仓库图
for p in glob.glob(os.path.join(d, "*.png")):
    b = os.path.basename(p)
    if "立体仓库与仓储物流中心外观" in b:
        os.remove(p)
        lines.append("DELETE " + b)

with open(os.path.join(d, "_cleanup_result.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) if lines else "NOTHING DELETED")
