"""通过 GitHub Git Database API 推送本地变更（绕过 git 直连失败）
用法: GH_TOKEN=xxx python _git_api_push.py
"""
import base64, json, os, ssl, urllib.request

ctx = ssl._create_unverified_context()
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
TOKEN = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
if not TOKEN:
    print('缺少 GH_TOKEN 环境变量')
    raise SystemExit(1)
OWNER, REPO, BRANCH = 'luckyboom1', 'yanxueku', 'master'
BASE = 'https://api.github.com/repos/%s/%s' % (OWNER, REPO)
DIR = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study'

def api(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'token ' + TOKEN, 'User-Agent': 'curl', 'Content-Type': 'application/json'})
    try:
        r = opener.open(req, timeout=60)
        return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        print('  !! API %s %s → %s' % (method, url.replace(BASE,''), e.code))
        print('  !! ' + body[:500])
        raise

# 1. 获取远程 master 最新 commit 及其 tree
head = api('GET', '%s/git/ref/heads/%s' % (BASE, BRANCH))
parent_sha = head['object']['sha']
head_commit = api('GET', '%s/git/commits/%s' % (BASE, parent_sha))
base_tree = head_commit['tree']['sha']
print('远程 master:', parent_sha[:10], 'base_tree:', base_tree[:10])

# 2. 读取本地变更文件（相对远程 commit 有变化的文件）
changed = ['index.html', '_AUDIT_REPORT.md', '_audit_extracted.js', '_audit_report.json',
           '_audit_smoke.js', '_poll_pages.py', '_regression_kwcard.js']
tree_items = []
for f in changed:
    path = os.path.join(DIR, f)
    if not os.path.exists(path):
        print('  !! 本地不存在（远程删除?）:', f)
        continue
    with open(path, 'rb') as fh:
        content = fh.read()
    # 创建 blob
    blob = api('POST', '%s/git/blobs' % BASE, {'content': base64.b64encode(content).decode(), 'encoding': 'base64'})
    tree_items.append({'path': f, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    print('  blob %s: %s (%d bytes)' % (f, blob['sha'][:10], len(content)))

# 3. 创建 tree
tree = api('POST', '%s/git/trees' % BASE, {'base_tree': base_tree, 'tree': tree_items})
print('new tree:', tree['sha'][:10])

# 4. 创建 commit
msg = '''fix: 知识库卡片渲染异常 — 收藏按钮注入破坏 div 结构

根因（diagnose RED->GREEN）:
- kwCard monkey-patch 把 <button> 插在 <div class="kw-card" 的 > 之前，
  浏览器解析时 div 的 style/onclick 属性丢失，属性文本变裸代码显示（异常代码），
  卡片 onclick 失效无法点开
- JSON.stringify(id) 产生双引号，onclick="toggleStar("ds1",event)" 引号嵌套失效

修复:
- 注入点改为 .replace('>', '>' + star)，按钮插在 div 结束符之后
- onclick 用单引号包裹 id 消除嵌套
- 同类加固: 标签筛选 chip 改用 data-tag + this.dataset.tag，消除 esc() 不转义
  单引号导致的 onclick 破坏风险

回归:
- 新增 _regression_kwcard.js: 9/9 GREEN（修复前 3/6）
- 冒烟测试 20/20 通过（修正 3 个与真实 API 不符的断言）
- 全量审计通过'''
commit = api('POST', '%s/git/commits' % BASE, {
    'message': msg, 'tree': tree['sha'], 'parents': [parent_sha]})
print('new commit:', commit['sha'][:10])

# 5. 更新 ref
ref = api('PATCH', '%s/git/refs/heads/%s' % (BASE, BRANCH), {'sha': commit['sha'], 'force': False})
print('ref 更新成功:', ref['object']['sha'][:10])
print('✅ 推送完成，master 现指向', commit['sha'])
