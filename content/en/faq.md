## ❔ Frequently Asked Questions

This section contains all questions from the user community and issues for **the latest version `1.5.0`**.
If you are using an older version, you can [find information here](#section-7).

### MCP Package Troubleshooting

**Possible Reasons for MCP Package Not Loading**
- **Shizuku Not Configured Correctly**: Please refer to [Shizuku Authorization Process](#shizuku授权流程) to complete the configuration.

**Reasons for MCP Run Failure**
- **Environment Configuration Issues**: Some MCP plugins have special requirements for the runtime environment. You need to visit the GitHub repository of the respective plugin and complete the environment configuration according to its documentation. For more information about configuration, please refer to the detailed description in the [MCP Market](#-mcp市场) section.
- **Version Compatibility Issues**: Most problems that existed in earlier versions have been resolved in subsequent updates. We strongly recommend downloading and installing the latest version for the best experience.

You can download the latest APK from the [Release page](https://github.com/AAswordman/Operit/releases).

### General Questions

### ❓ Q: Why is the AI's response sometimes slow?

The speed of AI responses is affected by multiple factors, including the current model load, network connection status, and the complexity of your question. If you encounter slow responses, please be patient or try again later.

### ❓ Q: Can I switch to different AI models?

Of course! Operit AI supports switching between multiple models. You can select and configure different AI models according to your needs in "Settings" > "AI Model Configuration".

### ❓ Q: How can I ensure my data security?

We take user privacy very seriously. All data processing is completed locally, and your conversation content and personal settings will not be uploaded to our servers. Sensitive information such as API keys is also encrypted to ensure security.

### ❓ Q: What should I do if the terminal shows an error, is unresponsive, or fails to install?

Please try the following troubleshooting steps:

1.  **Problem: The terminal is unusable right after opening.**
    - **Solution:** Try clicking the settings icon in the bottom-right corner of the terminal, select "Reset Terminal," and then restart the application.
2.  **Problem: An error occurs during environment installation.**
    - **Solution:** If you are familiar with Linux commands, you can try to fix it yourself. If not, it is recommended to return to the chat interface and let the AI assist you with the environment setup.

### ❓ Q: How can I use a local model for offline conversations?

We support running AI models locally on your device via the MNN framework. For detailed configuration steps, please refer to the [MNN Local Model Configuration Guide](/#/guide/basic-config/mnn-local-model).

### ❓ Q: How can I get the AI to recognize images?

Operit AI supports multimodal models that can understand image content. Please select a model that supports vision (e.g., GPT-4V) in the model configuration, and then you can send images directly in the chat. For detailed instructions, please refer to the [Image Recognition Configuration Guide](/#/guide/basic-config/image-recognition).

### ❓ Q: Why can't my AI start applications?

This typically requires two key steps. First, ensure the AI has permission to use toolkits that can interact with the operating system. Second, you need to provide a clear command, for example: "Activate the system toolkit and launch the 'WeChat' app."

The success also depends on the AI model's ability to understand your intent and call the correct tool.

### ❓ Q: Why does writing to a file fail or have no effect?

Failures in writing to a file usually have two main causes. First, ensure the application has been granted all necessary permissions. Second, check if the tool's output is being truncated. If a tool call returns no result, it has likely been truncated.

You can try going to "Model & Parameter Settings," find and enable an option like "Max Output Tokens," and set it to a large value, such as 8192.

**Please note:** This is not for changing the context window size, but for adjusting the maximum length of a single generation from the model.

### ❓ Q: Why does the AI output "cannot create task" or always plan a large, slow task flow?

This is likely because the "Deep Search" feature is enabled. Deep Search is a powerful analysis tool, but it consumes more resources and plans complex task flows. If your current task does not require deep analysis, we recommend disabling this feature in the settings to improve response speed. For more details, see the [Deep Search Guide](/#/guide/tools-and-features/deep-search).

