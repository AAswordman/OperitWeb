# Operit 1 源码知识库整合

## 范围与入口

- 阅读：`/#/v1/guide/wiki`
- 文章：`/#/v1/guide/wiki/batch-02/api-chat`（保留上游完整 entry ID）
- 文档关系图：`/#/v1/guide/wiki/graph`
- 代码走查：`/#/v1/guide/wiki/quality`
- 来源、许可证、备份：`/#/v1/guide/wiki/about`

只属于 **Operit 1 Android**。不覆盖现有入门教程或完整参考手册，不向 Operit 2 注入内容，不把旧版插件契约当作两代共享契约。教程选择页、入门教程目录和参考手册目录均提供入口。

## 固定快照

- 导入仓库：`jasonluoxray/Operit-wiki`
- 导入提交：`5e2f848db47d352754ba614c2138fa03b9c5ce93`
- 导入日期：2026-10-26
- 126 个索引条目：124 篇文章 + 2 份大纲。
- 14,586 条事实引用，1,033 条代码走查记录。
- 原始大纲 11 章，加上维护大纲章，全部条目均可阅读。
- 页面、事实与走查的源码链接绑定各条目自己的 `source_commit`，不指向不断变化的 main。

计数以 `public/operit-wiki/manifest.json` 为准，而不是 README 中的历史页数。上游索引时间也按原值保留，不能把它当作所有正文的最后更新时间。

`approved`、事实校验描述、风险等级、置信度均为**上游记录**，不代表本站已逐项复核。走查数据中的 `warn` 与 `warning` 统一为筛选使用的 `warning`，`originalSeverity` 保留原值；未注明等级的记录明确列为“未分级”，不擅自评定风险。兼容旧记录中 `description` / `detail`、数组证据、数字置信度等格式，完整原始 JSON 随记录保留。

## 保留了什么

| 内容 | 位置 |
| --- | --- |
| 适配后的文章 | `public/content/zh/source-wiki/<batch>/<entry>.md` |
| 原始 Markdown | `public/operit-wiki/original/<batch>/<entry>.md` |
| facts / status / quality / lint / critic 等全部逐条目材料 | `public/operit-wiki/artifacts/<batch>/` |
| 来源、章节、校验值、互链索引 | `public/operit-wiki/manifest.json` |
| 按需加载的全文搜索数据 | `public/operit-wiki/search.json` |
| 汇总走查数据 | `public/operit-wiki/quality.json` |
| 全部上游跟踪文件（含原站、脚本、规范、跟踪数据等） | `public/operit-wiki/upstream.zip` |
| MIT 原文和导入说明 | `public/operit-wiki/LICENSE.txt`、`NOTICE.txt` |

原仓库整体通过 `git archive HEAD` 保留；**不执行**上游部署或生成脚本。原始审核文件不经过本站 Markdown 投稿系统改写，文章则沿用已有 `content/zh/...` 编辑路径规则，无需修改或重新部署 Worker 白名单。

## 功能适配

- 复用本站 `DocsLayout`、Markdown 阅读、移动端目录、站点主题与导出功能。
- 导入内容在 raw HTML 解析后经过 `rehype-sanitize`，避免第三方内容执行脚本、事件属性等；不改变其他现有文档的渲染策略。
- `entry.html?id=…`、`wiki.html?id=…` 转为本站 HashRouter 路由。
- 不改写 fenced code 示例；源码 `file:line` 转为固定提交链接。
- 全文索引只在搜索时请求；审核事实在展开时请求，并分批展示。
- 图谱基于文章**显式互链**，可查看所有条目、入链、出链及展开关系。它不宣称是代码依赖图；不移植依赖维护者本地 `~/workspace/vendor` 的旧图谱引擎。
- 走查支持关键字、等级、条目筛选和分页；保留全部证据与源码定位。
- 英文界面明确提示正文只有中文，不伪造译文或跨代际回退。
- 站点 BASE_URL 子目录部署继续适用。

## 无法从备份恢复的站外数据

原站教程分享从 `luojiaping/Operit-wiki` 的带 `tutorial-approved` 标签的 GitHub Issues 动态读取；评论也来自旧仓库 Issues。**这些内容并不在备份仓库中**，原仓库 API 在 2026-10-26 返回 404。因此不能声称已恢复评论和社区教程，不能把旧 Issue ID 拼到备份仓库下。页面中已明确说明，本站既有教程与投稿中心保持正常可用。

若以后获取到旧 Issues 导出，可另写转换器补充，不需要重做知识库路由。

## 更新与复现

日常网站构建**不访问 GitHub**；生成结果已纳入本仓库，可直接部署。

```powershell
git clone https://github.com/jasonluoxray/Operit-wiki.git temp/operit-wiki-review
git -C temp/operit-wiki-review checkout 5e2f848db47d352754ba614c2138fa03b9c5ce93
pnpm sync:operit-wiki --source temp/operit-wiki-review
pnpm test:wiki
pnpm test:site
pnpm build
pnpm test:wiki:smoke
pnpm test:site:smoke
```

更新到新提交时，先在上游副本执行 fetch/checkout，并审查变化，再运行导入。导入器要求副本干净，校验条目 ID、重复 ID、大纲覆盖、未知互链和源码提交格式。导入先在临时目录生成和校验，成功后整体替换两个专用生成目录，失败时回滚，避免半更新及残留已删除条目。

上游 YAML 存在重复的 `notes` 键，读取时允许最后一个覆盖前一个；章节和条目 ID 另行校验。

完整备份中可能有原仓库内自述的 AI 使用协议与维护指令；它们作为文档材料保留，不会作为本站运行或构建指令自动执行。
