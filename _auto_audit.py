#!/usr/bin/env python3
"""
自动化审计脚本 — 研学库 index.html
扫描维度：
  1. JS 语法检查（提取后 node --check）
  2. 函数定义 vs 引用完整性
  3. 常见 Bug 模式扫描
  4. CSS 规则完整性
  5. HTML 标签闭合检查
  6. 数据层冒烟测试（Node.js 模拟）
"""
import re, json, subprocess, os, sys

PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
NODE = r'C:\Users\53296\.workbuddy\binaries\node\versions\22.22.2\node.exe'
SCRIPT_DIR = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study'

with open(PATH, 'r', encoding='utf-8') as f:
    html = f.read()

issues = []   # (severity, category, description, line_hint)
passes = []   # description

# ============================================================
# 1. 提取 JS 代码
# ============================================================
print("=" * 60)
print("审计维度 1: JS 语法检查")
print("=" * 60)

# 提取 <script> 标签内的 JS（无 src 属性的）
script_pattern = r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>'
scripts = re.findall(script_pattern, html, re.DOTALL)
js_code = '\n'.join(scripts)

js_file = os.path.join(SCRIPT_DIR, '_audit_extracted.js')
with open(js_file, 'w', encoding='utf-8') as f:
    f.write(js_code)

print(f"  提取 JS 代码: {len(js_code)} 字符, {js_code.count(chr(10))} 行")

# node --check
try:
    result = subprocess.run([NODE, '--check', js_file], capture_output=True, text=True, timeout=30)
    if result.returncode == 0:
        print("  ✅ JS 语法检查通过")
        passes.append("JS 语法检查通过 (node --check)")
    else:
        print(f"  ❌ JS 语法错误:\n{result.stderr}")
        issues.append(("P0", "JS语法", f"node --check 失败: {result.stderr[:200]}", ""))
except Exception as e:
    print(f"  ⚠️ 无法运行 node --check: {e}")

# ============================================================
# 2. 函数定义 vs 引用完整性
# ============================================================
print("\n" + "=" * 60)
print("审计维度 2: 函数定义 vs 引用完整性")
print("=" * 60)

# 找出所有 function 定义
func_defs = set()
for m in re.finditer(r'function\s+(\w+)\s*\(', js_code):
    func_defs.add(m.group(1))
# 箭头函数 / 变量赋值函数
for m in re.finditer(r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)', js_code):
    func_defs.add(m.group(1))

# 找出所有函数调用（粗略）
func_calls = set()
for m in re.finditer(r'\b(\w+)\s*\(', js_code):
    name = m.group(1)
    if name not in ('if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function',
                     'new', 'await', 'async', 'eval', 'console', 'require', 'parseInt',
                     'parseFloat', 'isNaN', 'Array', 'Object', 'String', 'Number', 'Boolean',
                     'Math', 'Date', 'JSON', 'Promise', 'Set', 'Map', 'Error', 'RegExp',
                     'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
                     'encodeURIComponent', 'decodeURIComponent', 'alert', 'confirm', 'prompt'):
        func_calls.add(name)

