# AI Permission Control

Operit AI empowers AI with powerful tool usage capabilities, enabling it to interact with your device and various software. To ensure you have complete control over AI behavior, we have designed a flexible permission management system. You can finely adjust whether AI needs your permission before executing operations according to your needs.

## Version Information

The permission system underwent a major update in version 1.6.1. This document will introduce the permission systems before and after version 1.6.1 separately.

---

## Permission System Before 1.6.1 (Category Permissions)

### Quick Access: Global Auto-Approval

In the conversation interface, we provide a convenient quick switch to control global tool permissions.

![Global Auto-Approval Switch](</manuals/assets/permission/image.png>)

As shown in the image above, you can directly find the "Auto Approve" switch in the conversation settings.

-   **Enabled**: AI will automatically execute tools according to the permission level you configured in settings, without asking every time.
-   **Disabled**: AI will request your permission before executing any tool operation.

This switch provides you with a quick way to toggle global permission mode, very suitable for adjusting in different usage scenarios.

### Detailed Permission Settings

If you need more fine-grained permission management, you can enter the app's "Settings" page for detailed configuration.

1.  **Enter Settings**: Find and click "Settings" in the main menu.
2.  **Find Permission Settings**: In the settings page, find the "Data and Permissions" section, then click "Tool Permission Settings".

![Tool Permission Settings Entry](</manuals/assets/permission/image2.png>)

### Configure Permission Levels

On the "Tool Permissions" page, you can configure "Global Permissions" and "System Operation Permissions" separately.

![Permission Level Configuration](</manuals/assets/permission/image3.png>)

#### Global Permission Switch

This setting controls all non-system-level AI tool permissions.

-   **Allow (Auto-execute, no asking)**: AI will automatically execute all tool operations without seeking your consent. This is the highest permission level; please use it when you completely trust the current AI configuration.
-   **Cautious (Only ask for dangerous operations)**: AI will automatically execute most operations, but will pop up a confirmation request for dangerous operations that may modify or delete files, execute high-risk commands, etc.
-   **Ask (Always ask)**: AI will request your authorization before using any tool. This is the safest mode.
-   **Forbid (Not allowed to execute)**: Completely prohibit AI from using any tools.

#### System Operation Permissions

This setting is specifically for more sensitive system-level operations, such as modifying system settings, installing/uninstalling apps, etc. You can set an independent permission level for it to achieve stricter control.

#### Permission Priority Logic

To give you more flexible control over AI, the permission system adopts a layered logic. **Global permission settings have the highest priority and can be seen as the master switch.**

1.  **When global permission is set to "Ask (Always ask)" or "Forbid (Not allowed to execute)"**:
    *   This will become a mandatory global rule. All tools, regardless of their specific category permissions, will be uniformly required to "ask" or be "forbidden".

2.  **When global permission is set to "Allow (Auto-execute)" or "Cautious (Only ask for dangerous operations)"**:
    *   The master switch is considered "on", and the system will further check the permission settings of the specific operation category (e.g., "System Operation Permissions").
    *   Whether to execute, ask, or forbid will ultimately be determined by this **more specific subcategory permission setting**.

**For example:**

Suppose you make the following configuration:

*   **Global Permission Switch** -> `Allow (Auto-execute, no asking)`
*   **System Operation Permissions** -> `Ask (Always ask)`

When AI needs to execute a **normal operation** (not a system operation), it will automatically execute because it meets the global "Allow" rule.
However, when AI needs to **modify system settings**, it will match the more specific rule "System Operation Permissions", so it will **pop up a dialog to ask you** instead of auto-executing.

---

## Permission System in 1.6.1 and Later (Global Permissions + Individual Tool Permissions)

Starting from version 1.6.1, the permission system underwent a major improvement, changing from "Global Permissions + Category Permissions" to "Global Permissions + Individual Tool Permissions", allowing you to have more fine-grained control over the execution permissions of each tool.

### Quick Access: Global Auto-Approval

In the conversation interface, we provide a convenient quick switch to control global tool permissions.

![Global Auto-Approval Switch](</manuals/assets/permission/image.png>)

