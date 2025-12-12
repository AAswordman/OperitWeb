## UI Automation

Operit AI's powerful UI Automation feature frees you from tedious, repetitive tasks by allowing the AI to interact with your device's interface just like a human. Whether it's daily check-ins, data entry, or complex multi-app workflows, the AI can handle it with ease.

Before starting your first automation task, please ensure you have completed the following preparations to grant the AI the necessary capabilities and permissions.

### 1. Configure Your AI Brain: Model Configuration

A powerful and correctly configured language model is the foundation for understanding and executing complex tasks. You need to set up a working AI model for Operit AI. We recommend using a high-performance model for the best experience.

For detailed instructions on how to configure a model, please refer to our guide: [Model & Parameter Configuration](/#/guide/basic-config/model-config).

> **Note:** If you are using the official DeepSeek API, we recommend enabling [Max Mode](/#/guide/tools-and-features/context-summary) in the conversation settings. Due to the API's caching mechanism, this can reduce unnecessary context summarization and improve performance.

### 2. Grant Software Operation Permissions

To allow the AI to observe the screen and simulate actions like tapping, swiping, and typing, you need to grant the app the appropriate system permissions. UI Automation requires at least **Accessibility Permissions**. Depending on the complexity of your tasks, you may need to grant higher-level permissions, such as **Debug Permissions (Shizuku)** or **Root Permissions**.

Please go to the authorization screen to grant permissions based on your device and needs. For more details, see: [Authorizing the Software](/#/guide/basic-config/software-authorization).

### 3. Set AI Tool Permissions

Next, you need to decide how the AI uses tools when performing tasks. You can set it to "Auto-Approve" for the smoothest automation experience or choose "Always Ask" to retain final control over every action.

Configure this in the permission settings based on your level of trust and usage scenario. For setup instructions, see: [AI Permission Control](/#/guide/basic-config/ai-permissions).

### 4. Enable the UI Automation Tool Package

With everything ready, let's enable the core tool package for UI automation.

Go to the "Package Management" screen in the app, find the `Automatic_ui_base` tool package under the **Automatic** category, and turn on the switch next to it.

![](/manuals/assets/automatic/2.png)

### 5. Start Your Automation Task

After completing all the steps above, you can start your first UI automation task. Return to the main chat screen and click the floating window button in the toolbar above the input box to launch the automation process. Now, just tell the AI what you want to do in natural language!

![](/manuals/assets/automatic/3.jpg)
