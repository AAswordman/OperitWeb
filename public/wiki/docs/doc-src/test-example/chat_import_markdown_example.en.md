<!-- chat-info: title=Python Programming Discussion, group=Programming Techniques -->
---
title: Python Programming Discussion
group: Programming Techniques
---

# Python Programming Discussion

<!-- msg: user -->
## 👤 User

How do I read a JSON file in Python?

<!-- msg: ai, model=gpt-4 -->
## 🤖 Assistant

*Model: gpt-4*

Reading a JSON file in Python is simple; you can use the built-in `json` module:

```python
import json

# 方法1：读取 JSON 文件
with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
```

**Key Points**:
- `json.load()` is used to read from a file object
- `json.loads()` is used to read from a string

<!-- msg: user -->
## 👤 User

What if the JSON file is very large?

<!-- msg: ai, model=gpt-4 -->
## 🤖 Assistant

*Model: gpt-4*

For large JSON files, consider the following approaches:

1. **Streaming**: read line by line
2. **Using the ijson library**: incremental parsing