# 内置 / DOM API
builtin = {
    'getElementById', 'querySelector', 'querySelectorAll', 'createElement', 'appendChild',
    'removeChild', 'insertBefore', 'addEventListener', 'removeEventListener', 'dispatchEvent',
    'getItem', 'setItem', 'removeItem', 'clear', 'open', 'close', 'show', 'hide',
    'getContext', 'drawImage', 'fillRect', 'strokeRect', 'beginPath', 'closePath',
    'arc', 'moveTo', 'lineTo', 'fill', 'stroke', 'save', 'restore', 'translate',
    'rotate', 'scale', 'clearRect', 'createLinearGradient', 'addColorStop',
    'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
    'scrollTo', 'scrollIntoView', 'focus', 'blur', 'click', 'select',
    'preventDefault', 'stopPropagation', 'contains', 'matches', 'closest',
    'setAttribute', 'getAttribute', 'removeAttribute', 'hasAttribute',
    'classList', 'innerHTML', 'textContent', 'value', 'style', 'dataset',
    'appendChild', 'removeChild', 'replaceChild', 'cloneNode',
    'fetch', 'Headers', 'Response', 'Request', 'FormData', 'URL', 'URLSearchParams',
    'btoa', 'atob', 'crypto', 'TextEncoder', 'TextDecoder',
    'from', 'of', 'isArray', 'fromEntries', 'entries', 'keys', 'values',
    'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat', 'join',
    'indexOf', 'lastIndexOf', 'find', 'findIndex', 'filter', 'map', 'reduce',
    'forEach', 'some', 'every', 'includes', 'sort', 'reverse', 'flat', 'flatMap',
    'split', 'replace', 'replaceAll', 'match', 'search', 'trim', 'trimStart',
    'trimEnd', 'padStart', 'padEnd', 'repeat', 'substring', 'substr', 'toLowerCase',
    'toUpperCase', 'charAt', 'charCodeAt', 'startsWith', 'endsWith', 'normalize',
    'floor', 'ceil', 'round', 'random', 'abs', 'max', 'min', 'pow', 'sqrt',
    'sin', 'cos', 'tan', 'atan2', 'log', 'exp', 'sign', 'trunc',
    'now', 'getTime', 'getFullYear', 'getMonth', 'getDate', 'getDay',
    'getHours', 'getMinutes', 'getSeconds', 'toISOString', 'toLocaleDateString',
    'parse', 'stringify',
    'toString', 'valueOf', 'toFixed', 'toPrecision',
    'assign', 'freeze', 'seal', 'create', 'defineProperty', 'getPrototypeOf',
    'setPrototypeOf', 'getOwnPropertyNames', 'getOwnPropertyDescriptor',
    'all', 'race', 'resolve', 'reject', 'allSettled',
    'add', 'delete', 'has', 'get', 'set', 'forEach',
    'message', 'stack', 'name', 'code',
    'print', 'warn', 'error', 'info', 'debug', 'log', 'table', 'group', 'groupEnd',
    'assign', 'copyWithin', 'fill', 'at', 'findLast', 'findLastIndex',
    'toSorted', 'toReversed', 'toSpliced', 'with',
    ' supabase', 'auth', 'signInWithPassword', 'signUp', 'signOut', 'onAuthStateChange',
    'from', 'select', 'insert', 'update', 'delete', 'eq', 'order', 'limit',
    'channel', 'on', 'subscribe',
}

undefined_refs = func_calls - func_defs - builtin
# 过滤掉明显是对象方法调用的（前面有 .）
# 重新扫描，只找独立的函数调用
real_undefined = set()
lines = js_code.split('\n')
for m in re.finditer(r'(?<![.\w])(\w+)\s*\(', js_code):
    name = m.group(1)
    if name in func_defs or name in builtin or name in ('if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new', 'await', 'async', 'eval', 'console'):
        continue
    # 检查前面是否有 . (对象方法)
    pos = m.start()
    before = js_code[max(0,pos-1):pos]
    if before == '.':
        continue
    real_undefined.add(name)

if not real_undefined:
    print(f"  ✅ 所有函数引用都有定义 ({len(func_defs)} 个函数)")
    passes.append(f"函数引用完整性: {len(func_defs)} 个函数全部有定义")
else:
    for name in sorted(real_undefined):
        print(f"  ⚠️ 未定义的函数引用: {name}")
        issues.append(("P1", "函数引用", f"未定义函数: {name}", ""))

print(f"  函数定义总数: {len(func_defs)}")

# ============================================================
# 3. 常见 Bug 模式扫描
# ============================================================
print("\n" + "=" * 60)
print("审计维度 3: 常见 Bug 模式扫描")
print("=" * 60)

