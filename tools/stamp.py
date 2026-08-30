#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""研学库 版本戳工具 —— 把 CODE_REVIEW §3.5 的"五处手工核对"变成机器断言

用法：
  python tools/stamp.py check                 # 校验版本戳一致性（发版前 / CI 必跑）
  python tools/stamp.py bump 3.0.0-beta.22    # 将全部版本戳改到目标版本

覆盖的位置：
  1. core.js     const APP_VERSION = 'vX.Y.Z'
  2. index.html  var __APP_VERSION = "X.Y.Z"
  3. index.html  全部 ?v=X.Y.Z 查询串（样式与脚本）
  4. sw.js       const CACHE = 'yanxueku-vN'（bump 时自动 +1；check 时报告供人工确认）
不覆盖（有意）：
  5. views.js PLIB_VER —— 仅公共课程库数据变更时才 bump，不随应用版本走（§3.5 第 5 条）

退出码：0 = 通过；非 0 = 发现不一致或参数错误。
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(name):
    with io.open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return f.read()


def write(name, text):
    with io.open(os.path.join(ROOT, name), 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def current_version():
    m = re.search(r"const APP_VERSION = 'v([^']+)'", read('core.js'))
    if not m:
        sys.exit('✗ 无法从 core.js 解析 APP_VERSION')
    return m.group(1)


def check():
    ver = current_version()
    problems = []
    print('当前版本：v' + ver)

    html = read('index.html')
    m = re.search(r'var __APP_VERSION = "([^"]+)"', html)
    if not m or m.group(1) != ver:
        problems.append('index.html __APP_VERSION 不一致：%s' % (m.group(1) if m else '未找到'))

    qv = re.findall(r'\?v=([0-9][^"\'>\s]*)', html)
    bad_qv = [v for v in qv if v != ver]
    if not qv:
        problems.append('index.html 没有任何 ?v= 版本戳')
    elif bad_qv:
        problems.append('index.html 存在 %d 处过期 ?v=：%s' % (len(bad_qv), sorted(set(bad_qv))))
    else:
        print('  ✓ index.html __APP_VERSION 与 %d 处 ?v= 全部一致' % len(qv))

    old_hits = [ln for ln in html.splitlines() if 'beta.' in ln and ver not in ln and ('?v=' in ln or '__APP_VERSION' in ln)]
    if old_hits:
        problems.append('index.html 仍有旧版本残留行')

    sw = read('sw.js')
    msw = re.search(r"const CACHE = 'yanxueku-v(\d+)'", sw)
    if not msw:
        problems.append('sw.js CACHE 解析失败')
    else:
        print('  ✓ sw.js CACHE = yanxueku-v%s（人工确认：内容变更时应较上次 +1）' % msw.group(1))

    msv = re.search(r"var PLIB_VER = '([^']+)'", read('views.js'))
    if msv:
        print('  ✓ views.js PLIB_VER = %s（仅公共库数据变更时随数据 bump，不随应用版本）' % msv.group(1))

    if problems:
        for p in problems:
            print('  ✗ ' + p)
        print('stamp check: FAIL')
        return 1
    print('stamp check: PASS ✓')
    return 0


def bump(target):
    if not re.match(r'^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$', target):
        sys.exit('✗ 目标版本格式不合法：%s（示例：3.0.0-beta.22）' % target)
    old = current_version()
    if old == target:
        sys.exit('✗ 目标版本与当前相同（v%s），无需 bump' % old)

    core = read('core.js')
    core = core.replace("const APP_VERSION = 'v%s'" % old, "const APP_VERSION = 'v%s'" % target, 1)
    write('core.js', core)

    html = read('index.html')
    n_qv = html.count('?v=' + old)
    html = html.replace('?v=' + old, '?v=' + target)
    html = html.replace('var __APP_VERSION = "%s"' % old, 'var __APP_VERSION = "%s"' % target, 1)
    write('index.html', html)

    sw = read('sw.js')
    m = re.search(r"const CACHE = 'yanxueku-v(\d+)'", sw)
    if m:
        n = int(m.group(1)) + 1
        sw = sw.replace("const CACHE = 'yanxueku-v%d'" % (n - 1), "const CACHE = 'yanxueku-v%d'" % n, 1)
        write('sw.js', sw)
        print('  sw.js CACHE → yanxueku-v%d' % n)

    print('bump: v%s → v%s（core.js APP_VERSION、index.html __APP_VERSION + %d 处 ?v=、sw.js CACHE）'
          % (old, target, n_qv))
    print('提醒：views.js PLIB_VER 未动——公共库数据有变更时请手动随数据 bump。')
    return check()


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')   # Windows 中文控制台默认 GBK，✓/✗ 会编码失败
    except Exception:
        pass
    if len(sys.argv) == 2 and sys.argv[1] == 'check':
        sys.exit(check())
    if len(sys.argv) == 3 and sys.argv[1] == 'bump':
        sys.exit(bump(sys.argv[2]))
    sys.exit(__doc__)


if __name__ == '__main__':
    main()
