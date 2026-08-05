"""对比本地与远程 tree 的文件 blob sha"""
import os, json, ssl, subprocess, urllib.request

ctx = ssl._create_unverified_context()
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
TOKEN = os.environ['GH_TOKEN']

def api(url):
    req = urllib.request.Request(url, headers={'Authorization': 'token ' + TOKEN, 'User-Agent': 'curl'})
    return json.loads(opener.open(req, timeout=30).read())

# 远程 HEAD
ref = api('https://api.github.com/repos/luckyboom1/yanxueku/git/ref/heads/master')
remote_sha = ref['object']['sha']
c = api('https://api.github.com/repos/luckyboom1/yanxueku/git/commits/' + remote_sha)
remote_tree_sha = c['tree']['sha']
tree = api('https://api.github.com/repos/luckyboom1/yanxueku/git/trees/' + remote_tree_sha)
remote_blobs = {i['path']: i['sha'] for i in tree['tree'] if i['type'] == 'blob'}
print('远程 master:', remote_sha)
print('远程 tree:', remote_tree_sha, '| %d 个文件' % len(remote_blobs))

# 本地 HEAD
out = subprocess.run(['git', 'ls-tree', 'HEAD'], capture_output=True, text=True, cwd=r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study').stdout
local_blobs = {}
for line in out.strip().splitlines():
    parts = line.split('\t')[0].split()
    local_blobs[line.split('\t')[1]] = parts[2]

print('本地 HEAD:', subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, cwd=r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study').stdout.strip())
print('本地 tree :', subprocess.run(['git', 'rev-parse', 'HEAD^{tree}'], capture_output=True, text=True, cwd=r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study').stdout.strip())

# 对比
all_paths = set(local_blobs) | set(remote_blobs)
diffs = []
for p in sorted(all_paths):
    lb, rb = local_blobs.get(p), remote_blobs.get(p)
    if lb != rb:
        diffs.append((p, lb[:10] if lb else '无', rb[:10] if rb else '无'))
if not diffs:
    print('✅ 本地与远程 tree 完全一致')
else:
    print('差异 %d 个:' % len(diffs))
    for p, lb, rb in diffs:
        print('  %-28s 本地:%s  远程:%s' % (p, lb, rb))
