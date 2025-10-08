### AI 工具

AI 工具赋予了 Operit AI 与您的设备和网络进行交互的能力。通过调用这些工具，AI 可以执行从文件管理到系统设置修改等一系列复杂任务。

#### 可用工具列表

以下是当前可供AI使用的工具列表及其功能说明。

---

#### 通用工具

-   `sleep`:
    -   **功能**: 短暂暂停执行。
    -   **参数**: `duration_ms` (暂停的毫秒数，默认为1000，最大为10000)。

-   `device_info`:
    -   **功能**: 返回详细的设备信息，包括型号、操作系统版本、内存、存储、网络状态等。
    -   **参数**: 无。

-   `use_package`:
    -   **功能**: 在当前会话中激活一个指定的包。
    -   **参数**: `package_name` (要激活的包名)。

---

#### 文件系统工具

-   `list_files`: 列出目录中的文件。
-   `read_file`: 读取文件内容（支持对图片进行OCR文本提取）。
-   `read_file_part`: 分块读取大文件内容。
-   `apply_file`: 智能修改文件，支持多种指令格式。
-   `delete_file`: 删除文件或目录。
-   `file_exists`: 检查文件或目录是否存在。
-   `move_file`: 移动或重命名文件/目录。
-   `copy_file`: 复制文件/目录。
-   `make_directory`: 创建新目录。
-   `find_files`: 按模式搜索文件。
-   `file_info`: 获取文件或目录的详细信息。
-   `zip_files`: 压缩文件或目录。
-   `unzip_files`: 解压ZIP文件。
-   `open_file`: 使用系统默认应用打开文件。
-   `share_file`: 与其他应用共享文件。
-   `download_file`: 从URL下载文件。
-   `convert_file`: 转换文件格式（如视频、图像、音频等）。
-   `get_supported_conversions`: 列出支持的文件格式转换类型。

---

#### HTTP工具

-   `http_request`: 发送HTTP请求 (GET/POST/PUT/DELETE)。
-   `multipart_request`: 上传文件。
-   `manage_cookies`: 管理HTTP Cookies。
-   `visit_web`: 访问网页并提取内容。

---

#### 系统操作工具

**注意**: 其中一些工具需要用户明确授权才能执行。

##### 需要用户授权的工具

-   `get_system_setting`: 获取系统设置的值。
-   `modify_system_setting`: 修改系统设置的值。
-   `install_app`: 安装应用程序 (APK)。
-   `uninstall_app`: 卸载应用程序。
-   `list_installed_apps`: 列出已安装的应用程序。
-   `start_app`: 启动一个应用程序。
-   `stop_app`: 停止一个正在运行的应用程序。

##### 可直接使用的工具

-   `get_notifications`: 获取设备通知内容。
-   `get_device_location`: 获取设备当前的位置信息。 