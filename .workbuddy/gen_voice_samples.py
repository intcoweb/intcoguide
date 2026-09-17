# -*- coding: utf-8 -*-
"""用 edge-tts（微软神经语音）生成讲解音色样例。

输出：
  assets/audio/samples/<ShortName>.mp3   每种音色一段样例
  assets/audio/samples/voices.json       音色清单（供 voice-lab.html 读取）

用法：
  python gen_voice_samples.py                    # 生成全部中文音色样例
  python gen_voice_samples.py --only zh-CN-YunyangNeural,zh-CN-XiaoxiaoNeural
"""
import argparse
import asyncio
import json
import os
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "audio", "samples")

# 试音文本：故意混排中英文与数字，检验读音是否自然
SAMPLE_TEXT = (
    "欢迎来到安徽英科医疗。"
    "公司现有员工4000余人，丁腈手套有6个车间、共60条双线，日产6万箱；"
    "PVC手套6个车间，日产5.8万箱。"
    "产品远销美洲、欧洲、亚洲等120多个国家和地区。"
)

# 中文音色清单（顺序即展示顺序），desc 为人工标注的听感
VOICE_META = [
    ("zh-CN-YunyangNeural", "男", "专业稳重", "新闻播报腔，字正腔圆，正式讲解首选"),
    ("zh-CN-XiaoxiaoNeural", "女", "温暖亲切", "最自然耐听，通用首选"),
    ("zh-CN-YunjianNeural", "男", "浑厚激情", "纪录片解说感，气势足"),
    ("zh-CN-YunxiNeural", "男", "阳光清亮", "年轻男声，亲和路线"),
    ("zh-CN-XiaoyiNeural", "女", "活泼明亮", "语速轻快，适合轻松场景"),
    ("zh-CN-YunxiaNeural", "男", "童声可爱", "小男孩音色，正式场合不建议"),
    ("zh-CN-liaoning-XiaobeiNeural", "女", "东北话", "方言趣味，接待活跃气氛"),
    ("zh-CN-shaanxi-XiaoniNeural", "女", "陕西话", "方言趣味"),
    ("zh-TW-YunJheNeural", "男", "台湾腔", "台式国语"),
    ("zh-TW-HsiaoChenNeural", "女", "台湾腔", "台式国语"),
    ("zh-TW-HsiaoYuNeural", "女", "台湾腔", "台式国语"),
    ("zh-HK-WanLungNeural", "男", "粤语", "粤语讲解"),
    ("zh-HK-HiuGaaiNeural", "女", "粤语", "粤语讲解"),
    ("zh-HK-HiuMaanNeural", "女", "粤语", "粤语讲解"),
]

META_DICT = {v[0]: v[1:] for v in VOICE_META}


async def synth_one(voice, text, out_path, rate="+0%", pitch="+0Hz"):
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(out_path)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="", help="逗号分隔的音色短名，只生成这些")
    parser.add_argument("--rate", default="+0%")
    parser.add_argument("--pitch", default="+0Hz")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    try:
        all_voices = await edge_tts.list_voices()
    except Exception as e:  # 网络不通时给出明确提示
        print("LIST_VOICES_FAIL: %s" % e)
        sys.exit(1)

    available = {v["ShortName"]: v for v in all_voices}

    targets = [v[0] for v in VOICE_META]
    if args.only:
        targets = [t.strip() for t in args.only.split(",") if t.strip()]

    manifest = []
    for short in targets:
        meta = META_DICT.get(short)
        if short not in available:
            print("SKIP(not available): %s" % short)
            continue
        info = available[short]
        out_file = "%s.mp3" % short
        out_path = os.path.join(OUT_DIR, out_file)
        await synth_one(short, SAMPLE_TEXT, out_path, args.rate, args.pitch)
        size = os.path.getsize(out_path)
        gender, tag, desc = meta if meta else (info["Gender"], "", "")
        manifest.append({
            "short": short,
            "name": info["FriendlyName"],
            "gender": gender,
            "tag": tag,
            "desc": desc,
            "locale": info["Locale"],
            "file": "assets/audio/samples/" + out_file,
        })
        print("OK %-32s %6.1f KB" % (short, size / 1024.0))

    with open(os.path.join(OUT_DIR, "voices.json"), "w", encoding="utf-8") as f:
        json.dump({"text": SAMPLE_TEXT, "voices": manifest}, f, ensure_ascii=False, indent=2)
    print("TOTAL %d voices -> %s" % (len(manifest), OUT_DIR))


if __name__ == "__main__":
    asyncio.run(main())
