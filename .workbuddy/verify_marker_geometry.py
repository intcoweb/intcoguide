# -*- coding: utf-8 -*-
"""从真实 style.css 解析 marker 几何（含 --pin-* 变量），校验：
   1) .marker-pin 的圆头圆心
   2) .marker-pulse 的圆心（呼吸光圈）
   3) 两者是否同心
   4) 针尖位置是否保持在缩小前的位置（点位不位移）
用法: python verify_marker_geometry.py
"""
import io, re, math

CSS = r"C:\Users\INTCO\Desktop\桂校导航\web-guide\css\style.css"
css = io.open(CSS, encoding="utf-8").read()


def rule(selector):
    m = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", css)
    return m.group(1) if m else ""


def block(name):
    """取某个 @keyframes 的完整内容"""
    m = re.search(r"@keyframes\s+" + name + r"\s*\{(.*?)\n\}", css, re.S)
    return m.group(1) if m else ""


CONTAINER = rule(".campus-marker")
PIN = rule(".campus-marker .marker-pin")
PULSE = rule(".marker-pulse")

# --- 解析变量 ---
VARS = {}
for m in re.finditer(r"--([\w-]+)\s*:\s*([^;]+);", CONTAINER):
    VARS["--" + m.group(1)] = m.group(2).strip()

PIN_SIZE = float(re.sub(r"[^\d.]", "", VARS.get("--pin-size", "26")))
PIN_LEFT = float(re.sub(r"[^\d.]", "", VARS.get("--pin-left", "7")))
PIN_TOP = float(re.sub(r"[^\d.]", "", VARS.get("--pin-top", "0")))
BORDER = float(re.search(r"border:\s*([\d.]+)px", PIN).group(1))

# --- 旧基准（缩小前的 26px pin，用于对比针尖是否位移）---
OLD_SIZE = 26.0
OLD_BORDER = 2.0
OLD_TIP_X = 7.0 + OLD_SIZE / 2
OLD_TIP_Y = OLD_SIZE / 2 + OLD_SIZE * math.sqrt(2) / 2


def resolve(expr, default=0.0):
    e = expr.strip()
    m = re.fullmatch(r"var\((--[\w-]+)(?:,\s*([-\d.]+)px)?\)", e)
    if m:
        return float(re.sub(r"[^\d.-]", "", VARS.get(m.group(1), m.group(2) or "0")))
    return float(re.sub(r"[^\d.-]", "", e) or default)


PULSE_LEFT = resolve(re.search(r"left:\s*([^;]+);", PULSE).group(1))
PULSE_TOP = resolve(re.search(r"top:\s*([^;]+);", PULSE).group(1))
PULSE_W = resolve(re.search(r"width:\s*([^;]+);", PULSE).group(1))
PULSE_H = resolve(re.search(r"height:\s*([^;]+);", PULSE).group(1))
PIN_SIZE_CSS = resolve(re.search(r"width:\s*([^;]+);", PIN).group(1))

# --- pin 圆头圆心：border-box 中心（-45° 旋转绕该点，坐标不变）---
pin_cx = PIN_LEFT + PIN_SIZE_CSS / 2
pin_cy = PIN_TOP + PIN_SIZE_CSS / 2

# --- 光圈圆心：box 中心（::before/::after inset:0 + border-radius:50%）---
pulse_cx = PULSE_LEFT + PULSE_W / 2
pulse_cy = PULSE_TOP + PULSE_H / 2

# --- 针尖：圆头圆心 + 沿轴线 √2·r ---
tip_x = pin_cx
tip_y = pin_cy + PIN_SIZE_CSS * math.sqrt(2) / 2

print("变量         --pin-size=%s --pin-left=%s --pin-top=%s  (pin border=%.2fpx)"
      % (VARS.get("--pin-size"), VARS.get("--pin-left"), VARS.get("--pin-top"), BORDER))
print("pin          盒子 (%.1f,%.1f) %.1f×%.1f → 圆头圆心 (%.2f, %.2f), 可见直径 %.1fpx"
      % (PIN_LEFT, PIN_TOP, PIN_SIZE_CSS, PIN_SIZE_CSS, pin_cx, pin_cy, PIN_SIZE_CSS))
