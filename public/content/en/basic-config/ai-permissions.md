# AI Permission Control

Operit AI can use tools to interact with your device and software. To ensure you have complete control over the AI's actions, we've designed a flexible permission system. You can fine-tune whether the AI needs to ask for your approval before performing different operations.

## Version Information

The permission system was significantly updated in versions 1.6.1 and 1.6.5. For easier reference, this document describes three situations:

-   **Before 1.6.1**: Permissions are controlled by the "Global" and "System Operation" categories.
-   **1.6.1 - 1.6.4**: The first generation of the per-tool permission system.
-   **1.6.5 and later**: The new "Global default + per-tool exceptions" permission system.

---

## Permission System Before v1.6.1 (Category-based Control)

In the old system, permissions were controlled by "Global" and "System Operation" categories.

### Quick Toggle: Global Auto-Approve

In the chat window's settings, there is a quick toggle for "Auto-Approve".

![Global Auto-Approve Switch](</manuals/assets/permission/image.png>)

-   **On**: The AI will automatically perform operations based on the permission levels you've configured in the main settings.
-   **Off**: The AI will pop up a dialog to ask for your permission before performing any operation.

This is a master switch for quick changes between different scenarios.

### Detailed Permission Settings

For more fine-grained configuration, go to "Settings" > "Data & Permissions" > "Tool Permission Settings".

![Tool Permission Settings Entry](</manuals/assets/permission/image2.png>)

Here, you can set "Global Permissions" and "System Operation Permissions" separately.

![Permission Level Configuration](</manuals/assets/permission/image3.png>)

#### Permission Level Descriptions

You will see four permission levels:

-   **Allow (Auto-execute)**: The highest level. The AI will automatically perform all operations without asking. Use this only when you fully trust the AI.
-   **Cautious (Ask for dangerous operations)**: The AI will auto-execute most safe operations but will ask for your confirmation for risky actions like modifying files or running high-risk commands.
-   **Ask (Always ask)**: The safest mode. The AI will request your authorization before performing any operation.
-   **Forbid (Do not allow execution)**: Completely prohibits the AI from using any tools.

#### How Do Permissions Work?

The system's logic is: **Check the master switch first, then the specific category.**

1.  **"Global Permissions" is the master switch.** If you set it to "Ask" or "Forbid", all operations will be forced into "Ask" or "Forbid" mode, regardless of other settings.

2.  If "Global Permissions" is set to "Allow" or "Cautious", the system will then check the specific category of the operation (e.g., "System Operation Permissions") to determine the final action.

**For example:**

If you configure it like this:
-   **Global Permissions** -> `Allow (Auto-execute)`
-   **System Operation Permissions** -> `Ask (Always ask)`

Then:
-   When the AI performs a **normal operation**, it will follow the `Allow` rule from "Global Permissions" and execute automatically.
-   When the AI needs to **modify system settings**, it will follow the `Ask` rule from "System Operation Permissions" and pop up a dialog to request your approval.

---

## Permission System in v1.6.1 - v1.6.4 (Individual Tool Control)

This section only applies to versions 1.6.1 - 1.6.4. If you're using version 1.6.5 or later, please refer to the next section, "Permission System in v1.6.5 and Later".

Starting from version 1.6.1, the permission system was upgraded to a "Global Permission + Individual Tool Exception" model, allowing for more granular control.

### Quick Toggle: Global Auto-Approve

Just like the old version, the "Auto-Approve" quick toggle remains in the chat window to quickly enable or disable auto-execution for all tools.

![Global Auto-Approve Switch](</manuals/assets/permission/image.png>)

### Detailed Permission Settings

For detailed configuration, go to "Settings" > "Data & Permissions" > "Tool Permission Settings".

![Tool Permission Settings Entry](</manuals/assets/permission/image2.png>)

### Tool Permission Management

The new management interface, shown below, lets you set a global rule and add exceptions for specific tools.

![Tool Permission Management Interface](</manuals/assets/permission/a3d6dceea288c5ba84b6b4c78c446caa.jpg>)

#### Global Permission Mode

This is the default rule that applies to all tools:

-   **Allow**: Automatically executes all tool operations without asking.
-   **Cautious**: Automatically executes safe operations but will ask for confirmation before performing high-risk actions like modifying or deleting files.
-   **Ask**: **(Default)** Requests your authorization before using any tool.
-   **Forbid**: Completely prohibits the AI from using any tools.

#### How to Configure Individual Tool Permissions

To understand this system, the most crucial point is: **Every tool's initial default state is "needs to be asked," and the Global Permission Mode determines how to handle this state.**

**The Core Logic:**

-   **Global `Ask`, `Cautious`, or `Forbid` Modes**: These are mandatory rules. When set, the system **ignores** the individual permission status of each tool and strictly follows the global rule (either asks, acts cautiously, or forbids).

-   **Global `Allow` Mode**: This mode is unique. It does **not** mean "allow all tools." Instead, it **"enables the system to check the permission status of each individual tool."**

