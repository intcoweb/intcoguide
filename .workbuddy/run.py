"""运行目标脚本并把 stdout/stderr/traceback 以 UTF-8 写到文件（本会话 PowerShell 不回传 stdout）。"""
import io, os, sys, traceback, runpy

HERE = os.path.dirname(os.path.abspath(__file__))
target = sys.argv[1] if len(sys.argv) > 1 else 'tap_guide2.py'
out = os.path.join(HERE, 'run_out.txt')
buf = io.StringIO()
old = sys.stdout
try:
    sys.stdout = buf
    sys.path.insert(0, HERE)
    runpy.run_path(os.path.join(HERE, target), run_name='__main__')
    buf.write('\n[OK] finished\n')
except BaseException:
    buf.write('\n[FAIL]\n' + traceback.format_exc())
finally:
    sys.stdout = old
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write(buf.getvalue())
    files = sorted(f for f in os.listdir(HERE) if f.endswith(('.png', '.txt', '.json')))
    with io.open(out, 'a', encoding='utf-8') as f:
        f.write('\nfiles: ' + ', '.join(files) + '\n')
