# Operit Web（Operit AI 官网 / 文档站）

该仓库是 **Operit AI** 的 Web 站点（官网 + 使用文档）。

- **技术栈**：React + TypeScript + Vite + Ant Design
- **路由模式**：HashRouter（URL 形如 `/#/guide/...`）
- **文档来源**：`public/content/{zh,en}` 下的 Markdown
- **在线站点**：`https://operit.aaswordsman.org`

## 环境要求

- Node.js `>= 20`（CI 使用 Node 20）
- 推荐使用 `pnpm`（仓库包含 `pnpm-lock.yaml`，GitHub Actions 也使用 pnpm）

## 快速开始

```bash
pnpm install
pnpm dev
```

启动后访问：

- 首页：`http://localhost:5173/`
- 文档：`http://localhost:5173/#/guide`

## 常用脚本

- `pnpm dev`
  - 启动本地开发服务器
- `pnpm build`
  - TypeScript 构建 + Vite 打包，产物在 `dist/`
- `pnpm preview`
  - 预览本地构建产物
- `pnpm lint`
  - 运行 ESLint
- `pnpm export-pdf`
  - 通过 Puppeteer 将文档页面导出 PDF（见下方说明）

## 文档编写

### 多语言目录结构

文档按语言分别放置：

- `public/content/zh/`：中文
- `public/content/en/`：英文

页面会优先加载当前语言版本；当英文文档不存在时，会自动回退到中文版本（见 `src/components/MarkdownRenderer.tsx`）。

### 站内链接格式

文档站内链接使用 Hash 路由格式：

`[链接文本](/#/guide/目录/文件名)`

- 路径不需要包含语言代码（如 `zh` / `en`）
- 路径不需要包含 `.md` 后缀

### 图片路径

文档中建议使用以 `/` 开头的绝对路径引用静态资源（例如 `![xx](/manuals/assets/...)`）。

## PDF 导出（export-pdf）

`pnpm export-pdf` 会：

- 启动本地 `pnpm dev`
- 使用 Puppeteer 打开文档页面并按路由逐页导出 PDF

注意：脚本当前默认扫描的 Markdown 目录为 `public/content/docs`（见 `generate-pdfs.mjs` 中的 `DOCS_PATH`）。如果你的文档实际位于 `public/content/zh` / `public/content/en`，需要调整该路径后再导出。

## 部署

- **GitHub Pages**：见 `.github/workflows/deploy.yml`，会在 `main` 分支 push 时构建并发布 `dist/`
- **自定义域名**：仓库根目录 `CNAME` 为 `operit.aaswordsman.org`
- **EdgeOne 重写**：`edgeone.json` 中包含 `/OperitWeb/*` 到 `/:splat` 的重写规则

## 开发提示

- 如果你新增了新的文档页面，请确保路由（`src/App.tsx`）与文档文件路径对应
- 文档菜单项位于 `src/pages/GuidePage.tsx`

## License

以仓库内实际 License 文件为准（如需补充请添加）。