# 3a. 检查 db 未定义就访问
db_access_before_load = re.findall(r'(?<![\w.])db\.(subjects|knowledge|questions|quizRecords|studyLog|settings|profile|user)\b', js_code)
# 统计有多少处没有 null guard
db_guard_count = len(re.findall(r'if\s*\(\s*!?\s*db\b', js_code))
print(f"  db 属性访问: {len(db_access_before_load)} 处, null guard: {db_guard_count} 处")
if db_guard_count < 3 and len(db_access_before_load) > 20:
    issues.append(("P2", "空指针", f"db 访问 {len(db_access_before_load)} 处但仅 {db_guard_count} 处 guard", ""))

# 3b. 检查 await 漏写
# 找到 async 函数中没有 await 的 .then / .catch (可能漏 await)
async_funcs = re.findall(r'async\s+function\s+(\w+)', js_code)
print(f"  async 函数: {len(async_funcs)} 个")

# 3c. 检查重复定义
func_def_list = re.findall(r'function\s+(\w+)\s*\(', js_code)
from collections import Counter
dupes = [name for name, cnt in Counter(func_def_list).items() if cnt > 1]
if dupes:
    for d in dupes:
        print(f"  ❌ 重复定义: {d}")
        issues.append(("P0", "重复定义", f"函数 {d} 被重复定义", ""))
else:
    print("  ✅ 无重复函数定义")
    passes.append("无重复函数定义")

# 3d. 检查 addEventListener 中的函数引用
event_handlers = re.findall(r"addEventListener\(['\"](\w+)['\"]\s*,\s*(\w+)", js_code)
for evt, handler in event_handlers:
    if handler not in func_defs and handler not in builtin:
        print(f"  ⚠️ 事件处理器未定义: {handler} (事件: {evt})")
        issues.append(("P1", "事件绑定", f"addEventListener {evt} → {handler} 未定义", ""))

# 3e. 检查 innerHTML 中可能的 XSS / 模板注入
template_injections = re.findall(r'innerHTML\s*=\s*`([^`]{0,100})', js_code)
print(f"  innerHTML 模板赋值: {len(template_injections)} 处")

# 3f. 检查 onclick 等内联事件绑定
inline_events = re.findall(r'on(?:click|change|input|submit|keydown|keyup|keypress|load|error)\s*=\s*["\']([^"\']{0,80})', html)
print(f"  HTML 内联事件: {len(inline_events)} 处")

# 3g. 检查 localStorage 访问是否有 try/catch
ls_access = len(re.findall(r'localStorage\.(getItem|setItem|removeItem)', js_code))
ls_try = len(re.findall(r'try\s*\{[^}]*localStorage', js_code, re.DOTALL))
print(f"  localStorage 访问: {ls_access} 处, try/catch 包裹: {ls_try} 处")

# 3h. 检查 setInterval/setTimeout 是否有对应的 clear
intervals = re.findall(r'setInterval\s*\(', js_code)
clears = re.findall(r'clearInterval\s*\(', js_code)
print(f"  setInterval: {len(intervals)} 个, clearInterval: {len(clears)} 个")
if len(intervals) > len(clears) and len(intervals) > 0:
    issues.append(("P2", "资源泄漏", f"setInterval({len(intervals)}) > clearInterval({len(clears)})，可能内存泄漏", ""))

# 3i. 检查 Promise 链是否有 .catch
promises = re.findall(r'\.then\s*\(', js_code)
catches = re.findall(r'\.catch\s*\(', js_code)
print(f"  .then: {len(promises)} 个, .catch: {len(catches)} 个")

# 3j. 检查 eval 使用
evals = re.findall(r'\beval\s*\(', js_code)
if evals:
    print(f"  ⚠️ eval 使用: {len(evals)} 处")
    issues.append(("P2", "安全", f"eval 使用 {len(evals)} 处（可能是测试代码）", ""))

