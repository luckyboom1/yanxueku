import json

with open('public-library.json','r',encoding='utf-8') as f:
    data = json.load(f)

# Load patch data
with open('patch_cb.json','r',encoding='utf-8') as f:
    new_cb = json.load(f)
with open('patch_xwls.json','r',encoding='utf-8') as f:
    new_xwls = json.load(f)
with open('patch_xwsw.json','r',encoding='utf-8') as f:
    new_xwsw = json.load(f)

# Extract original xwcb
xwcb = next(s for s in data['subjects'] if s['id']=='pub-xwcbx')
all_cards = xwcb['cards']

# Split by chapter
xw_chapters = ['新闻学理论','媒介与社会','广播电视','新媒体研究']
cb_chapters = ['传播学基础','传播效果','传播学史','广告与公关']
xw_cards = [c for c in all_cards if c['chapter'] in xw_chapters]
cb_cards = [c for c in all_cards if c['chapter'] in cb_chapters]
cb_cards_all = cb_cards + new_cb

# Build new subjects
xw = {"id":"pub-xwx","name":"新闻学","color":"#f59e0b","exam":"新闻学考研","icon":"📰","desc":"新闻理论、媒介与社会、广播电视与新媒体","cardCount":len(xw_cards),"chapters":list(dict.fromkeys(c['chapter'] for c in xw_cards)),"cards":xw_cards}
cb = {"id":"pub-cbx","name":"传播学","color":"#6366f1","exam":"传播学考研","icon":"📡","desc":"传播学理论、效果研究、学派比较与新媒体舆论","cardCount":len(cb_cards_all),"chapters":list(dict.fromkeys(c['chapter'] for c in cb_cards_all)),"cards":cb_cards_all}
xwls = {"id":"pub-xwls","name":"中外新闻史","color":"#ef4444","exam":"新闻传播学考研","icon":"📜","desc":"中外新闻事业发展历程、重要报刊报人与事件","cardCount":len(new_xwls),"chapters":list(dict.fromkeys(c['chapter'] for c in new_xwls)),"cards":new_xwls}
xwsw = {"id":"pub-xwsw","name":"新闻实务","color":"#10b981","exam":"新闻传播学考研","icon":"✏️","desc":"新闻采访、写作、编辑、评论与伦理法规","cardCount":len(new_xwsw),"chapters":list(dict.fromkeys(c['chapter'] for c in new_xwsw)),"cards":new_xwsw}

# Replace: remove xwcb, add 4 new
new_subjects = []
for s in data['subjects']:
    if s['id'] == 'pub-xwcbx':
        new_subjects.extend([xw, cb, xwls, xwsw])
    else:
        new_subjects.append(s)
data['subjects'] = new_subjects

data['_description'] = '十三大热门考研专业课知识卡片，点击即可导入到个人科目'
data['_version'] = 2

with open('public-library.json','w',encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

total = sum(len(s['cards']) for s in new_subjects)
print(f"Total subjects: {len(new_subjects)}, Total cards: {total}")
for s in new_subjects:
    print(f"  {s['id']:15s} {s['name']:12s} cards={len(s['cards']):3d}")
