# -*- coding: utf-8 -*-
refs = [
 ('丁腈1', 33.8715103, 116.7215895, 588, 1329),
 ('丁腈2', 33.8733870, 116.7218035, 597, 1002),
 ('丁腈3', 33.8743027, 116.7218776, 580, 844),
 ('丁腈4', 33.8757470, 116.7216596, 563, 455),
 ('丁腈5', 33.8752524, 116.7252439, 1216, 486),
 ('丁腈6', 33.8748265, 116.7253122, 1210, 600),
 ('PVC1', 33.8724335, 116.7246800, 1057, 1201),
 ('PVC2', 33.8729818, 116.7247080, 1065, 1060),
 ('PVC3', 33.8710960, 116.7249762, 1074, 1497),
 ('PVC4', 33.8716245, 116.7249867, 1074, 1327),
 ('污水1', 33.8739749, 116.7249361, 1105, 762),
 ('污水2', 33.8739181, 116.7256200, 1216, 762),
 ('公寓', 33.8738756, 116.7264747, 1534, 733),
 ('办公室', 33.8722432, 116.7259619, 1389, 1193),
 ('大门', 33.8719310, 116.7266457, 1528, 1105),
]
def solve3(A, b):
    n = 3
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c and M[r][c] != 0:
                f = M[r][c] / M[c][c]
                for k in range(c, n + 1):
                    M[r][k] -= f * M[c][k]
    return [M[i][n] / M[i][i] for i in range(n)]
def fit(idx):
    A = [[0.0]*3 for _ in range(3)]; b = [0.0]*3
    for r in refs:
        v = [float(r[3]), float(r[4]), 1.0]; t = r[idx]
        for i in range(3):
            for j in range(3):
                A[i][j] += v[i]*v[j]
            b[i] += v[i]*t
    return solve3(A, b)
cl = fit(2); ca = fit(1)
worst = 0
for n, a, g, x, y in refs:
    el = g-(cl[0]*x+cl[1]*y+cl[2]); ea = a-(ca[0]*x+ca[1]*y+ca[2])
    worst = max(worst, abs(el), abs(ea))
    print(n, 'err_lng=%+.6f err_lat=%+.6f' % (el, ea))
print('worst', worst)
def px(x, y):
    return (round(ca[0]*x+ca[1]*y+ca[2], 7), round(cl[0]*x+cl[1]*y+cl[2], 7))
print('展厅', px(1432, 1241))
print('煤场一期', px(511, 1146))
print('煤场二期', px(528, 580))
print('烟气回收', px(898, 1219))
print('仓库', px(358, 849))
