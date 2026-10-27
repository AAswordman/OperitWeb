# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0

## 修错后复跑记录（2026-10-01）

- 修错内容：facts[37] 拆成两条原子事实（定义位置 / 置 Idle 行为），facts 总数 81→82，status.json refs_valid 同步为 82；quality[5] evidence 删掉末尾多余的转义引号（已与源码逐字一致）；facts[75]（现为第 77 条）ref :403→:407、文本"第 375-383 行附近"→"第 403–409 行附近"。
- 4 文件（md/facts/quality/status，不含本 lint.md）复制到 /tmp 隔离运行 `python3 scripts/lint.py --src ~/workspace/Operit`：
```
# Lint 报告

- 检查文件：1
- 硬失败：0
- 警告：0


```
