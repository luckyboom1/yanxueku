"""用 Contents API 推送单个文件（创建 _git_api_push.py 到远程）"""
import base64, json, os, ssl, urllib.request

ctx = ssl._create_unverified_context()
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
TOKEN = os.environ.get('GH_TOKEN')
if not TOKEN:
    print('缺少 GH_TOKEN')
    raise SystemExit(1)

OWNER, REPO = 'luckyboom1', 'yanxueku'
path = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\_git_api_push.py'
with open(path, 'rb') as f:
    content = base64.b64encode(f.read()).decode()

url = 'https://api.github.com/repos/%s/%s/contents/%s' % (OWNER, REPO, '_git_api_push.py')
payload = {
    'message': 'chore: 新增 git API 推送工具（token 走环境变量）',
    'content': content,
    'branch': 'master'
}
req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='PUT', headers={
    'Authorization': 'token ' + TOKEN, 'User-Agent': 'curl', 'Content-Type': 'application/json'})
try:
    r = opener.open(req, timeout=60)
    d = json.loads(r.read().decode())
    print('✅ 已创建 _git_api_push.py, commit:', d.get('commit', {}).get('sha', '?')[:10])
except urllib.error.HTTPError as e:
    body = e.read().decode(errors='replace')
    print('!! HTTP %s: %s' % (e.code, body[:300]))
    raise
