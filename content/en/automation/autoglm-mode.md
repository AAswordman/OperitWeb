## AutoGLM Mode

AutoGLM Mode is an advanced UI automation feature that gives the AI "vision" by leveraging multimodal large models. This allows it to understand on-screen content for smarter and more precise operations.

> **Important Note**:
> - When using the subagent to operate the screen, the execution speed is entirely dependent on factors such as the model's inference speed and the deployment platform.
> - The AutoGLM logic in this software is equivalent to the official open-source logic, ensuring reliability and consistency.

To enable and use AutoGLM Mode, follow these configuration steps.

### 1. Configure Your AI Brain: Model Configuration

A powerful and correctly configured language model is the foundation for understanding and executing complex tasks. You need to set up a working AI model for Operit AI. We recommend using a high-performance model for the best experience.

For detailed instructions on how to configure a model, please refer to our guide: [Model & Parameter Configuration](/#/guide/basic-config/model-config).

> **Special Note**: When configuring models, do **not** directly modify your current default chat model. Instead, create a new model configuration dedicated to AutoGLM. All later image-processing switches and parameter tuning should be done on this new configuration so that your everyday chat model remains unaffected.

### 2. Grant Software Operation Permissions

To allow the AI to observe the screen and simulate actions like tapping, swiping, and typing, you need to grant the app the appropriate system permissions. This feature requires at least **Accessibility Permissions**.

Please go to the authorization screen to grant permissions based on your device and needs. For more details, see: [Authorizing the Software](/#/guide/basic-config/software-authorization).

> **Special Note**: After granting permissions, make sure you tap the **"Switch to current permission"** button (or the equivalent in your system UI) so that the app actually starts using the newly granted permissions. Otherwise, AutoGLM may not function correctly.

### 3. Set AI Tool Permissions

Next, you need to decide how the AI uses tools when performing tasks. You can set it to "Auto-Approve" for the smoothest automation experience or choose "Always Ask" to retain final control over every action.

Configure this in the permission settings based on your level of trust and usage scenario. For setup instructions, see: [AI Permission Control](/#/guide/basic-config/ai-permissions).

> **Special Note**: If you want to minimize confirmation pop-ups and let tools run more automatically in the current session, enable **"Auto-Approve"** from the menu in the bottom-right corner of the chat window. If you keep it off, the AI will ask for confirmation more often, even for tools that are already authorized.

### 4. Enable AutoGLM (Choose by Version)

Starting from step 4, the setup flow differs depending on your app version:

- **v1.6.4 and earlier**: Follow the **manual setup flow** below to enable the tool packages and configure the UI Controller model.
- **v1.6.5 and later (recommended)**: Use the built-in **AutoGLM Auto-Configuration** entry in the **Toolbox** page. The system will automatically complete the required setup for you (including tool packages and UI Controller model).

In versions **v1.6.5 and later**, open the **Toolbox** page in the app, scroll down, find the **AutoGLM Auto-Configuration** item, and tap it. Then follow the on-screen wizard to finish the setup:

![](/manuals/assets/automatic/8.jpg)

#### Manual Setup Flow (for v1.6.4 and earlier, or advanced users)

Unlike basic UI automation, AutoGLM Mode requires a dedicated tool package.

Go to the "Package Management" screen in the app, find the **Automatic** category, **turn off** the first `Automatic_ui_base` tool package, and **turn on** the second `Automatic_ui_subagent` tool package.

![](/manuals/assets/automatic/4.png)

> **Special Note**: Double-check that `Automatic_ui_base` is turned **off** and `Automatic_ui_subagent` is turned **on**. Enabling the wrong or multiple conflicting packages can cause abnormal UI automation behavior or interfere with AutoGLM Mode.

### 5. Configure the UI Controller Model (Required for Manual Setup Only)

If you are on v1.6.5 or later and have already completed the setup via **AutoGLM Auto-Configuration**, you can skip this step. You only need to continue with this section when following the **manual setup flow**.

To give the AI vision capabilities, you need to assign it a dedicated multimodal model.

Go to the "Functional Model Configuration" screen, find the **UI Controller** option, and select or create a new configuration that supports vision. If you create a new configuration, make sure to enable the "Direct Image Processing" switch, as shown in the image below:

![](/manuals/assets/automatic/5.jpg)

> **Special Note**: Here you only need to set a vision-capable model for the **UI Controller**. Do **not** change your default chat model, and do **not** switch the chat model itself to `autoglm`. Also remember to turn on **"Direct Image Processing"** in this configuration and adjust the parameters according to the recommended values in this document.

If you are using the `autoglm` model, you can refer to the following parameters for tuning to achieve more stable or creative output:

```
temperature: float = 0.0
top_p: float = 0.85
frequency_penalty: float = 0.2
```

![](/manuals/assets/automatic/6.png)
![](/manuals/assets/automatic/7.png)

Note that AutoGLM Mode only changes the model used by the **UI Controller** to a vision-capable model like `autoglm`. For chat, you should continue using your normal conversation model and **must not** switch the chat model itself to `autoglm`.

![](/manuals/assets/automatic/1.png)

### 6. Start Your Automation Task

After completing all the steps above, you can start your AutoGLM automation task. Return to the main chat screen and click the floating window button in the toolbar above the input box to begin. The AI will now use "vision" to understand your commands and the on-screen content.

![](/manuals/assets/automatic/3.jpg)

> **Special Note**: During the actual conversation, clearly state that you want to perform **UI automation actions** (such as clicking, typing, dragging, etc.), not just regular Q&A. The more clearly you describe the target interface and the actions you expect, the higher the success rate of AutoGLM.
