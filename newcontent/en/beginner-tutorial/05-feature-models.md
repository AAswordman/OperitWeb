### Functional Models and Image Recognition

Before reading this section, please make sure you have read the previous **model configuration** tutorial.

Sometimes we may wonder: since `deepseek` does not support image recognition, can we configure another vision model like `glm-4.6v`, and then let the main chat model call this smaller model? Going one step further, can chat summary also use another model, such as `gemini flash`?

This is exactly what functional models do. As the name implies, a functional model sets a model configuration for each function. In other words, you need to follow the previous section and create one or more configurations.

The main functions currently include: **chat, summary, multimodal input, group chat planning, memory summary**, and so on.

When you encounter strange errors but your chat model itself is working, **check the functional models first**.

![Functional model configuration](/manuals/assets/preference/functional-model-config.png)

Next, we will explain a few functional models in detail, mainly multimodal input and UI controller. These are relatively more special than the others. For most other functions, you only need a normal model that can chat; these ones have special configuration requirements.


## Model Image Recognition

Operit AI supports two ways to achieve image recognition: **direct image recognition** and **image recognition through functional model calls**. Direct image recognition means using the chat model’s own vision capability directly, while the second indirect method uses the functional model mentioned above.

### Method 1: Direct Image Recognition (chat model supports vision)

For multimodal models that support visual understanding (such as GPT-4 Vision, Claude 3.5 Sonnet, Gemini Pro Vision, etc.), you can enable direct image recognition in model configuration.

#### Configuration Steps

1. Go to **"Settings" -> "Model & Parameter Configuration"**
2. Find your chat model
3. In the configuration page, find the **"Enable Direct Image Processing"** option
4. **Check this option** to enable direct image processing
5. Save the configuration and click test to make sure it passes

![Model configuration page](/manuals/assets/model/f6044fc42c9d65f65751ba8470dcf551.jpg)

#### How to Use

After configuration is complete, when chatting with this model, send an image directly to the AI. The AI can directly recognize and understand image content, **without calling extra tools**, and the response is faster (though not always).

### Method 2: Image Recognition via Functional Model (chat model does not support vision)

For models that do not support direct image recognition, you can enable image recognition by configuring a functional model. When needed, the system will automatically call the configured vision model to process images.

#### Configuration Steps

1. Go to **"Settings" -> "Functional Model Configuration"**
2. Find the **"Image Recognition"** function module
3. Select a multimodal model configuration that supports image recognition
4. **Make sure this model configuration has enabled the "Enable Direct Image Processing" option**
5. Save the configuration and test

![Functional model configuration page](/manuals/assets/model/967d284fca94c4cdcbe6e73cb84ff801.jpg)

#### How It Works

When you chat with a main model that does not support direct image recognition, and you send an image in the conversation, the chat model will call the image recognition functional model through the `read_file` tool. After the vision model finishes processing, it returns the result to the main model, and the main model continues the conversation based on that result.

### Special Case: No Model Can Recognize Images

This needs to be explained specially in the image-recognition section, because the app has considered this case. For example, right after quick start, the user may have no model that can recognize images at all. In this case, the app provides a **final fallback**: after you send an image, the AI will use the `read_file` tool together with `OCR` to extract text content from the image directly. The effect may not be very good, but it is still better than nothing.

## UI Automation Operations

In conversation, if you need automatic operations, the AI may call the **UI controller** functional model to operate, or the main model may directly handle the operation itself. For now, just keep one point in mind: **a functional model can be delegated to handle specific tasks**.

A quick note: if needed, you can go to the toolbox, scroll to the bottom, and use the **AutoGLM one-click setup**. At `debugger` level and above, the app can use AutoGLM functional models to start virtual-screen auto-clicking (this is optional). A dedicated UI automation chapter will be added later.

You can also read the old docs for now:

- [UI Automation (Old Docs)](/#/guide/old/automation/autoglm-mode)
- [UI Automation Overview (Old Docs)](/#/guide/old/automation/ui-automation)
- [Virtual Screen (Old Docs)](/#/guide/old/automation/virtual-screen)

No old-doc links are added for platform-specific content here; please check the official website directly.
