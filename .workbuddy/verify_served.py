"""实拉 127.0.0.1:8000 校验服务端返回的就是新版（别只看本地文件）。"""
import io, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
log = []
def get(p):
    return urllib.request.urlopen('http://127.0.0.1:8000/' + p, timeout=20).read().decode('utf-8', 'replace')

try:
    h = get('index.html')
    log.append('index.html 引用 CSS v=20260916-13: %s' % ('v=20260916-13' in h))
    log.append('index.html 引用 app.js v=20260916-09: %s' % ('v=20260916-09' in h))

    c = get('css/style.css?v=20260916-13')
    for k in ['position: relative;', '.tap-hand {', '.tap-ripple {', 'border-right-color: currentColor',
              '@keyframes tapRipple', '@keyframes tapPress', 'animation-delay: -0.95s',
              'left: 7.125px', 'top: 2.6px']:
        log.append('css 含 %-38s %s' % (k, k in c))
    log.append('css 旧写法已无（label-tap 直接吃 fill）: %s'
               % ('.marker-label .label-tap {\n  width: 11px;\n  height: 11px;\n  margin-right: 2px;' not in c))

    j = get('js/app.js?v=20260916-09')
    log.append('js 含 label-tap 容器: %s' % ('<span class="label-tap" aria-hidden="true">' in j))
    log.append('js 波纹元素数（应为 2）: %d' % j.count('class="tap-ripple'))
    log.append('js 仍保留 pan_tool_alt path + rotate(90): %s'
               % ('rotate(90 12 12)' in j and 'm19.98 14.82' in j))
    log.append('js 旧 gesture-tap path 残留: %s' % ('C7.8,11.77 7,10.5 7,9A4,4 0 0,1 11,5Z' in j))
except Exception as e:
    log.append('FAIL: %r' % (e,))

with io.open(os.path.join(HERE, 'verify_served.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))
