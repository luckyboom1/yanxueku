# 数据构建工具

一次性脚本：生成与合并 `public-library.json`（公共课程库）。
所有脚本从 **仓库根目录** 运行（内部以 `../public-library.json` 访问数据文件）：

```bash
python tools/rebuild_lib.py
```

| 文件 | 作用 |
|---|---|
| `rebuild_lib.py` | 从原始卡组重建 public-library.json |
| `bulk.py` / `enrich_lib.py` / `gen_xw.py` | 批量追加与内容充实 |
| `merge.py` / `merge_real.py` / `merge_patch.py` | 合并补丁（`patch_*.json`） |

`patch_*.json` 为历史合并补丁，留作数据溯源；站点运行时不加载本目录任何文件。
