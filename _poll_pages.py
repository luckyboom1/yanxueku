import os, time, urllib.request, json, ssl
ctx = ssl._create_unverified_context()
# 禁用代理（本机代理 127.0.0.1:7897 间歇性不可用）
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
TOKEN = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
if not TOKEN:
    print('缺少 GH_TOKEN 环境变量')
    raise SystemExit(1)
url = 'https://api.github.com/repos/luckyboom1/yanxueku/pages/builds/latest'
for i in range(12):
    time.sleep(15)
    try:
        req = urllib.request.Request(url, headers={'Authorization': 'token ' + TOKEN, 'User-Agent': 'curl'})
        data = json.loads(opener.open(req, timeout=20).read())
        status = data.get('status')
        print('[%d] %s' % (i + 1, status), flush=True)
        if status in ('deployed', 'errored'):
            print(json.dumps({k: data.get(k) for k in ('status', 'commit', 'error')}, ensure_ascii=False))
            break
    except Exception as e:
        print('[%d] query error: %s' % (i + 1, e), flush=True)
