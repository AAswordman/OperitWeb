## 🚀 拓展用法实操

*(本部分将通过实际案例，向您展示如何利用拓展包、计划模式等高级功能，完成更复杂的任务。)*

### 🧰 开箱即用
*这部分为**内置包***

当你让AI写软件，软件的性能取决于AI的能力。示例中的模型为`Deepseek-R1`模型

#### 示例：写一个2D弹幕游戏
通过简单的对话，让AI为您构思并实现一个经典的2D弹幕射击游戏。Operit AI能够调用其基础代码能力，仅使用HTML和JavaScript，从零开始构建出完整的游戏逻辑与动态画面。
![2D弹幕游戏聊天](/manuals/assets/game_maker_chat.jpg)
![2D弹幕游戏展示](/manuals/assets/game_maker_show.jpg)

#### 示例：用HTML代码写一个3D游戏
无需任何拓展包，Operit AI 仅通过内置的核心工具，就可以直接用HTML和JavaScript代码，为您呈现一个动态的3D游戏场景。
![3D游戏示例1](/manuals/assets/expamle/3ddebdde4958ac152eeca436e39c0f6.jpg)
![3D游戏示例2](/manuals/assets/expamle/759d86a7d74351675b32acb6464585d.jpg)

#### 示例：简单的视频处理
同样地，应用内置了强大的FFmpeg工具，无需额外安装，即可让AI帮您完成视频格式转换、截取、合并等多种处理任务。
![简单的视频处理示例](/manuals/assets/d7580a42ae03c723121bd172e1f9e7d.jpg)

#### 示例：软件打包与部署
从编写代码到最终发布，Operit AI 可以进一步调用平台工具，将完成的软件打包成适用于安卓（APK）或Windows（EXE）的可执行文件，实现端到端的自动化开发流程。
![软件打包示例1](/manuals/assets/web_developer.jpg)
![软件打包示例2](/manuals/assets/game_maker_packer.jpg)

### 📦 拓展包

*演示版本 `1.1.6`*
<br>
（图片可点击放大）

| 拓展包 (Package) | 功能说明 (Description) | 预览 (Preview) |
|---|---|---|
| `writer` | 高级文件编辑和读取功能，支持分段编辑、差异编辑、行号编辑以及高级文件读取操作 | ![writer示例](/manuals/assets/expamle/065e5ca8a8036c51a7905d206bbb56c.jpg) |
| `various_search` | 多平台搜索功能，支持从必应、百度、搜狗、夸克等平台获取搜索结果 | ![多平台搜索示例1](/manuals/assets/expamle/90a1778510df485d788b80d4bc349f9.jpg) <br> ![多平台搜索示例2](/manuals/assets/expamle/f9b8aeba4878775d1252ad8d5d8620a.jpg) |
| `daily_life` | 日常生活工具集合，包括日期时间查询、设备状态监测、天气搜索、提醒闹钟设置、短信电话通讯等 | ![日常生活示例](/manuals/assets/expamle/615cf7a99e421356b6d22bb0b9cc87b.jpg) |
| `super_admin` | 超级管理员工具集，提供终端命令和Shell操作的高级功能 | ![超级管理员示例1](/manuals/assets/expamle/731f67e3d7494886c1c1f8639216bf2.jpg) <br> ![超级管理员示例2](/manuals/assets/expamle/6f81901ae47f5a3584167148017d132.jpg) |
| `code_runner` | 多语言代码执行能力，支持JavaScript、Python、Ruby、Go和Rust脚本的运行<br><em>你可以在`工具箱>终端自动配置`中完成以上环境的配置</em> | |
| `baidu_map` | 百度地图相关功能 | ![百度地图示例](/manuals/assets/expamle/71fd917c5310c1cebaa1abb19882a6d.jpg) |
| `qq_intelligent` | QQ智能助手，通过UI自动化技术实现QQ应用交互 | |
| `time` | 提供时间相关功能 | |
| `various_output` | 提供图片输出功能 | ![图片输出示例](/manuals/assets/expamle/5fff4b49db78ec01e189658de8ea997.jpg) |

### 🛠️ 核心工具

| 工具 (Tool) | 功能说明 (Description) |
|---|---|
|`sleep`|短暂暂停执行|
|`device_info`|获取设备详细信息|
|`use_package`|激活扩展包|
|`query_problem_library`|查询问题库|
|`list_files`|列出目录中的文件|
|`read_file`|读取文件内容|
|`write_file`|写入内容到文件|
|`delete_file`|删除文件或目录|
|`file_exists`|检查文件是否存在|
|`move_file`|移动或重命名文件|
|`copy_file`|复制文件或目录|
|`make_directory`|创建目录|
|`find_files`|搜索匹配文件|
|`zip_files/unzip_files`|压缩/解压文件|
|`download_file`|从网络下载文件|
|`http_request`|发送HTTP请求|
|`multipart_request`|上传文件|
|`manage_cookies`|管理cookies|
|`visit_web`|访问并提取网页内容|
|`get_system_setting`|获取系统设置|
|`modify_system_setting`|修改系统设置|
|`install_app/uninstall_app`|安装/卸载应用|
|`start_app/stop_app`|启动/停止应用|
|`get_notifications`|获取设备通知|
|`get_device_location`|获取设备位置|
|`get_page_info`|获取UI屏幕信息|
|`tap`|模拟点击坐标|
|`click_element`|点击UI元素|
|`set_input_text`|设置输入文本|
|`press_key`|模拟按键|
|`swipe`|模拟滑动手势|
|`find_element`|查找UI元素|
|`ffmpeg_execute`|执行FFmpeg命令|
|`ffmpeg_info`|获取FFmpeg信息|
|`ffmpeg_convert`|转换视频文件| 