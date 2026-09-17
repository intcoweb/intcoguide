import zipfile, os, sys

files = [r"C:\Users\INTCO\Downloads\网站开发组 (1).pptx",
         r"C:\Users\INTCO\Downloads\2026年度内销客户答谢会策划方案V1.pptx"]
lines = []
for f in files:
    if not os.path.exists(f):
        lines.append("MISSING " + f)
        continue
    lines.append("=== " + os.path.basename(f))
    try:
        z = zipfile.ZipFile(f)
        media = [n for n in z.namelist() if n.startswith("ppt/media/")]
        lines.append("  media count: %d" % len(media))
        for n in media[:40]:
            lines.append("   %s %dKB" % (n, z.getinfo(n).file_size // 1024))
    except Exception as e:
        lines.append("  ERROR %s" % e)

out = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\.workbuddy\ppt_media.txt"
with open(out, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))
