# Terminal Configuration

This page explains how to quickly set up the basic terminal environment in Operit AI.

## Step 1: Open the Terminal from the Chat Screen

In the AI chat interface, click the **terminal button on the left side of the top-right toolbar** to switch to the Terminal view:

![](/manuals/assets/terminal/config/1.png)

In the bottom-right corner of the Terminal view, click the **"Environment Config"** button to open the quick configuration wizard.

## Step 2: Select Options in the Environment Config Dialog

In the Environment Config dialog:

- Simply check **only the first two** options;
- Then click **"Start Configuration"** and wait for the automatic setup to run:

![](/manuals/assets/terminal/config/2.png)

## Step 3: Wait for Configuration to Finish

When you see output similar to the following screen in the terminal, it means the environment has been configured successfully and the Terminal is ready to use:

![](/manuals/assets/terminal/config/3.png)

## Troubleshooting

If something goes wrong during the terminal environment setup, you can first check and fix it via the Terminal **Settings** panel:

- In the bottom-right corner of the Terminal view, click the **"Settings"** button;
- This opens the Terminal Settings screen, which includes options such as **mirror/source selection** and **Reset**:

![](/manuals/assets/terminal/config/4.png)

Below are three common issues and how to resolve them:

### Issue 1: "Request error" when installing packages

Example screen:

![](/manuals/assets/terminal/config/5.jpg)

**Possible cause**: The current download mirror/source is unstable or not reachable (timeouts, blocked network, etc.), causing requests to fail.

**Solution**:

1. Open the Terminal **Settings** panel from the bottom-right corner;
2. In the Settings screen, try switching or updating the download mirror/source to one that is more reliable in your network environment;
3. Save the settings, then rerun the environment configuration or related install command.

### Issue 2: No `operit` prompt and lots of error messages in the terminal

Example screens (multiple errors, terminal does not enter the normal `operit` environment):

![](/manuals/assets/terminal/config/6.jpg)
![](/manuals/assets/terminal/config/7.jpg)
![](/manuals/assets/terminal/config/8.jpg)

**Possible cause**: A previous environment configuration run was incomplete or interrupted, leaving the terminal environment in a broken state.

**Solution**:

1. Click **"Settings"** in the bottom-right corner of the Terminal to open the Settings screen;
2. Click the **"Reset"** button to restore the terminal environment to its initial state;
3. Close and **restart the Operit AI app**;
4. Follow the steps on this page again to re-run the terminal environment configuration.

### Issue 3: Terminal shows output, but the permission grant screen shows everything as "unauthorized"

Example screen:

![](/manuals/assets/terminal/config/9.jpg)

**Possible cause**: The terminal is still running the automatic configuration script in the background, and the permission status has not finished refreshing yet.

**Solution**:

- Do not immediately perform other complex operations; instead, **wait patiently for the terminal configuration process to complete**;
- After the output stabilizes and the scripts finish, reopen the permission grant screen. In most cases, the correct authorization status will appear automatically.
