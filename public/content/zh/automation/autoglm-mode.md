## AutoGLM 模式

AutoGLM 模式是一种更高级的 UI 自动化功能，它利用多模态大模型赋予 AI “视觉”，使其能够理解屏幕上的内容并进行更智能、更精准的操作。

> **重要说明**：
> - 在使用 subagent 操作屏幕时，其执行速度完全取决于模型的推理输出速度、部署平台等因素。
> - 本软件的 AutoGLM 逻辑部分与官方开源逻辑等价，确保了功能的可靠性和一致性。

要启用并使用 AutoGLM 模式，请遵循以下配置步骤。

### 1. 配置您的 AI 大脑：模型配置

一个强大且配置正确的语言模型是实现复杂任务理解和执行的基础。您需要为 Operit AI 配置一个可用的 AI 模型。我们建议您使用性能较强的模型以获得最佳体验。

关于如何配置模型，您可以参考我们的详细指南：[模型与参数配置](/#/guide/basic-config/model-config)。

### 2. 授予软件操作权限

为了让 AI 能够观察屏幕内容并模拟点击、滑动等操作，您需要授予应用适当的系统权限。此功能至少需要**无障碍权限**。

请前往授权界面，根据您的设备情况和需求完成授权。详细信息请参阅：[授权软件](/#/guide/basic-config/software-authorization)。

### 3. 设置 AI 工具权限

接下来，您需要决定 AI 在执行任务时如何使用工具。您可以设置为“自动批准”以获得最流畅的自动化体验，也可以选择“总是询问”来保留对每一步操作的最终控制权。

请根据您的信任程度和使用场景，在权限设置中进行配置。具体设置方法请见：[AI 权限控制](/#/guide/basic-config/ai-permissions)。

### 4. 启用 AutoGLM 工具包

与基础 UI 自动化不同，AutoGLM 模式需要专用的工具包。

请进入应用的“包管理”界面，在列表中找到 **Automatic** 分类，**关闭**第一个 `Automatic_ui_base` 工具包，并**打开**第二个 `Automatic_ui_subagent` 工具包。

![](/manuals/assets/automatic/4.png)

### 5. 配置 UI 控制器模型

为了让 AI 具备识图能力，您需要为其指定一个专用的多模态模型。

请进入“功能模型配置”界面，找到 **UI 控制器** 选项，并为其选择或新建一个支持识图的模型配置。如果您选择新建配置，请确保开启“直接图片处理”开关，如下图所示：

![](/manuals/assets/automatic/5.jpg)

如果您使用的是 `autoglm` 模型，可以参考以下参数进行调优，以获得更稳定或更具创造力的输出：

```
temperature: float = 0.0
top_p: float = 0.85
frequency_penalty: float = 0.2
```

![](/manuals/assets/automatic/6.png)
![](/manuals/assets/automatic/7.png)

请注意，AutoGLM 模式只会将 **UI 控制器** 使用的模型切换为具备识图能力的 `autoglm` 等模型，对话时依旧可以继续使用您常用的聊天模型，二者互不影响。

![](/manuals/assets/automatic/1.png)

### 6. 开始您的自动化任务

完成以上所有步骤后，您就可以开始您的 AutoGLM 自动化任务了。回到主对话界面，点击输入框上方工具栏中圈出的悬浮窗按钮，即可启动。现在，AI 将以“视觉”模式来理解您的指令和屏幕内容。

![](/manuals/assets/automatic/3.jpg)