As shown in the image above, you can directly find the "Auto Approve" switch in the conversation settings.

-   **Enabled**: AI will automatically execute tools according to the permission level you configured in settings, without asking every time.
-   **Disabled**: AI will request your permission before executing any tool operation.

This switch provides you with a quick way to toggle global permission mode, very suitable for adjusting in different usage scenarios.

### Detailed Permission Settings

If you need more fine-grained permission management, you can enter the app's "Settings" page for detailed configuration.

1.  **Enter Settings**: Find and click "Settings" in the main menu.
2.  **Find Permission Settings**: In the settings page, find the "Data and Permissions" section, then click "Tool Permission Settings".

![Tool Permission Settings Entry](</manuals/assets/permission/image2.png>)

### Tool Permission Management Interface

On the "Tool Permissions" page, you can configure the global permission switch and set exception rules for individual tools.

![Tool Permission Management Interface](</manuals/assets/permission/60a4d8ccc51c010cedd98dbdf5fd842d.jpg>)

#### Global Permission Switch

The global permission switch acts as the main control and can override individual tool permissions. You can choose from the following four modes:

-   **Allow**: AI will automatically execute all tool operations without seeking your consent. This is the highest permission level; please use it when you completely trust the current AI configuration.
-   **Cautious**: AI will automatically execute most operations, but will pop up a confirmation request for dangerous operations that may modify or delete files, execute high-risk commands, etc.
-   **Ask**: AI will request your authorization before using any tool. This is the safest mode and the default mode.
-   **Forbid**: Completely prohibit AI from using any tools.

**By default, all tools require you to ask. You can add exceptions below.**

#### Individual Tool Permission Settings

Below the global permission switch, you can set exception rules for specific tools. The system provides multiple permission categories, and you can add tools to the allowed list for automatic execution:

-   **Allow List**: These tools will run automatically without asking. You can click the "+" button on the right to add tools to this list, or click the "X" button to the right of each tool to remove it.

Through this method, you can achieve more fine-grained permission control:
-   If the global permission is set to "Ask", but you want certain commonly used tools (such as `read_file`, `list_files`) to execute automatically, you can add them to the "Allow" list.
-   If the global permission is set to "Allow", but you want certain sensitive tools (such as `delete_file`) to always ask, you can keep them out of the "Allow" list.

### Permission Request Dialog

When AI needs to execute a tool that is not in the allow list, the system will pop up a permission request dialog.

![Permission Request Dialog](</manuals/assets/permission/a3d6dceea288c5ba84b6b4c78c446caa.jpg>)

The permission request dialog will display the following information:

-   **Requested Operation**: The specific operation AI wants to perform (such as using a toolkit, executing file operations, etc.)
-   **Tool Used**: The specific tool name being used
-   **Parameter Details**: Parameter information required for tool execution

You can choose:

-   **Reject**: Reject this operation request
-   **Allow**: Allow this operation to execute
-   **Always Allow**: Allow this operation and add the tool to the "Allow" list, so it will execute automatically in the future without asking

**Note:** You can change permission settings at any time in settings.

### Permission Priority Logic

The new permission system adopts the following priority logic:

1.  **Global Permission Switch**: As the main control, it has the highest priority
    -   When the global permission is set to "Ask" or "Forbid", all tools will follow this rule (unless tools in the allow list will still be asked in "Ask" mode)
    -   When the global permission is set to "Allow" or "Cautious", the system will check individual tool permission settings

2.  **Individual Tool Permissions**: When the global permission allows, individual tool permission settings will take effect
    -   Tools in the "Allow" list will execute automatically
    -   Tools not in the "Allow" list will pop up a permission request dialog

**For example:**

Suppose you make the following configuration:

*   **Global Permission Switch** -> `Ask`
*   **Allow List** -> `read_file`, `list_files`, `query_memory`

When AI needs to execute `read_file`, since it's in the allow list, it will execute automatically.
When AI needs to execute `delete_file`, since it's not in the allow list, it will pop up a permission request dialog to ask for your permission.

Through this permission system, you can find the best balance between convenience and security for yourself.
