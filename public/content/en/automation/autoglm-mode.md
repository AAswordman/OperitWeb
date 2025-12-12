## AutoGLM Mode

AutoGLM Mode is an advanced UI automation feature that gives the AI "vision" by leveraging multimodal large models. This allows it to understand on-screen content for smarter and more precise operations.

To enable and use AutoGLM Mode, follow these configuration steps.

### 1. Configure Your AI Brain: Model Configuration

A powerful and correctly configured language model is the foundation for understanding and executing complex tasks. You need to set up a working AI model for Operit AI. We recommend using a high-performance model for the best experience.

For detailed instructions on how to configure a model, please refer to our guide: [Model & Parameter Configuration](/#/guide/basic-config/model-config).

### 2. Grant Software Operation Permissions

To allow the AI to observe the screen and simulate actions like tapping, swiping, and typing, you need to grant the app the appropriate system permissions. This feature requires at least **Accessibility Permissions**.

Please go to the authorization screen to grant permissions based on your device and needs. For more details, see: [Authorizing the Software](/#/guide/basic-config/software-authorization).

### 3. Set AI Tool Permissions

Next, you need to decide how the AI uses tools when performing tasks. You can set it to "Auto-Approve" for the smoothest automation experience or choose "Always Ask" to retain final control over every action.

Configure this in the permission settings based on your level of trust and usage scenario. For setup instructions, see: [AI Permission Control](/#/guide/basic-config/ai-permissions).

### 4. Enable the AutoGLM Tool Package

Unlike basic UI automation, AutoGLM Mode requires a dedicated tool package.

Go to the "Package Management" screen in the app, find the **Automatic** category, **turn off** the first `Automatic_ui_base` tool package, and **turn on** the second `Automatic_ui_subagent` tool package.

![](/manuals/assets/automatic/4.png)

### 5. Configure the UI Controller Model

To give the AI vision capabilities, you need to assign it a dedicated multimodal model.

Go to the "Functional Model Configuration" screen, find the **UI Controller** option, and select or create a new configuration that supports vision. If you create a new configuration, make sure to enable the "Direct Image Processing" switch, as shown in the image below:

![](/manuals/assets/automatic/5.jpg)

If you are using the `autoglm` model, you can refer to the following parameters for tuning to achieve more stable or creative output:

```
temperature: float = 0.0
top_p: float = 0.85
frequency_penalty: float = 0.2
```

![](/manuals/assets/automatic/6.png)
![](/manuals/assets/automatic/7.png)

Note that AutoGLM Mode only changes the model used by the **UI Controller** to a vision-capable model like `autoglm`. For normal conversations, you can continue using your usual chat model; the two configurations do not interfere with each other.

![](/manuals/assets/automatic/1.png)

### 6. Start Your Automation Task

After completing all the steps above, you can start your AutoGLM automation task. Return to the main chat screen and click the floating window button in the toolbar above the input box to begin. The AI will now use "vision" to understand your commands and the on-screen content.

![](/manuals/assets/automatic/3.jpg)
