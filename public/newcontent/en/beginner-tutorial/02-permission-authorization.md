# Authorize the App

“Authorize the app” here means granting Operit AI some phone permissions so it can work better.

Some permissions are higher level, like root, but many people don’t have it. And for Shizuku, some people want to use it while others don’t. So what should we do? That’s why the app provides permission levels: we can choose the highest permission we can grant, or choose the permission level we want it to run with.

## Permission Level Overview

There are 5 permission levels in total, from left to right: Standard Permission, Accessibility Permission, Debug Permission, Admin Permission, and ROOT Permission.

**Standard Permission**: The basic level for app operation. 4 of these permissions are configured when you first enter the app. This level can satisfy most usage scenarios.

> Standard Permission is generally the most recommended choice.

**Accessibility Permission**: On top of Standard Permission, it adds **Accessibility Service** capability, enabling screen content analysis and automated clicking. But seriously—some apps (like WeChat) may scan for this, and in severe cases it can lead to account bans.

**Debug Permission (Shizuku)**: Compared with accessibility-based automation, this is more stable, and it also adds support for automated virtual display. In addition, it can access files under Android/data, and AI can execute adb shell commands. Don’t run this while playing Delta Force—this may be treated as cheating. One downside of this level is that Shizuku may drop after reboot, though you can search online for keep-alive methods.

> Android/data mainly stores app external data. For example, downloaded files from WeChat/QQ are usually stored there. Of course, even without Debug Permission, we can still send files to Operit AI through sharing.

**Root Permission**: Highest level, with full system control. More stable and broader than Debug Permission. Use it based on your own situation—many devices today can’t root anymore.

> **Note**: The Admin permission level is not implemented yet. Reason: it’s not very useful and is similar to Debug in practice.

![Permission Authorization Page](/manuals/assets/permission/01d2b96a666ad11ff10e5cc609a4e5c0.png)

Below is a detailed introduction of each permission level.

### Standard Permission

This includes the most basic permissions: storage, floating window, background optimization, and location. Actually, location and background optimization are not strictly required, but we request them together here.

Some phones may refuse authorization and say the app is risky. Don’t worry about that—the source code is open and you can review it yourself. Also, on some brands like OPPO, you may need to remove additional authorization restrictions. You can search online for specific steps.

### Accessibility Permission

At this level, based on **Standard Permission**, the app additionally requests **Accessibility Service** permission.

Accessibility Service will install a separate app. Why separate? Because many apps scan this component, so we avoid embedding it directly in the main app and use an indirect calling method instead. This permission may also drop easily, but you can try enabling a floating shortcut in settings—it becomes much more stable.

### Debug Permission (Shizuku)

