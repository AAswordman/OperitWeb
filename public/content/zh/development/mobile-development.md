### 移动端开发

pre { overflow-y: auto; max-height: 300px; }

本章节将指导您如何使用 AIDE 和 Operit AI 在手机上打造原生安卓项目。

版本：1.8.1+

本文默认:用户的终端配置已经好了，如果出现终端问题请在`包管理`中打开`super_admin`，AI能帮你解决很多问题。

### 新建一个Android项目

> 示例模型:deepseek-chat(来自deepseek开放平台)

1.新建工作区。步骤：`工作区>创建默认>Android项目`

``

2.向AI发送需求

```txt
给我写一个，打卡软件，要求每日打卡，但连续两天不打卡就无法再打卡。
用户可以自定义打卡条目，增添/删除打卡条目。
```

3.AI可能会从零创建一个安卓项目。当然你也可以选择告诉AI `你可以使用终端自行新建项目`，或者手动点进`工作区>初始化Android构建环境`，等待一会即可，向AI提供更方便快捷的方案。

![583104cc6330d73ff1afa9dbd5a5a5bf](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_a30806414374422899e8ecd091527029-583104cc6330d73ff1afa9dbd5a5a5bf.png)

4.打包与测试

你依然有两个选择：打开工作区点击`构建debug apk`或者是让AI直接输入终端指令。

![89a0629358433e38d01d14d04751fc74](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_f7f398aa946d4f5a820e8f399089eaba-89a0629358433e38d01d14d04751fc74.png)

![c43738399417b3fb23737f996ec87f0b](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_964e3328e9444c54a38500ec4e405689-c43738399417b3fb23737f996ec87f0b.png)

软件写的比较简单，在没报错的情况下，7s-11s即可完成编译成apk流程。下面是我让AI做好的软件

![696dcd2faaf9d50876836a2b05610ad8](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_520d3a36b13341ea8e78c4bec38a846d-696dcd2faaf9d50876836a2b05610ad8.jpg)

![5af89324972ad9b05975337c0fe053b5](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_6f69aedb47a04efca85239e640bfd2fb-5af89324972ad9b05975337c0fe053b5.jpg)

5.报错处理 遇到报错打开终端包（一开始让你打开的）直接发给AI就好了。如果还有错误可以进用户群联系开发者~

#### Q&A

- 有关AAPT2在ARM64下无法打包的问题：

使用自带的Android工作区即可，会自动下预编译的ARM64 AAPT2（运行 `工作区>初始化Android构建环境'）

### 关于判断终端什么时候正在运行

大多时候会有一个长得很抽象的进度条，比如下面这个，是进度条到7%。进度条太慢了可以点左侧`Crtl+C中断`，然后重新发送命令。偶尔会有好看的进度条，让你一目了然。

![5dd5ca6458d8c646b050a7d10230dfef](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_2ce88cd2635e43a4971821a851fa78f5-5dd5ca6458d8c646b050a7d10230dfef.jpg)

### 快速复现一个github仓库

当AI有了终端能力后，疑似有点无所不能了。所以我仅告诉AI项目名称，剩下的交给它去做，再靠operit对话并发的能力在改代码的同时跑测试（？

#### 配置快捷命令方法

在.operit文件夹里面有个config.json，可以配置快捷指令

config.json展开如下:

```
"projectType": "android",
"title": "Android 项目",
"description": "适用于 Android 工程开发，提供 Gradle 常用任务快捷按钮",
"server": {
    "enabled": false,
    "port": 8080,
    "autoStart": false
},
"preview": {
    "type": "terminal",
    "url": "",
    "showPreviewButton": false,
    "previewButtonLabel": ""
},
"commands": [
    {
        "id": "android_setup_env",
        "label": "初始化 Android 构建环境",
        "command": "bash setup_android_env.sh",
        "workingDir": ".",
        "shell": true
    },
    {
        "id": "gradle_assemble_debug",
        "label": "构建 Debug APK",
        "command": "./gradlew assembleDebug",
        "workingDir": ".",
        "shell": true
    },
    {
        "id": "gradle_install_debug",
        "label": "安装 Debug APK",
        "command": "./gradlew installDebug",
        "workingDir": ".",
        "shell": true
    },
    {
        "id": "gradle_lint",
        "label": "运行 Lint",
        "command": "./gradlew lint",
        "workingDir": ".",
        "shell": true
    },
    {
        "id": "gradle_test",
        "label": "运行测试",
        "command": "./gradlew test",
        "workingDir": ".",
        "shell": true
    }
],
"export": {
    "enabled": false
}
```

**（欢迎继续补充）**