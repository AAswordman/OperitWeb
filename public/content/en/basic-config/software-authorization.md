# Authorizing the Software

In Operit AI, permission management is key to ensuring the app functions properly while protecting user privacy and device security. You need to grant appropriate permissions to AI and various features in the app. This section will detail the meaning of different permission levels and how to grant authorization.

## Permission Level Overview

Operit AI provides four permission levels from basic to professional. You can choose according to your needs and device capabilities. Each level builds upon the previous one, providing more functionality.

*   **Standard Permissions**: The foundation for app operation, without performing any special operations.
*   **Accessibility Permissions**: On top of standard permissions, adds the ability to use **Accessibility Services**, enabling screen content analysis and automated clicking.
*   **Debug Permissions (Shizuku)**: On top of accessibility permissions, gains more advanced system capabilities through Shizuku/ADB, allowing code execution, app file operations, local MCP execution, etc.
*   **Root Permissions**: The highest level of permissions, with complete system control, more stable and broader in scope than debug permissions.

> **Note**: The Administrator (Admin) permission level is not yet implemented.

![Permission Grant Page](/manuals/assets/permission/01d2b96a666ad11ff10e5cc609a4e5c0.png)

Below is a detailed introduction to each permission level.

### Standard Permissions

Standard permissions are the minimum set of permissions required for the app to run, not including any advanced system-invasive operations. Main permissions include:

*   **Storage Permission**: Used to save and read app data, character cards, knowledge base, etc.
*   **Overlay Permission**: Allows the app to display content over other apps, the foundation for implementing desktop pets, floating menus, and other features.
*   **Battery Optimization Exemption**: Ensures the app won't be accidentally terminated by the system when running in the background, guaranteeing service stability.
*   **Location Permission**: Optional permission, used for implementing location-related functions.
*   **Built-in Terminal**: Optional permission, used for executing some advanced scripts and commands.

### Accessibility Permissions

This level requests **Accessibility Service** permissions in addition to **Standard Permissions**.

Accessibility Service allows Operit AI to analyze screen content and simulate user operations, which is the core of implementing complex automation workflows and intelligent scene recognition. Main functions include:

*   **Screen Content Analysis**: AI can "see" the current screen content and make judgments and responses accordingly.
*   **Simulate Operations**: AI can simulate clicks, swipes, input, and other operations to automatically complete tasks.

### Debug Permissions (Shizuku)

This level, on top of **Accessibility Permissions**, uses [Shizuku](https://shizuku.rikka.app/) to allow Operit AI to gain ADB-level system access, enabling more advanced features without rooting the device.

*   **Enable Shizuku Service**: You need to first install and run Shizuku on your device, then grant Shizuku permissions in Operit AI.

![Debug Permission Features](/manuals/assets/permission/2629795022e245442e9604452aaf30ea.png)

After enabling debug permissions, you will unlock the following features:
*   **File Operations**: More powerful file management capabilities.
*   **Android/data and data/data Access**: Access private data directories of other apps (requires Shizuku authorization).
*   **Screen Auto-Click**: Simulate screen click operations for automated tasks.
*   **System Permission Modification**: Make some system-level setting adjustments that require higher permissions.
*   **Run JS and Script Support**: More powerful script execution capabilities, can execute local MCP.
*   **Plugin Market MCP**: Support for richer plugin extensions.

### Root Permissions

This level is for devices that have obtained Root access. Operit AI will gain the highest level of control, with a broader permission scope than debug permissions and more stable operation.

> **Warning**: Root permissions are extremely risky. Please only grant them if you fully understand the risks and trust this application. Improper operations may cause device damage or data loss.

## How to Grant Authorization

1.  **Enter Permission Grant Page**: In the app's main interface or settings, find the "Permission Grant" or "Authorize Software" entry.
2.  **Select Permission Level**: According to your needs and device situation (whether rooted or Shizuku installed), choose the permission level you wish to grant.
3.  **Grant Basic Permissions**: Click on items in the basic permissions list one by one and complete authorization according to system prompts.

Make sure you have granted the permissions corresponding to the required functions to get the best user experience.

