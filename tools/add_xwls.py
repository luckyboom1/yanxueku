#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将「中国新闻史 / 外国新闻史」笔记条目并入 public-library.json 的
中外新闻史科目（pub-xwls），按标题去重，可重复运行（增量跳过已存在标题）。

数据来源：tools/_zxwls_extract.txt、tools/_wgxwls_extract.txt
（分别由 中国/外国新闻史笔记_OCR_clean.docx 提取）。
结构：第X章…（章）→ 考点行（忽略）→ 一、名词（条目）→ 真经…重要性提醒：N星 → 【…】正文。
OCR 修正：'射期' → '时期'。

用法（在仓库根目录）：python tools/add_xwls.py
"""
import io, json, re, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, '..', 'public-library.json')
SUBJECT_ID = 'pub-xwls'
SOURCES = [
    (os.path.join(HERE, '_zxwls_extract.txt'), '中国新闻史'),
    (os.path.join(HERE, '_wgxwls_extract.txt'), '外国新闻史'),
]

CH    = re.compile(r'^第([一二三四五六七八九十百]+)章\s*[:：]?\s*(.+)$')
ITEM  = re.compile(r'^([一二三四五六七八九十]+)、\s*(\S.{0,60})$')
STAR  = re.compile(r'真经.*?重要性提醒\s*[:：]\s*([一二两三四五])星')
KAODIAN = re.compile(r'^(真经)?考点[一二三四五六七八九十]+\s*[:：]')

def fix_ocr(s):
    return s.replace('射期', '时期')

def parse(path, prefix):
    lines = [l.rstrip('\n') for l in io.open(path, encoding='utf-8')]
    cards, cur = [], None
    chapter = ''
    def flush():
        if not cur:
            return
        title = cur['title']
        body = []
        for l in cur['body']:
            m = re.match(r'^(【[^】]{1,12}】)(.*)$', l)
            body.append(('\n**' + m.group(1) + '**' + m.group(2)) if m else l)
        content = '\n'.join(body).strip()
        if not title or len(content) < 10:
            return
        tags = ['中外新闻史'] + ([cur['star'] + '星'] if cur['star'] else [])
        cards.append({
            'chapter': (prefix + '·' + chapter) if chapter else (prefix + '·综合'),
            'title': title[:100],
            'content': content[:20000],
            'tags': tags
        })
    for l in lines:
        l = l.strip()
        if not l or l.startswith('新传考研真经同行'):
            continue
        if l.startswith('—— 第') and l.endswith('页 ——'):
            continue
        m = CH.match(l)
        if m:
            flush(); cur = None
            chapter = fix_ocr(m.group(2).strip(' ：:，,'))
            continue
        if KAODIAN.match(l):
            if cur: flush(); cur = None   # 考点行意味着上一条目结束
            continue
        m = ITEM.match(l)
        if m:
            flush(); cur = None
            cur = {'chapter': chapter, 'title': fix_ocr(m.group(2).strip()), 'star': '', 'body': []}
            continue
        m = STAR.search(l)
        if m and cur is not None and not cur['star']:
            cur['star'] = m.group(1)
            continue
        if cur is not None:
            cur['body'].append(l)
    flush()
    return cards

def main():
    with io.open(LIB, 'r', encoding='utf-8') as f:
        lib = json.load(f)
    subj = next((s for s in lib['subjects'] if s['id'] == SUBJECT_ID), None)
    if subj is None:
        raise SystemExit('subject %s not found' % SUBJECT_ID)
    existing = {c['title'] for c in subj.get('cards', [])}
    chapters = list(subj.get('chapters', []))
    added = skipped = 0
    for path, prefix in SOURCES:
        for c in parse(path, prefix):
            if c['title'] in existing:
                skipped += 1
                continue
            existing.add(c['title'])
            if c['chapter'] not in chapters:
                chapters.append(c['chapter'])
            subj.setdefault('cards', []).append(c)
            added += 1
    subj['chapters'] = chapters
    subj['cardCount'] = len(subj.get('cards', []))
    total = sum(len(s.get('cards', [])) for s in lib['subjects'])
    lib['_version'] = lib.get('_version', 4) + 1
    lib['_description'] = '热门考研专业课知识卡片，共 %d 科 %d 张' % (len(lib['subjects']), total)
    with io.open(LIB, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lib, f, ensure_ascii=False, separators=(', ', ': '))
        f.write('\n')
    print('added %d, skipped %d (duplicates)' % (added, skipped))
    print('pub-xwls now: %d cards, %d chapters' % (subj['cardCount'], len(chapters)))
    print('library totals: %d subjects, %d cards' % (len(lib['subjects']), total))

if __name__ == '__main__':
    main()