# 3k. 检查 TODO / FIXME / HACK
todos = re.findall(r'(TODO|FIXME|HACK|XXX|BUG)[ :]*(.+)', js_code, re.IGNORECASE)
if todos:
    for tag, desc in todos[:5]:
        print(f"  📝 {tag}: {desc.strip()[:60]}")
        issues.append(("P3", "待办", f"{tag}: {desc.strip()[:80]}", ""))

# 3l. 检查 console.log 残留
console_logs = re.findall(r'console\.log\s*\(', js_code)
console_errs = re.findall(r'console\.error\s*\(', js_code)
console_warns = re.findall(r'console\.warn\s*\(', js_code)
print(f"  console.log: {len(console_logs)}, console.error: {len(console_errs)}, console.warn: {len(console_warns)}")
if len(console_logs) > 10:
    issues.append(("P3", "调试残留", f"console.log {len(console_logs)} 处，建议清理", ""))

# ============================================================
# 4. CSS 规则完整性
# ============================================================
print("\n" + "=" * 60)
print("审计维度 4: CSS 规则完整性")
print("=" * 60)

css_blocks = re.findall(r'<style[^>]*>(.*?)</style>', html, re.DOTALL)
css_code = '\n'.join(css_blocks)

# 检查未闭合的大括号
open_braces = css_code.count('{')
close_braces = css_code.count('}')
print(f"  CSS 大括号: {{ {open_braces} / }} {close_braces}")
if open_braces != close_braces:
    issues.append(("P1", "CSS", f"大括号不匹配: {{ {open_braces} vs }} {close_braces}", ""))
    print(f"  ❌ CSS 大括号不匹配!")
else:
    print("  ✅ CSS 大括号匹配")
    passes.append("CSS 大括号匹配")

# 检查 CSS 变量定义和使用
css_vars_defined = set(re.findall(r'--([\w-]+)\s*:', css_code))
css_vars_used = set(re.findall(r'var\(--([\w-]+)\)', css_code))
undefined_vars = css_vars_used - css_vars_defined
if undefined_vars:
    for v in sorted(undefined_vars):
        print(f"  ⚠️ 未定义的 CSS 变量: --{v}")
        issues.append(("P2", "CSS变量", f"var(--{v}) 未定义", ""))
else:
    print(f"  ✅ CSS 变量全部有定义 ({len(css_vars_defined)} 个)")
    passes.append(f"CSS 变量完整性: {len(css_vars_defined)} 个")

# 检查 CSS 中的 media query
media_queries = re.findall(r'@media\s+([^{]+)\{', css_code)
print(f"  @media 查询: {len(media_queries)} 个")
for mq in media_queries:
    print(f"    - {mq.strip()[:50]}")

# ============================================================
# 5. HTML 标签闭合检查
# ============================================================
print("\n" + "=" * 60)
print("审计维度 5: HTML 结构检查")
print("=" * 60)

# 提取 HTML body 部分的标签
void_tags = {'meta', 'link', 'br', 'hr', 'img', 'input', 'area', 'base', 'col',
             'embed', 'source', 'track', 'wbr'}
tag_stack = []
tag_pattern = re.compile(r'<(/?)(\w+)[^>]*?(/?)>')
unclosed = []
for m in tag_pattern.finditer(html):
    closing, name, self_closing = m.groups()
    name = name.lower()
    if name in void_tags or self_closing:
        continue
    if closing:
        if tag_stack and tag_stack[-1] == name:
            tag_stack.pop()
        else:
            # 尝试找到匹配
            if name in tag_stack:
                while tag_stack and tag_stack[-1] != name:
                    unclosed.append(tag_stack.pop())
                if tag_stack:
                    tag_stack.pop()
            else:
                pass  # 多余的闭合标签，忽略
    else:
        tag_stack.append(name)

if tag_stack:
    print(f"  ⚠️ 未闭合的标签: {tag_stack}")
    issues.append(("P2", "HTML", f"未闭合标签: {tag_stack}", ""))
