# Operit Office Document Workspace

This is a professional document processing workspace that integrates powerful document conversion and typesetting tools.

## Core Tools

### � Pandoc — A Powerhouse for Document Format Conversion
Pandoc is the most powerful document format conversion tool, supporting conversion between dozens of formats.

#### Installing Pandoc
```bash
# Ubuntu/Termux
apt install pandoc

# 验证安装
pandoc --version
```

#### Common Conversion Commands
```bash
# Markdown → PDF（推荐使用 XeLaTeX 引擎）
pandoc input.md -o output.pdf --pdf-engine=xelatex -V CJKmainfont="Noto Sans CJK SC"

# Markdown → Word
pandoc input.md -o output.docx

# Markdown → HTML
pandoc input.md -o output.html --standalone

# Word → Markdown
pandoc input.docx -o output.md

# HTML → PDF
pandoc input.html -o output.pdf --pdf-engine=xelatex

# 批量转换 Markdown 为 PDF
for f in *.md; do pandoc "$f" -o "${f%.md}.pdf" --pdf-engine=xelatex; done
```

### 📐 XeLaTeX — Professional Typesetting Engine
XeLaTeX is a LaTeX engine that supports Unicode and modern fonts, with full support for Chinese typesetting.

#### Installing TeX Live (including XeLaTeX)
```bash
# Ubuntu/Termux（精简安装）
apt install texlive-xetex texlive-fonts-recommended

# 完整安装（推荐，约 4GB）
apt install texlive-full
```

#### Compiling LaTeX Directly
```bash
# 编译 .tex 文件为 PDF
xelatex document.tex

# 多次编译（用于目录和引用）
xelatex document.tex && xelatex document.tex
```

#### Pandoc + XeLaTeX Advanced Usage
```bash
# 使用自定义模板
pandoc input.md -o output.pdf --template=mytemplate.tex --pdf-engine=xelatex

# 添加目录
pandoc input.md -o output.pdf --toc --pdf-engine=xelatex

# 设置页边距和字体
pandoc input.md -o output.pdf --pdf-engine=xelatex \
  -V geometry:margin=2cm \
  -V CJKmainfont="Noto Sans CJK SC" \
  -V fontsize=12pt
```

## Other Useful Tools

### 📊 Text Processing Tools
```bash
# wkhtmltopdf - HTML 转 PDF（另一种方案）
apt install wkhtmltopdf
wkhtmltopdf input.html output.pdf

# LibreOffice - Office 文档处理
apt install libreoffice
libreoffice --headless --convert-to pdf document.docx

# csvkit - CSV 数据处理
pip install csvkit
csvcut -c 1,3 data.csv > output.csv
csvsql --query "SELECT * FROM data WHERE value > 100" data.csv
```

### 🔍 Document Search and Processing
```bash
# 在多个文件中搜索内容
grep -r "关键词" .

# 使用 ripgrep（更快）
rg "关键词" --type md

# 批量重命名文件
rename 's/old/new/' *.txt

# PDF 文本提取
pdftotext document.pdf output.txt
```

### 📝 Markdown Enhancements
```bash
# markdown-toc - 自动生成目录
npm install -g markdown-toc
markdown-toc -i README.md

# prettier - 格式化 Markdown
npm install -g prettier
prettier --write *.md
```

## Recommended Workflows

### 1. Markdown Writing → PDF Publishing
```bash
# 编写 Markdown 文档
vim report.md

# 转换为精美 PDF
pandoc report.md -o report.pdf \
  --pdf-engine=xelatex \
  --toc \
  -V CJKmainfont="Noto Sans CJK SC" \
  -V geometry:margin=2.5cm
```

### 2. Multi-Format Document Conversion
```bash
# 同时生成多种格式
pandoc document.md -o document.pdf --pdf-engine=xelatex
pandoc document.md -o document.docx
pandoc document.md -o document.html --standalone
```

### 3. LaTeX Academic Typesetting
```bash
# 创建学术论文模板
cat > paper.tex << 'EOF'
\documentclass{article}
\usepackage{xeCJK}
\setCJKmainfont{Noto Sans CJK SC}
\title{我的论文}
\author{作者}
\begin{document}
\maketitle
\section{引言}
正文内容...
\end{document}
EOF

# 编译
xelatex paper.tex
```

## File Organization Suggestions

```
workspace/
├── source/         # 源文件（Markdown, LaTeX）
├── output/         # 输出文件（PDF, DOCX）
├── templates/      # 自定义模板
├── images/         # 图片资源
└── README.md
```

## FAQ

### Q: Chinese characters in the PDF show up as boxes?
```bash
# 安装中文字体
apt install fonts-noto-cjk

# 在 pandoc 命令中指定字体
-V CJKmainfont="Noto Sans CJK SC"
```

### Q: How do I customize the PDF style?
Create a YAML metadata header:
```yaml
---
title: "文档标题"
author: "作者名"
date: 2025-11-29
geometry: margin=2cm
fontsize: 12pt
---
```

### Q: Batch-processing a large number of documents?
```bash
# Shell 脚本自动化
for file in source/*.md; do
    filename=$(basename "$file" .md)
    pandoc "$file" -o "output/${filename}.pdf" --pdf-engine=xelatex
done
```

## Tips

- 💡 Prefer the Pandoc + XeLaTeX combination for high-quality PDFs
- 💡 Markdown is the best source file format: easy to edit and easy to version-control
- 💡 Use Git to manage document versions (.gitignore is already configured)
- 💡 For complex typesetting needs, write LaTeX directly
- 💡 Batch processing is best automated with shell scripts

Happy Writing! �✨
