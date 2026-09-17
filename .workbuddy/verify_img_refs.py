import os
import re
import subprocess

root = r"C:\Users\INTCO\Desktop\桂校导航\web-guide"
node = r"C:\Users\INTCO\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
data = os.path.join(root, "js", "data.js")

lines = []
p = subprocess.run([node, "--check", data], capture_output=True, text=True, encoding="utf-8")
lines.append("node --check exit=%d %s" % (p.returncode, (p.stderr or "").strip()))

src = open(data, encoding="utf-8").read()
paths = sorted(set(re.findall(r'"img":\s*"([^"]+)"', src)))
lines.append("img refs count=%d" % len(paths))
missing = []
for rel in paths:
    fp = os.path.join(root, rel.replace("/", os.sep))
    ok = os.path.exists(fp)
    lines.append(("OK   " if ok else "MISS ") + rel)
    if not ok:
        missing.append(rel)
lines.append("MISSING TOTAL = %d" % len(missing))

html = open(os.path.join(root, "index.html"), encoding="utf-8").read()
m = re.search(r'data\.js\?v=([^"]+)', html)
lines.append("data.js cache version = %s" % (m.group(1) if m else "NONE"))

out = os.path.join(root, ".workbuddy", "verify_img_refs.txt")
open(out, "w", encoding="utf-8").write("\n".join(lines))