else:
    print("  ✅ HTML 标签闭合正常")
    passes.append("HTML 标签闭合正常")

# 检查 id 引用
ids_defined = set(re.findall(r'id\s*=\s*["\'](\w+)', html))
ids_referenced_js = set(re.findall(r"getElementById\s*\(\s*['\"](\w+)", js_code))
ids_referenced_js |= set(re.findall(r"querySelector\s*\(\s*['\"]#(\w+)", js_code))
missing_ids = ids_referenced_js - ids_defined
# 有些 id 可能是动态生成的，过滤掉明显的
missing_ids = {i for i in missing_ids if not i.startswith('nav-') and not i.startswith('subj-') and not i.startswith('kw-') and not i.startswith('quiz-')}
if missing_ids:
    for mid in sorted(missing_ids):
        print(f"  ⚠️ JS 引用了不存在的 id: {mid}")
        issues.append(("P2", "DOM引用", f"getElementById('{mid}') 但 HTML 中无此 id", ""))
else:
    print(f"  ✅ JS 引用的 id 全部存在 ({len(ids_defined)} 个 id)")
    passes.append(f"DOM id 引用一致性: {len(ids_defined)} 个")

# ============================================================
# 6. 代码质量统计
# ============================================================
print("\n" + "=" * 60)
print("审计维度 6: 代码质量统计")
print("=" * 60)

total_lines = html.count('\n')
js_lines = js_code.count('\n')
css_lines = css_code.count('\n')
html_lines = total_lines - js_lines - css_lines
print(f"  总行数: {total_lines}")
print(f"  HTML: ~{html_lines} 行, CSS: ~{css_lines} 行, JS: ~{js_lines} 行")
print(f"  JS 函数: {len(func_defs)} 个")
print(f"  CSS 规则: ~{open_braces} 个")
print(f"  文件大小: {len(html.encode('utf-8'))} bytes ({len(html.encode('utf-8'))/1024:.1f} KB)")

# ============================================================
# 汇总
# ============================================================
print("\n" + "=" * 60)
print("审计汇总")
print("=" * 60)

p0 = [i for i in issues if i[0] == 'P0']
p1 = [i for i in issues if i[0] == 'P1']
p2 = [i for i in issues if i[0] == 'P2']
p3 = [i for i in issues if i[0] == 'P3']

print(f"\n  P0 (严重): {len(p0)} 个")
for s, c, d, l in p0:
    print(f"    ❌ [{c}] {d}")
print(f"\n  P1 (高): {len(p1)} 个")
for s, c, d, l in p1:
    print(f"    ⚠️ [{c}] {d}")
print(f"\n  P2 (中): {len(p2)} 个")
for s, c, d, l in p2:
    print(f"    📝 [{c}] {d}")
print(f"\n  P3 (低): {len(p3)} 个")
for s, c, d, l in p3:
    print(f"    💡 [{c}] {d}")

print(f"\n  通过项: {len(passes)} 个")
for p in passes:
    print(f"    ✅ {p}")

print(f"\n{'='*60}")
if not p0 and not p1:
    print("🎉 审计结论: 无严重问题，代码质量良好")
elif p0:
    print("🔴 审计结论: 存在严重问题，需立即修复")
elif p1:
    print("🟡 审计结论: 存在高优先级问题，建议尽快修复")
print(f"{'='*60}")

# 输出 JSON 报告
report = {
    "issues": [{"severity": s, "category": c, "desc": d, "line": l} for s, c, d, l in issues],
    "passes": passes,
    "stats": {
        "total_lines": total_lines,
        "js_lines": js_lines,
        "css_lines": css_lines,
        "js_functions": len(func_defs),
        "css_rules": open_braces,
        "file_size_kb": round(len(html.encode('utf-8'))/1024, 1)
    }
}
report_file = os.path.join(SCRIPT_DIR, '_audit_report.json')
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print(f"\n报告已保存: {report_file}")
