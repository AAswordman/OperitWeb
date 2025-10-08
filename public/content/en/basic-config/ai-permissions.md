# AI Permission Control

Operit AI empowers AI with powerful tool usage capabilities, enabling it to interact with your device and various software. To ensure you have complete control over AI behavior, we have designed a flexible permission management system. You can finely adjust whether AI needs your permission before executing operations according to your needs.

## Quick Access: Global Auto-Approval

In the conversation interface, we provide a convenient quick switch to control global tool permissions.

![Global Auto-Approval Switch](</manuals/assets/permission/image.png>)

As shown in the image above, you can directly find the "Auto Approve" switch in the conversation settings.

-   **Enabled**: AI will automatically execute tools according to the permission level you configured in settings, without asking every time.
-   **Disabled**: AI will request your permission before executing any tool operation.

This switch provides you with a quick way to toggle global permission mode, very suitable for adjusting in different usage scenarios.

## Detailed Permission Settings

If you need more fine-grained permission management, you can enter the app's "Settings" page for detailed configuration.

1.  **Enter Settings**: Find and click "Settings" in the main menu.
2.  **Find Permission Settings**: In the settings page, find the "Data and Permissions" section, then click "Tool Permission Settings".

![Tool Permission Settings Entry](</manuals/assets/permission/image2.png>)

## Configure Permission Levels

On the "Tool Permissions" page, you can configure "Global Permissions" and "System Operation Permissions" separately.

![Permission Level Configuration](</manuals/assets/permission/image3.png>)

### Global Permission Switch

This setting controls all non-system-level AI tool permissions.

-   **Allow (Auto-execute, no asking)**: AI will automatically execute all tool operations without seeking your consent. This is the highest permission level; please use it when you completely trust the current AI configuration.
-   **Cautious (Only ask for dangerous operations)**: AI will automatically execute most operations, but will pop up a confirmation request for dangerous operations that may modify or delete files, execute high-risk commands, etc.
-   **Ask (Always ask)**: AI will request your authorization before using any tool. This is the safest mode.
-   **Forbid (Not allowed to execute)**: Completely prohibit AI from using any tools.

### System Operation Permissions

This setting is specifically for more sensitive system-level operations, such as modifying system settings, installing/uninstalling apps, etc. You can set an independent permission level for it to achieve stricter control.

### Permission Priority Logic

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

Through this permission system, you can find the best balance between convenience and security for yourself.

