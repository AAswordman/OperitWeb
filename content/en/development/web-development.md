### Creating Web: Using Workspace

Workspace is a dedicated file environment provided by Operit AI that allows AI to directly write code, modify files, and perform other operations under your guidance, greatly enhancing AI's practicality in tasks such as Web development.

![Set Workspace](/manuals/assets/workspace/image.png)

#### Entering and Setting Up Workspace

In the AI chat interface, click the button in the upper right corner to enter the workspace settings page. Here, you can choose:

*   **Create Default**: This will create a new workspace for you in the `Download/Operit/workspace/{chatId}/` directory and automatically generate an `index.html` file as a starting point. Each conversation (chatId) will have its own independent workspace.
*   **Select Existing**: If you already have a project folder, you can select this option to bind the workspace to any folder on your device.

#### Workspace Interaction

When you send messages in a conversation with a bound workspace, AI can not only see your instructions but also perceive the file structure and content changes of the entire workspace. This enables AI to:

*   Read file contents to understand existing code.
*   Create, modify, or delete files to complete your development needs.
*   Execute file operations such as move, copy, etc.

All operations within the workspace are logged and backed up to ensure your project's security.

#### File Rollback

> **⚠️ Important Warning (Version 1.5.0 / 1.5.1 / 1.5.2)**
> 
> If you are using **version 1.5.0, 1.5.1, or 1.5.2**, **it is strongly recommended NOT to use the file rollback feature in custom folder workspaces**! These versions contain a critical bug that will accidentally delete non-text files (such as images, videos, binary files, etc.) when performing file rollback. This issue has been fixed in subsequent versions. Please upgrade to the latest version before using this feature.

Workspace provides a powerful file version rollback feature. When you need to undo a certain operation by AI, simply **long-press the message you sent**, and select **"Edit and Resend"** from the popup menu. At this point, all text files in the workspace will be rolled back to the state before you sent that message.

#### File Filtering

To keep the workspace clean and efficient, the file list and backup functions intelligently ignore rules defined in the `.gitignore` file, excluding dependency folders like `node_modules` or temporary files.

#### Guiding AI in Development

You can directly give instructions to AI to create and modify code files in the workspace. For example:

"Please create an `index.html` file and write the basic HTML structure."

AI can use built-in toolkits or terminals to run and test code, providing you with immediate feedback.

**Tip:** When asking AI to modify an existing file, it's best to have it read the file first. This way, AI can more accurately understand the context and provide higher-quality modifications. For example: "Please read the contents of `script.js` first, then add a parameter to the function in it."

