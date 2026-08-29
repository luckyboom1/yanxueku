import json, sys

subject_id = sys.argv[1]
patch_file = sys.argv[2]

with open('../public-library.json','r',encoding='utf-8') as f:
    data = json.load(f)

with open(patch_file,'r',encoding='utf-8') as f:
    new_cards = json.load(f)

for s in data['subjects']:
    if s['id'] == subject_id:
        existing = {c['title'] for c in s['cards']}
        added = 0
        for c in new_cards:
            if c['title'] not in existing:
                s['cards'].append(c); existing.add(c['title']); added += 1
        s['cardCount'] = len(s['cards'])
        s['chapters'] = list(dict.fromkeys(c['chapter'] for c in s['cards']))
        print(f'{s["name"]}: +{added} = {s["cardCount"]} total')
        break

with open('../public-library.json','w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)
