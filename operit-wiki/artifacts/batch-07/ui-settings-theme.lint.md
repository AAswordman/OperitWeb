# Lint 报告：ui-settings-theme（Issue #98）

- 隔离运行：4 件套复制到 /tmp/batch07-lint，`python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/batch07-lint`
- 检查文件：1（ui-settings-theme.md）
- 硬失败：0
- 警告：0
- `.critic.md` 不参与 lint（留给独立 critic）

## 修复记录

- 初版 112 条警告：正文句内反引号符号超出引用行 ±5 窗口。重写正文为一事实一行、引用紧贴符号的形式，逐行核对窗口。
- 第二轮 10 条警告：发现 lint 实际窗口为 [n-5, n+4]（非对称）；修正 10 处锚点（`getContrastingTextColor` :592→:603、`isColorLight` :639→:649、`SideEffect` :193→:190、`lens` :97→:101、`ColorDrawable` :437→:448、`OpenMultipleDocuments` :58→:64，另 4 处去掉窗口外符号的反引号）。
- 第三轮：0 硬失败 / 0 警告。

## 禁用词与模糊词

- 评审禁用词（SCHEMA 评审清单所列）：5 文件 0 命中。
- 模糊措辞（SCHEMA 所列子串清单）：0 命中。
