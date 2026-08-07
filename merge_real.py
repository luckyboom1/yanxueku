import json

with open('public-library.json','r',encoding='utf-8') as f:
    data = json.load(f)

# Remove all placeholder cards
for s in data['subjects']:
    if s['id'] in ('pub-xwx','pub-cbx','pub-xwls','pub-xwsw'):
        s['cards'] = [c for c in s['cards'] if '\u5f85\u8865\u5145' not in c.get('content','')]
        s['cardCount'] = len(s['cards'])
        s['chapters'] = list(dict.fromkeys(c['chapter'] for c in s['cards']))

# Load real cards from gen_xw
from gen_xw import xw_new
s_xw = next(s for s in data['subjects'] if s['id']=='pub-xwx')
ex = {c['title'] for c in s_xw['cards']}
for c in xw_new:
    if c['title'] not in ex:
        s_xw['cards'].append(c); ex.add(c['title'])
s_xw['cardCount'] = len(s_xw['cards'])
s_xw['chapters'] = list(dict.fromkeys(c['chapter'] for c in s_xw['cards']))

data['_version'] = 4
with open('public-library.json','w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

for s in data['subjects']:
    real = sum(1 for c in s['cards'] if '\u5f85\u8865\u5145' not in c.get('content',''))
    print(f'{s["name"]:12s} total={len(s["cards"]):3d} real={real:3d}')
