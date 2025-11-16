# 文档多语言支持 / Documentation Multi-language Support

## 中文

本文档系统现在支持中英文双语。

### 文档结构

- **中文文档**: 直接放在 `public/content/zh/` 目录下
- **英文文档**: 放在 `public/content/en/` 目录下

### 如何添加英文文档

1. 在 `public/content/en/` 目录下创建与中文文档相同的目录结构
2. 翻译对应的 Markdown 文件
3. 保持文件名和目录结构与中文版本一致

### 示例

```
public/content/
├── zh/                     (中文目录)
│   ├── quick-start.md      (中文)
│   ├── faq.md              (中文)
│   ├── basic-config/
│   │   ├── model-config.md (中文)
│   │   └── ...
│   └── tools-and-features/
│       ├── context-summary.md (中文)
│       ├── deep-search.md (中文)
│       ├── max-mode.md (中文)
│       ├── share-conversation.md (中文)
│       └── ...
├── en/                     (英文目录)
│   ├── quick-start.md      (英文)
│   ├── faq.md              (英文)
│   ├── basic-config/
│   │   ├── model-config.md (英文)
│   │   └── ...
│   └── tools-and-features/
│       ├── context-summary.md (英文)
│       ├── deep-search.md (英文)
│       ├── max-mode.md (英文)
│       ├── share-conversation.md (英文)
│       └── ...
```

### 回退机制

如果英文文档不存在，系统会自动显示中文版本的文档。

---

## English

This documentation system now supports both Chinese and English.

### Documentation Structure

- **Chinese docs**: Place directly in `public/content/zh/`
- **English docs**: Place in `public/content/en/`

### How to Add English Documentation

1. Create the same directory structure in `public/content/en/` as the Chinese version
2. Translate the corresponding Markdown files
3. Keep the file names and directory structure consistent with the Chinese version

### Example

```
public/content/
├── zh/                     (Chinese directory)
│   ├── quick-start.md      (Chinese)
│   ├── faq.md              (Chinese)
│   ├── basic-config/
│   │   ├── model-config.md (Chinese)
│   │   └── ...
│   └── tools-and-features/
│       ├── context-summary.md (Chinese)
│       ├── deep-search.md (Chinese)
│       ├── max-mode.md (Chinese)
│       ├── share-conversation.md (Chinese)
│       └── ...
├── en/                     (English directory)
│   ├── quick-start.md      (English)
│   ├── faq.md              (English)
│   ├── basic-config/
│   │   ├── model-config.md (English)
│   │   └── ...
│   └── tools-and-features/
│       ├── context-summary.md (English)
│       ├── deep-search.md (English)
│       ├── max-mode.md (English)
│       ├── share-conversation.md (English)
│       └── ...
```

### Fallback Mechanism

If an English document doesn't exist, the system will automatically display the Chinese version.
