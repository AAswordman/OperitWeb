### 如何配置自己的API

*按照以下步骤，您可以轻松配置好DeepSeek的API，以便在Operit AI中使用。*

如果您想配置自己的API（而非使用应用内提供的默认接口），可以参照以下流程：

我们内置了DeepSeek作为默认模型，因为我们认为其为国内使用性价比最高的API，不仅性能强悍，而且还有各种优惠和磁盘缓存降低使用成本。

API的访问和Token的设置与软件开发者无关，我们不会提供这方面的任何服务，也不会赚取任何费用。

第一次使用自己的token建议只充1元，完全够用。

---

#### 配置DeepSeek API步骤

1.  在应用中，如果您未配置API，会看到如下界面。点击“获取Token”。

    ![](/manuals/assets/deepseek_API_step/2.png)

2.  应用会弹出提示，引导您前往DeepSeek官网。点击“前往获取”。

    ![](/manuals/assets/deepseek_API_step/4.png)

3.  在DeepSeek网站上，您需要注册并登录，然后进行充值。建议初次使用充值1元即可。

    ![](/manuals/assets/deepseek_API_step/3.png)

4.  充值后，您可以在“用量”页面查看您的余额。

    ![](/manuals/assets/deepseek_API_step/5.png)

5.  接下来，请转到“API密钥”页面，点击“创建新的API key”。

    ![](/manuals/assets/deepseek_API_step/9.png)

6.  创建密钥后，复制生成的API Key。

7.  返回Operit AI应用，将复制的API Key粘贴到“API密钥”输入框中。

    ![](/manuals/assets/deepseek_API_step/2.png)

8.  或者，您也可以在“设置” -> “模型与参数配置”中，新建一个模型配置，并将API Key粘贴进去。

    ![](/manuals/assets/deepseek_API_step/1.png)

配置完成后，您就可以使用自己的DeepSeek API进行AI对话了。

---

#### 自定义模型与参数配置

除了遵循向导配置特定的API（如DeepSeek）外，Operit AI还提供了强大的自定义模型配置功能。您可以在这里接入任何兼容的API供应商，并精细调整模型的各项参数。

**如何访问：**

*   在初始API配置界面点击 **“+ 新建”**
*   或进入 **“设置” -> “模型与参数配置”**

![模型与参数配置主界面](/manuals/assets/model/model-config-main.jpg)

**1. API 设置**

您可以手动填入所需模型的API信息，创建一个新的模型配置：

*   **API端点 (Endpoint):** 模型的API请求地址。
    *   *提示：如果输入的是基础URL，系统将自动补全通用路径。如需禁用此功能，请在URL末尾添加 `#` 号。*
*   **API密钥 (Key):** 您从供应商平台获取的API Key。
*   **模型名称 (Model Name):** 指定要使用的具体模型，例如 `gpt-4-turbo` 或 `gemini-1.5-pro-latest`。您可以点击右侧的列表图标尝试从供应商拉取模型列表。
*   **API提供商 (Provider):** 点击后可以选择对应的API服务提供商。这有助于软件更好地适配不同的API规范。

![选择API提供商](/manuals/assets/model/model-config-providers.png)

我们已内置多家主流API供应商的预设，包括：
*   OpenAI (GPT系列)
*   Anthropic (Claude系列)
*   Google (Gemini系列)
*   百度 (文心一言系列)
*   阿里云 (通义千问系列)

**2. 模型参数设置**

在配置页面的下半部分，您可以对模型的创造性参数和重复控制参数进行微调，以控制AI的输出风格。

![模型参数设置](/manuals/assets/model/model-config-params.png)

*   **创造性参数:**
    *   **温度 (Temperature):** 控制输出的随机性。较低的值使输出更确定和一致，较高的值则更具随机性和创造性。
    *   **Top-P 采样:** 一种替代温度采样的方式，模型仅从概率总和达到阈值P的最小词汇集中进行选择。
    *   **Top-K 采样:** 模型仅从概率最高的K个词汇中进行选择。

*   **重复控制参数:**
    *   **存在惩罚 (Presence Penalty):** 通过对已出现词汇施加惩罚，来增强模型谈论新主题的倾向。值越高，越鼓励模型引入新概念。
    *   **频率惩罚 (Frequency Penalty):** 通过对已出现词汇的频率施加惩罚，来降低模型逐字重复的可能性。值越高，惩罚越重。

通过这些丰富的配置选项，您可以将Operit AI连接到您偏好的任何AI模型，并根据具体任务需求，精细地调整其表现。