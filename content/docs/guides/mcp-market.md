### 🛒 MCP市场

#### MCP配置流程
在Operit AI中配置和管理MCP（模型上下文协议）插件，可以极大地扩展AI的能力。以下是详细的配置步骤：

##### 步骤一：进入MCP市场
从主菜单进入"拓展中心"，然后选择"MCP市场"。
![进入MCP市场](/manuals/assets/package_or_MCP/7.jpg)

##### 步骤二：选择并部署MCP
浏览可用的MCP，选择您需要的插件，然后点击"部署"按钮开始自动配置。
![部署MCP](/manuals/assets/package_or_MCP/8.jpg)

#### MCP工作机制
我们的MCP服务器通过Termux运行在本地，并和软件进行交互。MCP会在软件打开的时候进行尝试启动，启动命令由每个插件配置中的`arg`参数以及`env`的环境变量决定。
![MCP配置示例](/manuals/assets/41ebc2ec5278bd28e8361e3eb72128d.jpg)

#### MCP下载和部署机制
由于环境特殊，并且MCP的生态本身就杂乱不堪，README文档质量参差不齐，所以我们加入了自动匹配包结构的机制。目前支持识别Node.js和Python两种语言编写的包。

下载MCP时，应用会直接获取仓库的ZIP压缩包，下载到`Download/Operit/`目录下，并修改一个JSON文件加入ID。如有需要，您也可以在软件内导入自定义MCP或手动将文件放入该目录。

##### 部署机制
我们将在部署时为两种项目结构自动生成执行命令。

| Python包 | Node.js包 |
|---|---|
| 对于Python包，我们会先尝试使用`pip`安装依赖，然后自动生成一个启动命令的配置。您可以在部署时通过"自定义部署命令"来查看和修改。 | 对于Node.js包，我们会先尝试进行换源，然后使用`npm`或`pnpm`下载依赖。如果项目是TypeScript编写的，我们会尝试编译项目；如果是JavaScript，则会尝试直接获取入口文件。最后，系统将生成一份配置代码，启动命令会指向入口文件或编译后的文件。 |

> 以上的两种识别模式对于很多包而言都是通用的。当然，也总会有一些意外情况。
> **注意：**部署和启动之前，包文件都会被复制到Termux内部进行操作。也就是说，只有下载的原始压缩包才会存放在外部的`Download`路径下。

#### MCP常见问题
有的插件需要key，但是这部分需要手动加入。如图，请根据readme，把key写在启动环境变量，否则会报错。
![配置key](/manuals/assets/package_or_MCP/7b8ec8ba567c3c670d6a063121614fe.jpg)

插件的部署情况可以手动进入termux进行查看，方式如下。在这里，build文件夹为部署中自动编译后的结果，里面有我们启动需要的文件路径。
![查看部署](/manuals/assets/package_or_MCP/401cda27abf79b9d0311816947b1bdd.jpg)

你可以尝试运行它，以此修正你的启动命令(图中由于缺少key，启动失败)
![修正启动命令](/manuals/assets/package_or_MCP/0946d845d9adad20bbd039a93d1196f.jpg)

> **注意:** 有的包带了docker文件，但是我们是不支持docker的，请忽视它。

> **注意:** 我们的环境termux是linux，有一些win才能用的包要运行.exe，比如playwright，那当然是不支持的了。 