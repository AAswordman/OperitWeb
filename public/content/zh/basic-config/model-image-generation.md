# 模型生图配置

Operit 的生图能力在包管理页面完成。你只要启用对应绘图包并填写对应密钥，就可以在对话中直接让 AI 画图。

## 入口

1. 打开 设置
2. 进入 侧边栏
3. 打开 包管理
4. 切到 Packages

## 通过包启用生图

在列表里找到 Draw 分组，打开右侧开关。

- OpenAI 绘图
- Qwen 绘图
- xAI 绘图
- 智谱生图
- Nanobanana 绘图
- Pollinations 绘图

不是每个包都要开。
按你自己已经配置的密钥来开对应的包即可。

- 有 `OPENAI_API_KEY` 就开 OpenAI 绘图
- 有 `DASHSCOPE_API_KEY` 就开 Qwen 绘图
- 有 `XAI_API_KEY` 就开 xAI 绘图
- 有 `ZHIPU_API_KEY` 就开 智谱生图
- 有 `NANOBANANA_API_KEY` 就开 Nanobanana 绘图
- 没有任何密钥也可以单独开 Pollinations 绘图

## 各包可选项

### OpenAI 绘图

- 必填项 OPENAI_API_KEY
- 可填项 OPENAI_API_BASE_URL
- 可填项 OPENAI_IMAGE_MODEL

### Qwen 绘图

- 必填项 DASHSCOPE_API_KEY
- 可填项 DASHSCOPE_API_BASE_URL
- 可填项 QWEN_IMAGE_MODEL
- 支持设置分辨率
- 支持设置出图数量
- 支持负面提示词
- 支持水印开关

### xAI 绘图

- 必填项 XAI_API_KEY
- 可填项模型名称
- 支持尺寸设置

### 智谱生图

- 必填项 ZHIPU_API_KEY
- 可填项 ZHIPU_IMAGE_MODEL
- 支持尺寸设置

### Nanobanana 绘图

- 必填项 NANOBANANA_API_KEY
- 使用本地参考图时需要 BEEIMG_API_KEY
- 支持文生图
- 支持图生图
- 支持比例与画质档位

### Pollinations 绘图

- 无需密钥
- 可直接用于快速出图

## 配置步骤

1. 在 Draw 分组打开你要使用的包开关
2. 点击右下角设置图标
3. 在环境变量弹窗里找到对应包
4. 先填写带必填标记的项
5. 按需填写可填项
6. 点击保存
7. 回到对话让 AI 生成图片

## 环境配置按钮位置

- 路径 侧边栏 -> 包管理 -> Packages
- 按钮位置在页面右下角浮动按钮区
- 最下面是加号导入按钮
- 环境配置按钮是加号上方的小齿轮按钮

## 使用建议

- 先只启用一个主用绘图包
- 成功出图后再追加第二个包
- 如果出图失败先回到环境变量页检查必填项
