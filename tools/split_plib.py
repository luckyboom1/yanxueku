#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把整包 public-library.json 拆成「索引 + 按科目卡片」。

产出（均在仓库根目录运行本脚本）：
  public-library-index.json   首屏只需科目元数据（名称/简介/章节/卡数），约 40KB
  plib/<subjectId>.json       单个科目的卡片，下钻或导入时才按需加载

原 public-library.json 保留为数据源，运行时不再加载。
拆完后需要在 views.js 里 bump PLIB_VER，使旧的整包本地缓存失效。
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public-library.json')
OUT_DIR = os.path.join(ROOT, 'plib')


def main():
    with open(SRC, encoding='utf-8') as f:
        data = json.load(f)

    subjects = data['subjects']
    index_subjects = []
    total_cards = 0

    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)

    for s in subjects:
        cards = s.get('cards') or []
        total_cards += len(cards)
        meta = {k: v for k, v in s.items() if k != 'cards'}
        meta['cardCount'] = len(cards)          # 以真实卡片数为准，避免与元数据不一致
        index_subjects.append(meta)

        sub_path = os.path.join(OUT_DIR, s['id'] + '.json')
        with open(sub_path, 'w', encoding='utf-8') as f:
            json.dump({'id': s['id'], 'name': s['name'], 'cards': cards},
                      f, ensure_ascii=False, separators=(',', ':'))

    index = {
        '_version': data.get('_version'),
        '_name': data.get('_name'),
        '_description': data.get('_description'),
        'subjects': index_subjects,
    }
    idx_path = os.path.join(ROOT, 'public-library-index.json')
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))

    def size(p):
        return os.path.getsize(p) / 1024.0

    print('index: %.1f KB (%d subjects, %d cards)' % (size(idx_path), len(index_subjects), total_cards))
    rows = sorted(((size(os.path.join(OUT_DIR, s['id'] + '.json')), s['name']) for s in subjects), reverse=True)
    for kb, name in rows[:5]:
        print('  %-14s %.1f KB' % (name, kb))
    print('  ... %d subject files, total %.1f KB' % (len(rows), sum(kb for kb, _ in rows)))


if __name__ == '__main__':
    main()