print("光圈         盒子 (%.1f,%.1f) %.1f×%.1f → 圆心 (%.2f, %.2f)"
      % (PULSE_LEFT, PULSE_TOP, PULSE_W, PULSE_H, pulse_cx, pulse_cy))
print("同心校验     偏移 dx=%+.3f px, dy=%+.3f px"
      % (pulse_cx - pin_cx, pulse_cy - pin_cy))
print("针尖位置     (%.2f, %.2f)   缩小前基准 (%.2f, %.2f)   位移 %+.2f px"
      % (tip_x, tip_y, OLD_TIP_X, OLD_TIP_Y, tip_y - OLD_TIP_Y))

# --- 动画关键帧 ---
pulse_kf = block("markerPulse")
delays = re.findall(r"animation-delay:\s*([^;]+);", PULSE + rule(".marker-pulse::after"))
kf_scale = re.findall(r"scale\(([\d.]+)\)", pulse_kf)
print("光圈动画      起始 scale=%s → 最大 scale=%s（可见直径 %.1f → %.1f px）"
      % (kf_scale[0], kf_scale[-1],
         PIN_SIZE_CSS * float(kf_scale[0]), PIN_SIZE_CSS * float(kf_scale[-1])))

rm = re.search(r"@media \(prefers-reduced-motion: reduce\)\s*\{(.*?)\n\}", css, re.S)
rm_body = rm.group(1) if rm else ""
print("降级分支      存在=%s  仅用 opacity 呼吸=%s  静态基础 opacity=%s"
      % (bool(rm),
         "markerGlow" in rm_body,
         "opacity: 0" not in rm_body))

ok = abs(pulse_cx - pin_cx) < 0.001 and abs(pulse_cy - pin_cy) < 0.001
print("\nRESULT: 光圈与 pin 圆心重合 = %s" % ok)

# --- pin 中心小白点（::after）---
DOT = rule(".campus-marker:not(.start):not(.end) .marker-pin::after")
if not DOT:
    print("圆点         未找到规则")
else:
    def val(prop):
        m = re.search(prop + r":\s*([^;]+);", DOT)
        if not m:
            return None
        e = m.group(1).strip()
        if m2 := re.fullmatch(r"calc\(var\(--pin-size\)\s*\*\s*([-\d.]+)\)", e):
            return PIN_SIZE_CSS * float(m2.group(1))
        if e.endswith("%"):
            return float(e[:-1]) / 100.0
        return float(re.sub(r"[^\d.-]", "", e))

    dw, dx_raw, dy_raw = val("width"), val("left"), val("top")
    m = re.search(r"margin:\s*calc\(var\(--pin-size\)\s*\*\s*([-\d.]+)\)", DOT)
    dmx = PIN_SIZE_CSS * float(m.group(1)) if m else 0.0
    # 绝对定位子元素以内边距盒为参照：偏移基准 = border
    pad = PIN_SIZE_CSS - 2 * BORDER
    dot_cx = BORDER + pad * dx_raw + dmx + dw / 2
    dot_cy = BORDER + pad * dy_raw + dmx + dw / 2
    print("圆点         直径 %.2fpx  → pin 局部圆心 (%.2f, %.2f)   pin 局部中心 (%.2f, %.2f)  偏移 (%+.3f, %+.3f)px"
          % (dw, dot_cx, dot_cy, PIN_SIZE_CSS / 2, PIN_SIZE_CSS / 2,
             dot_cx - PIN_SIZE_CSS / 2, dot_cy - PIN_SIZE_CSS / 2))
    print("RESULT: 圆点与 pin 圆心重合 = %s"
          % (abs(dot_cx - PIN_SIZE_CSS / 2) < 0.001 and abs(dot_cy - PIN_SIZE_CSS / 2) < 0.001))

# --- 工厂大门是否已改回普通点位样式（不应再有任何 .gate 规则）---
gate_rules = re.findall(r"\.campus-marker\.gate[^{]*\{", css)
print("工厂大门样式  残留 .gate 规则 %d 条（应为 0，已改为与普通点位同款）" % len(gate_rules))
