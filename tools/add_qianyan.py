#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将「前沿名词解释」条目并入 public-library.json。

数据来源：tools/_qianyan_extract.txt（由 前沿名解_OCR_clean.docx 提取的逐行文本）。
条目格式：标题行 `名词  真经重要性提醒：N星`（N 可为 一/两/三/四/五），
正文为若干行，段落标记用【…】。
章节按重要星级分层：五星必背 / 四星重点 / 三星常考 / 两星拓展 / 一星了解。
幂等：重复运行会替换已有的 pub-qianyan 科目。

用法（在仓库根目录）：python tools/add_qianyan.py
"""
import io, json, re, os

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, '..', 'public-library.json')
SRC = os.path.join(HERE, '_qianyan_extract.txt')

ENTRY = re.compile(r'^(.{1,50}?)\s{2,}真经重要性提醒：([一二两三四五])星$')
PAGE = re.compile(r'^—— 第 \d+ 页 ——$')
MARK = re.compile(r'^(【[^】]{1,12}】)(.*)$')

CHAPTER = {'五': '五星 · 必背', '四': '四星 · 重点', '三': '三星 · 常考', '两': '两星 · 拓展', '一': '一星 · 了解'}

def clean_title(t):
    t = t.strip()
    if t.endswith('》》'):          # OCR 瑕疵：书名号重复
        t = t[:-1]
    return t[:100]

def fmt_body(lines):
    out = []
    for l in lines:
        m = MARK.match(l)
        out.append(('\n**' + m.group(1) + '**' + m.group(2)) if m else l)
    return '\n'.join(out).strip()

def parse():
    lines = [l.rstrip('\n') for l in io.open(SRC, encoding='utf-8')]
    entries, cur = [], None
    for l in lines:
        if PAGE.match(l):
            continue
        m = ENTRY.match(l)
        if m:
            cur = {'title': clean_title(m.group(1)), 'star': m.group(2), 'body': []}
            entries.append(cur)
        elif cur is not None:
            cur['body'].append(l)
    cards = []
    for e in entries:
        if not e['title']:
            continue
        content = fmt_body(e['body'])
        if len(content) < 10:
            continue
        cards.append({
            'chapter': CHAPTER.get(e['star'], '名词解释'),
            'title': e['title'],
            'content': content,
            'tags': ['前沿名解', e['star'] + '星']
        })
    return cards

def main():
    cards = parse()
    chapters = []
    for c in cards:
        if c['chapter'] not in chapters:
            chapters.append(c['chapter'])
    subject = {
        'id': 'pub-qianyan',
        'name': '前沿名词解释',
        'color': '#10b981',
        'exam': '新闻传播 · 前沿理论专项',
        'icon': '🚀',
        'desc': '前沿名词解释 · 智媒时代前沿概念，按星级分层',
        'cardCount': len(cards),
        'chapters': chapters,
        'cards': cards
    }
    with io.open(LIB, 'r', encoding='utf-8') as f:
        lib = json.load(f)
    lib['subjects'] = [s for s in lib['subjects'] if s['id'] != 'pub-qianyan']
    lib['subjects'].append(subject)
    total = sum(len(s.get('cards', [])) for s in lib['subjects'])
    lib['_version'] = lib.get('_version', 4) + 1
    lib['_description'] = '热门考研专业课知识卡片，共 %d 科 %d 张' % (len(lib['subjects']), total)
    with io.open(LIB, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lib, f, ensure_ascii=False, separators=(', ', ': '))
        f.write('\n')
    print('merged pub-qianyan: %d cards, %d chapters' % (len(cards), len(chapters)))
    print('library totals: %d subjects, %d cards' % (len(lib['subjects']), total))

if __name__ == '__main__':
    main()