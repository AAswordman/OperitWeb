# Lint 报告

- 检查文件：1（`ui-settings-misc.md`，连带 facts/quality/status 同目录校验）
- 硬失败：0
- 警告：0

隔离方式：4 个交付文件复制到 `/tmp/lint-iso-07/`，运行
`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-iso-07`
（源码钉死 commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）。

修复记录：首轮 5 个硬失败——md 缺 frontmatter（`title`/`module`/`sources`/`date`）
及正文一处裸文件名引用（`` `SettingsScreen.kt:40` ``）；已补 frontmatter、
引用改为仓库根相对全路径后复检 0/0。