At this level, based on **Accessibility Permission**, with [Shizuku](https://shizuku.rikka.app/), Operit AI can obtain ADB-level system access to enable more features without requiring a rooted device. (Honestly, not that much more.)

**Enable Shizuku service**: You need to install and run Shizuku on your device first, then grant Shizuku permission in Operit AI.

Modified versions of Shizuku also work. If your phone doesn’t have it installed, the app provides guidance as well. Many users may get stuck at the pairing step—check Shizuku docs and search tutorials online; this product is already very mature.
From my personal developer experience, wireless pairing via hotspot may get stuck on some phones, while pairing over normal Wi-Fi works fine.

![Debug Permission Features](/manuals/assets/permission/2629795022e245442e9604452aaf30ea.png)

### Root Permission

This level is for devices that already have Root access. Operit AI will get the highest control level, with broader permission scope and better stability than Debug Permission.

> **Warning**: Root permission carries high risk. Only grant it if you fully understand the risks and trust this app. Improper operations may cause device damage or data loss.

## How to Authorize

When you first enter the app, the onboarding page asks you to choose a permission level. If you need to change it later, go to the main page or settings, find “Permission Authorization”, click the level you want, then click: **Set as Current Level**. You must click this, otherwise it is not enabled.

### Operit Terminal Authorization

This still needs to be explained separately. As mentioned in the previous article, it’s not mandatory, but some tools and MCP depend on terminal support.

#### Step 1: Open the Terminal

In the AI chat interface, click the **left terminal button** in the top-right tool area to switch to the terminal interface. The main interface layout will be explained in the next article. Also, it can be opened from the permission onboarding page as well.

![](/manuals/assets/terminal/config/1.png)

In the bottom-right corner of the terminal interface, click **“Environment Setup”** to enter the quick setup wizard for terminal environment.

#### Step 2: Check Options in Environment Setup

In the pop-up environment setup window:

- You only need to check the **first two** options; checking the first three is also okay. Full selection is not recommended, because it takes too much storage.
- Then click **“Start Setup”** and wait for the system to run setup scripts automatically:

![](/manuals/assets/terminal/config/2.png)

#### Step 3: Wait for Setup to Finish

When terminal output shows the following interface, it means environment setup has been completed successfully, and terminal features are ready to use:

![](/manuals/assets/terminal/config/3.png)

#### Advanced Settings (Optional)

After completing basic setup, you can still adjust advanced options in terminal **“Settings”** (bottom-right) to better match your usage scenario.

##### 1) chroot Mode

**Suitable for**: users with rooted devices who want to run Ubuntu in chroot mode.

You can find the **“chroot mode”** toggle in settings:

- When off, terminal starts in default mode (more stable compatibility);
- When on, terminal starts in chroot mode and mounts common system directories;
- This mode requires a rooted device and Root permission granted to the app;
- If enabling this causes terminal startup failures or more errors, turn it off first and retry.

Mainly, it can improve performance.

#### 2) SSH Connection (Alternative Mode)

**Suitable for**: when you want a remote server as your main working environment, or local device performance is not enough.

Suggested steps:

1. Go to **“Environment Setup”** and install SSH tools (`ssh`, `sshpass`);
2. In SSH settings, fill in host, port, username, and authentication method (password or key);
3. Turn on **“Enable SSH Connection”**.

After enabling, SSH becomes the **primary terminal environment** used by AI:

- AI command execution runs in that SSH environment;
- MCP runs in that SSH environment;
- AI Linux-side file read/write also happens in that SSH environment.

In other words, once enabled, the remote environment replaces local terminal capability. You can target Termux on your phone, or a standalone Linux server.

If you only need AI to temporarily use remote Linux in specific tasks, it is usually better to directly ask AI to use SSH tools in chat. That’s lighter and won’t switch your main terminal environment long-term.

From my personal developer usage, I don’t use this option much—I prefer the linux ssh tool, which is also very stable. This option is mainly for users who really, really want to run MCP inside Termux instead of OPR built-in terminal, and for users who need Termux as a backup when serious bugs appear.

#### 3) Reverse Mount (Used with SSH)

**Suitable for**: developing on a remote server but still wanting direct access to local phone files.

After enabling **“Reverse Mount”** in SSH settings, remote side can access local files through:

- `~/storage`
- `~/sdcard`

Before enabling, make sure:

- local environment has `openssh-server` installed (can be installed in Environment Setup);
- remote server has `sshfs` installed;
- reverse-mount related port and local SSH account info are filled correctly.

If mounting still fails after enabling, check these three points first, then reconnect SSH.

#### 4) Mirror Sources (Package Source Management)

When you encounter slow downloads, timeouts, install failures, etc., you can switch mirrors in **“Package Source Management”**.

You can select source separately for:

- APT
- PIP (also affects uv)
- NPM
- Rust

Custom sources are also supported. After switching, future installs use your selected source; if it’s only an occasional network issue, switching source and retrying is usually enough.

### Oh no! BUG appears!

If your terminal behaves abnormally and shows obvious errors, pay attention.

If exceptions occur during terminal environment setup, you can first troubleshoot and repair via terminal **“Settings”**:

- In the bottom-right of terminal interface, click **“Settings”**;
- This opens the terminal settings page below, which includes **source switching**, **reset**, etc.:

![](/manuals/assets/terminal/config/4.png)

Below are two relatively typical issues and their solutions:

#### Issue 1: “Request error” appears when installing packages

Example:

![](/manuals/assets/terminal/config/5.jpg)

**Possible cause**: the current mirror/source has poor network status (timeout, blocked access, etc.), causing request failure.

**Solution**:

1. Click **“Settings”** in the bottom-right of terminal, enter terminal settings;
2. Try switching/updating download source in settings (use a more reachable source);
3. Save settings, then rerun environment setup or related install command.

Of course, if you still can’t solve it, go back to chat and explain it to AI—AI can help install it for you.

#### Issue 2: No operit prompt appears in terminal, and there are many errors

Example (multiple errors in terminal, failed to enter operit environment normally):

![](/manuals/assets/terminal/config/6.jpg)
![](/manuals/assets/terminal/config/7.jpg)
![](/manuals/assets/terminal/config/8.jpg)

**Possible cause**: previous environment setup was incomplete or interrupted, leaving terminal in abnormal state.

**Solution**:

1. Click **“Settings”** at the bottom-right of terminal interface;
2. Click **“Reset”** in settings to restore terminal environment to initial state;
3. Close and **restart Operit AI app**;
4. Follow the earlier steps on this page to configure terminal environment again.

#### Issue 3: Terminal has output, but permission page still shows all unauthorized

Example:

![](/manuals/assets/terminal/config/9.jpg)

**Possible cause**: terminal is still running auto-setup scripts in background, and permission status is not refreshed yet.

**Solution**:

- Do not perform other complex operations immediately; first **wait patiently for terminal setup to finish**;
- After terminal output stabilizes and scripts complete, reopen the permission page. In most cases it will automatically return to the correct authorization state.
