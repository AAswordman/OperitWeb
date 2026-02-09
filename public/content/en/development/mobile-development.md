### Mobile Development

This section explains how to use AIDE and Operit AI to build native Android projects on your phone.

Version: 1.8.1+

This guide assumes your terminal environment is already set up. If you run into terminal issues, open `super_admin` in `Package Manager`; AI can help solve many problems.

### Create a New Android Project

> Example model: `deepseek-chat` (from DeepSeek Open Platform)

1. Create a new workspace. Path: `Workspace > Create Default > Android Project`

2. Send your requirements to AI.

```txt
Build a check-in app for me. It should require daily check-ins,
but if a user misses two consecutive days, they can no longer check in.
Users should be able to customize check-in items and add/remove them.
```

3. AI may create an Android project from scratch. You can also tell AI: `You can create the project directly through the terminal`, or manually click `Workspace > Initialize Android Build Environment`. After waiting for a moment, AI will have a faster and more convenient setup path.

![583104cc6330d73ff1afa9dbd5a5a5bf](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_a30806414374422899e8ecd091527029-583104cc6330d73ff1afa9dbd5a5a5bf.png)

4. Packaging and Testing

You still have two choices: open the workspace and click `Build Debug APK`, or let AI run terminal commands directly.

![89a0629358433e38d01d14d04751fc74](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_f7f398aa946d4f5a820e8f399089eaba-89a0629358433e38d01d14d04751fc74.png)
![c43738399417b3fb23737f996ec87f0b](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_964e3328e9444c54a38500ec4e405689-c43738399417b3fb23737f996ec87f0b.png)

This app is relatively simple. If there are no errors, the APK build process can usually finish in about 7–11 seconds. Below is the app AI produced.

![696dcd2faaf9d50876836a2b05610ad8](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_520d3a36b13341ea8e78c4bec38a846d-696dcd2faaf9d50876836a2b05610ad8.jpg)
![5af89324972ad9b05975337c0fe053b5](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_6f69aedb47a04efca85239e640bfd2fb-5af89324972ad9b05975337c0fe053b5.jpg)

5. Error Handling

If you encounter an error, open the terminal panel (the one you were asked to open at the beginning) and send it directly to AI. If the issue still exists, you can join the user group and contact the developers.

#### Q&A

- About AAPT2 failing to package on ARM64:

Use the built-in Android workspace. It will automatically download precompiled ARM64 AAPT2 (run `Workspace > Initialize Android Build Environment`).

### How to Tell Whether the Terminal Is Running

Most of the time, you will see a long and hard-to-read progress bar, like the one below (currently at 7%). If it is too slow, click `Ctrl+C Interrupt` on the left, then send the command again. Occasionally, you will get a clearer progress bar.

![5dd5ca6458d8c646b050a7d10230dfef](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_2ce88cd2635e43a4971821a851fa78f5-5dd5ca6458d8c646b050a7d10230dfef.jpg)

### Quickly Reproduce a GitHub Repository

Once AI has terminal capability, it can feel like it can do almost anything. So I only tell AI the project name and let it handle the rest, then rely on Operit's parallel conversation ability to run tests while modifying code (?)

#### Workspace Configuration Reference

Workspace `.operit/config.json`, template differences, export switch behavior, and runtime notes are now centralized here:

- [Workspace Overview](/guide/development/workspace-overview)

Recommend reading that page first, then returning here for Android-specific practice.