**What is the user's authorization workflow?**

If your goal is to have the AI eventually auto-execute most operations, you need to do the following:

1.  Set the **Global Permission Mode** to `Allow`.
2.  Next, when the AI uses a tool for the **first time** (e.g., `read_file`), it will still **pop up a permission request dialog**, because the tool's default state is "needs to be asked."
3.  In this dialog, click **"Always Allow"**.
4.  After this step, the `read_file` tool is now permanently authorized by you. In the future, as long as the global mode is `Allow`, it will **execute automatically** without asking again.

You need to repeat steps 2 and 3 for every tool you want to run automatically. This way, you can gradually build a set of trusted tools that can be auto-executed.

**In Summary:**

-   To make it **possible** for a tool to be auto-executed, you **must** first set the global mode to `Allow`.
-   In `Allow` mode, whether a tool **actually** auto-executes depends on if you have already clicked "Always Allow" in its first-use permission request.

We acknowledge that this design may be counter-intuitive, and we hope this explanation helps you configure the settings accurately.

## Permission System in v1.6.5 and Later (Global Default + Per-Tool Exceptions)

Starting from version 1.6.5, the permission system follows a "Global default + per-tool exceptions" model. You can think of it as having two layers:

-   **Global default permission**: A base strategy that applies to all tools.
-   **Per-tool exception rules**: Special rules for specific tools that override the global default.

When the system decides how to run a tool, it follows a simple rule:

> **First check whether the tool has its own exception rule. If yes, use that. If not, fall back to the global default.**

### Permission Levels

The new system still uses the same four permission levels (both for the global default and for individual tools):

-   **Allow (ALLOW)**: Run the tool directly without asking each time.
-   **Cautious (CAUTION)**: Auto-execute by default, but show a confirmation dialog for operations that look risky.
-   **Ask (ASK)**: Always show a confirmation dialog before each call.
-   **Forbid (FORBID)**: Completely block this tool from being executed.

### Global Default Permission

In the "Tool Permission Settings" page, you can first choose a **global default permission**. It applies to **all tools that do not have a custom exception rule**:

-   If you set the global default to **Ask (ASK)**, then any tool **without its own rule** will always ask before running.
-   If you set the global default to **Cautious (CAUTION)**, these tools will run automatically most of the time, but a dialog will appear for high-risk actions.
-   If you set the global default to **Forbid (FORBID)**, all tools without a custom rule will be blocked.

### Per-Tool Exception Rules

On the same page, you will see four groups: **Allow / Cautious / Ask / Forbid**. You can add tools into these groups (for example, by selecting or dragging them) to give them **exception rules**:

-   Putting a tool into the **Allow** group means: this tool will always auto-execute, regardless of the global default.
-   Putting a tool into the **Cautious** group means: this tool always follows the cautious behavior and only asks for high-risk actions.
-   Putting a tool into the **Ask** group means: this tool will ask for confirmation every time you call it.
-   Putting a tool into the **Forbid** group means: this tool is always blocked.

As long as a tool appears in any of these groups, it is treated as having a **per-tool exception rule**, which **overrides** the global default.

If you want a tool to go back to simply "following the global default," you can:

-   Click the tool again in its group to remove it, or
-   Uncheck the tool from the selection dialog.

After you remove the exception rule, the tool's behavior will once again be determined only by the global default.

### Recommended Setups

Here are some common and easy-to-understand combinations you can use:

-   **More conservative overall, only trust a few tools**  
    - Global default: **Ask (ASK)**.  
    - Put only fully trusted read-only or side-effect-free tools (such as code search or calculator) into the **Allow (ALLOW)** group.  
    Result: Most tools will always ask first; only the tools you explicitly put into "Allow" will run silently.

-   **More automatic overall, only confirm high-risk actions**  
    - Global default: **Cautious (CAUTION)**.  
    - Put tools you consider more dangerous (such as file modification or command execution) into the **Ask (ASK)** or **Forbid (FORBID)** group.  
    Result: Normal tools behave more automatically; truly sensitive tools are still strictly controlled.

-   **Extreme safety mode, only allow a small whitelist of tools**  
    - Global default: **Forbid (FORBID)**.  
    - Only add the tools you trust into the appropriate groups (Allow / Cautious / Ask).  
    Result: By default, all tools are disabled; only tools you explicitly whitelist can be used, and they follow the permission level you assign.

### Common for v1.6.1 and Later: Permission Request Dialog

When the AI needs your approval for an action, a dialog like this will appear:

![Permission Request Dialog](</manuals/assets/permission/60a4d8ccc51c010cedd98dbdf5fd842d.jpg>)

The dialog clearly lists the **tool**, **action**, and **parameters** the AI wants to use. You can choose to:

-   **Reject**: Block this single action.
-   **Allow**: Approve only this single action.
-   **Always Allow**: Approve this action and grant permanent permission for this tool. It will be auto-executed in the future (in `Allow` mode).

With this permission system, you can find the perfect balance between convenience and security.
