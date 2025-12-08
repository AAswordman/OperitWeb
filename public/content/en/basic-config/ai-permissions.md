# AI Permission Control

Operit AI can use tools to interact with your device and software. To ensure you have complete control over the AI's actions, we've designed a flexible permission system. You can fine-tune whether the AI needs to ask for your approval before performing different operations.

## Version Information

The permission system received a major update in version 1.6.1. This document will explain the permission systems **before** and **after** version 1.6.1.

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

## Permission System in v1.6.1 and Later (Individual Tool Control)

Starting from version 1.6.1, the permission system was upgraded to a "Global Permission + Individual Tool Exception" model, allowing for more granular control.

### Quick Toggle: Global Auto-Approve

Just like the old version, the "Auto-Approve" quick toggle remains in the chat window to quickly enable or disable auto-execution for all tools.

![Global Auto-Approve Switch](</manuals/assets/permission/image.png>)

### Detailed Permission Settings

For detailed configuration, go to "Settings" > "Data & Permissions" > "Tool Permission Settings".

![Tool Permission Settings Entry](</manuals/assets/permission/image2.png>)

### Tool Permission Management

The new management interface, shown below, lets you set a global rule and add exceptions for specific tools.

![Tool Permission Management Interface](</manuals/assets/permission/60a4d8ccc51c010cedd98dbdf5fd842d.jpg>)

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

### Permission Request Dialog

When the AI needs your approval for an action, a dialog like this will appear:

![Permission Request Dialog](</manuals/assets/permission/a3d6dceea288c5ba84b6b4c78c446caa.jpg>)

The dialog clearly lists the **tool**, **action**, and **parameters** the AI wants to use. You can choose to:

-   **Reject**: Block this single action.
-   **Allow**: Approve only this single action.
-   **Always Allow**: Approve this action and grant permanent permission for this tool. It will be auto-executed in the future (in `Allow` mode).

With this permission system, you can find the perfect balance between convenience and security.
