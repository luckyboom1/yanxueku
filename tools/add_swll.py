#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将「实务理论」（采访写作 + 评论）条目并入 public-library.json，
新建科目 pub-swll。幂等：重复运行替换已有科目。

数据来源：tools/_swll_cx_extract.txt（采访写作）、tools/_swll_pl_extract.txt（评论），
由 实务理论笔记_采访写作/评论_OCR.docx 提取。
结构：`XXX丨真经`（章头）→ 名词标题行 → `…重要性提醒：N星` → 【…】正文若干行。
OCR 修复：行首缺"采"（访活动→采访活动）、'普逼'→'普遍'、页眉噪声行。

用法（在仓库根目录）：python tools/add_swll.py
"""
import io, json, re, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, '..', 'public-library.json')
SOURCES = [
    (os.path.join(HERE, '_swll_cx_extract.txt'), '采访写作'),
    (os.path.join(HERE, '_swll_pl_extract.txt'), '评论'),
]

STAR = re.compile(r'重要性提醒\s*[:：]\s*([一二两三四五])星')
CHAP = re.compile(r'^(.{1,24}?)丨真经$')
NOISE = re.compile(r'^(新传考研真经同行\d*|@?20\d{2}真经.*|新传考研真经.*)$')
FIX = re.compile(r'(?<!采)访(活动|作风|类型|主体|流程|对象|技巧|方法|提纲|前的)')

def fix_ocr(s):
    s = FIX.sub(r'采\1', s)
    return s.replace('普逼', '普遍')

def parse(path, tag):
    lines = [fix_ocr(l.strip()) for l in io.open(path, encoding='utf-8')]
    lines = [l for l in lines if l and not NOISE.match(l)]
    # 第一遍：标记每行类型
    kinds = []
    for i, l in enumerate(lines):
        if CHAP.match(l):
            kinds.append('chapter')
        elif STAR.search(l):
            kinds.append('star')
        else:
            kinds.append('body')
    # 标题行 = star 行的前一行（若前一行也是 star 行则取再往前）
    cards = []
    i = 0
    while i < len(lines):
        if kinds[i] != 'star':
            i += 1
            continue
        star = STAR.search(lines[i]).group(1)
        t = i - 1
        while t >= 0 and kinds[t] == 'star':
            t -= 1
        if t < 0 or kinds[t] != 'body':
            i += 1
            continue
        title = lines[t]
        # 正文 = 标题行之后到下一个 chapter/star/title 前
        j = i + 1
        body = []
        while j < len(lines) and kinds[j] == 'body':
            body.append(lines[j])
            j += 1
        m = STAR.search(title)
        if m:   # 标题行本身粘连了星级（OCR 粘连），剥出星级
            star = m.group(1)
            title = STAR.sub('', title).strip()
        else:
            star = star
        title = title.strip()
        content = '\n'.join(body).strip()
        if title and len(title) >= 2 and len(content) >= 10:
            cards.append({'chapter': chapter_of(lines, t, kinds), 'title': title[:100],
                          'star': star, 'content': content[:20000],
                          'tags': ['实务理论', star + '星']})
        i = j if j > i else i + 1
    return cards

def chapter_of(lines, title_idx, kinds):
    for k in range(title_idx, -1, -1):
        m = CHAP.match(lines[k])
        if m:
            return m.group(1).strip()
    return '实务理论'

def main():
    allcards = []
    chapters = []
    for path, tag in SOURCES:
        for c in parse(path, tag):
            allcards.append(c)
    seen = set()
    uniq = []
    for c in allcards:
        key = c['chapter'] + '|' + c['title']
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
        if c['chapter'] not in chapters:
            chapters.append(c['chapter'])
    subject = {
        'id': 'pub-swll',
        'name': '实务理论',
        'color': '#ec4899',
        'exam': '新闻传播 · 采写评论实务',
        'icon': '✒️',
        'desc': '实务理论 · 采访写作与新闻评论，按星级分层',
        'cardCount': len(uniq),
        'chapters': chapters,
        'cards': uniq
    }
    with io.open(LIB, 'r', encoding='utf-8') as f:
        lib = json.load(f)
    lib['subjects'] = [s for s in lib['subjects'] if s['id'] != 'pub-swll']
    lib['subjects'].append(subject)
    total = sum(len(s.get('cards', [])) for s in lib['subjects'])
    lib['_version'] = lib.get('_version', 4) + 1
    lib['_description'] = '热门考研专业课知识卡片，共 %d 科 %d 张' % (len(lib['subjects']), total)
    with io.open(LIB, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lib, f, ensure_ascii=False, separators=(', ', ': '))
        f.write('\n')
    stars = Counter(c['star'] for c in uniq)
    print('merged pub-swll: %d cards, %d chapters' % (len(uniq), len(chapters)))
    print('stars:', dict(stars))
    print('library totals: %d subjects, %d cards' % (len(lib['subjects']), total))

if __name__ == '__main__':
    main()