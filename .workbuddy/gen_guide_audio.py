# -*- coding: utf-8 -*-
"""把 js/data.js 里的讲解词生成离线 MP3（微软神经语音 edge-tts）。

两种用法：
  1) 长段试听样例（给 voice-lab.html 用）：
     python gen_guide_audio.py --demo --voices zh-CN-YunyangNeural,zh-CN-XiaoxiaoNeural,zh-CN-YunjianNeural
     -> assets/audio/samples/long/<voice>.mp3  +  long.json

  2) 正式批量生成（选定音色后执行）：
     python gen_guide_audio.py --voice zh-CN-YunyangNeural
     -> assets/audio/guides/<voice>/<guideKey>_<idx>.mp3  +  manifest.json
     每个讲解段落单独一个文件，便于前端分段播放 / 高亮当前段。
"""
import argparse
import asyncio
import json
import os
import re
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(ROOT, "js", "data.js")
SAMPLES_DIR = os.path.join(ROOT, "assets", "audio", "samples")
LONG_DIR = os.path.join(SAMPLES_DIR, "long")
GUIDES_DIR = os.path.join(ROOT, "assets", "audio", "guides")

# edge-tts 7.x 固定输出 audio-24khz-48kbitrate-mono-mp3（与 Edge 朗读同规格），不支持 output_format
DEFAULT_VOICE = "zh-CN-YunyangNeural"


NODE_CANDIDATES = [
    r"C:\Users\INTCO\.workbuddy\binaries\node\versions\22.22.2-3\node.exe",
    r"C:\Program Files\nodejs\node.exe",
    "node",
]


def _dump_via_node(raw):
    """data.js 带尾逗号，严格 JSON 解析会失败；用 node 直接求值最稳"""
    import subprocess
    tmp = os.path.join(ROOT, ".workbuddy", "_dump_guides.cjs")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(
            "const fs=require('fs');\n"
            "const src=fs.readFileSync(%r,'utf8');\n"
            "const obj=eval(src.replace(/window\\.GLU_DATA\\s*=/,'var GLU_DATA =')+';GLU_DATA');\n"
            "process.stdout.write(JSON.stringify(obj.guides||{}));\n" % DATA_JS
        )
    last = None
    for node in NODE_CANDIDATES:
        try:
            r = subprocess.run([node, tmp], capture_output=True, timeout=60)
            if r.returncode == 0 and r.stdout:
                return json.loads(r.stdout.decode("utf-8"))
            last = r.stderr.decode("utf-8", "ignore")[:300]
        except Exception as e:
            last = str(e)
    raise RuntimeError("node 解析 data.js 失败：%s" % last)


def load_guides():
    """从 js/data.js 里剥出讲解词（window.GLU_DATA = {...};）"""
    with open(DATA_JS, "r", encoding="utf-8") as f:
        raw = f.read()
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < 0:
        raise RuntimeError("data.js 里找不到 JSON 主体")
    try:
        data = json.loads(raw[start:end + 1])
    except Exception:
        data = {"guides": _dump_via_node(raw)}
    return (data.get("guides") or {})


def guide_text(guide):
    """一个点位讲解的完整文本：标题 + 各段内容，段间用句号分隔"""
    parts = []
    if guide.get("subtitle"):
        parts.append(guide["subtitle"])
    for s in guide.get("sections") or []:
        t = (s.get("t") or "").strip()
        d = (s.get("d") or "").strip()
        parts.append((t + "。" if t else "") + d)
    return "。".join([p for p in parts if p])


async def synth(text, voice, out_path, rate="+0%", pitch="+0Hz"):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await comm.save(out_path)
    return os.path.getsize(out_path)


async def run_demo(voices, rate, pitch):
    guides = load_guides()
    exhibition = guides.get("exhibition")
    if not exhibition:
        print("NO_EXHIBITION_GUIDE")
        sys.exit(1)
    text = guide_text(exhibition)
    print("长段试听文本长度：%d 字" % len(text))

    out = []
    for v in voices:
        rel = "assets/audio/samples/long/%s.mp3" % v
        size = await synth(text, v, os.path.join(ROOT, rel), rate, pitch)
        out.append({"short": v, "file": rel, "title": "展厅讲解（完整）", "chars": len(text)})
        print("DEMO OK %-28s %6.1f KB" % (v, size / 1024.0))

    with open(os.path.join(LONG_DIR, "long.json"), "w", encoding="utf-8") as f:
        json.dump({"text": text, "items": out}, f, ensure_ascii=False, indent=2)
    print("LONG DEMO -> %s (%d)" % (LONG_DIR, len(out)))


async def run_full(voice, rate, pitch, only):
    guides = load_guides()
    keys = [k for k in guides.keys() if (not only or k in only)]
    manifest = {"voice": voice, "rate": rate, "pitch": pitch, "guides": {}}
    total = 0
    for key in keys:
        guide = guides[key]
        sections = guide.get("sections") or []
        files = []
        head = (guide.get("subtitle") or "").strip()
        bodies = []
        if head:
            bodies.append(head)
        for i, s in enumerate(sections):
            t = (s.get("t") or "").strip()
            d = (s.get("d") or "").strip()
            bodies.append(((t + "。") if t else "") + d)
        for i, body in enumerate(bodies):
            rel = "assets/audio/guides/%s/%s_%02d.mp3" % (voice, key, i)
            size = await synth(body, voice, os.path.join(ROOT, rel), rate, pitch)
            total += size
            files.append({"file": rel, "title": (sections[i - 1].get("t") if i > 0 else "导言") if i > 0 else "导言"})
            print("  %-24s %02d  %6.1f KB" % (key, i, size / 1024.0))
        manifest["guides"][key] = {"subtitle": head, "files": files}
    with open(os.path.join(GUIDES_DIR, voice, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    build_manifest_js()
    print("DONE voice=%s  guides=%d  total=%.1f MB" % (voice, len(keys), total / 1048576.0))


def build_manifest_js():
    """把 assets/audio/guides/<voice>/manifest.json 合并成一个 JS 清单。
    用 <script> 引入而不是 fetch，双击 index.html（file://）时也能播。"""
    merged = {}
    if os.path.isdir(GUIDES_DIR):
        for name in sorted(os.listdir(GUIDES_DIR)):
            p = os.path.join(GUIDES_DIR, name, "manifest.json")
            if os.path.isfile(p):
                with open(p, "r", encoding="utf-8") as f:
                    merged[name] = json.load(f)
    out = os.path.join(GUIDES_DIR, "manifest.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("window.GLU_GUIDE_AUDIO = window.GLU_GUIDE_AUDIO || {};\n")
        for name, m in merged.items():
            f.write("window.GLU_GUIDE_AUDIO[%s] = %s;\n" % (
                json.dumps(name), json.dumps(m, ensure_ascii=False)))
    return len(merged)


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--demo", action="store_true", help="生成长段试听样例")
    p.add_argument("--voices", default=DEFAULT_VOICE)
    p.add_argument("--voice", default=DEFAULT_VOICE)
    p.add_argument("--only", default="", help="逗号分隔的 guideKey，只生成这些")
    p.add_argument("--rate", default="+0%")
    p.add_argument("--pitch", default="+0Hz")
    args = p.parse_args()

    if args.demo:
        voices = [v.strip() for v in args.voices.split(",") if v.strip()]
        await run_demo(voices, args.rate, args.pitch)
    else:
        only = [k.strip() for k in args.only.split(",") if k.strip()]
        await run_full(args.voice, args.rate, args.pitch, only)


if __name__ == "__main__":
    asyncio.run(main())
