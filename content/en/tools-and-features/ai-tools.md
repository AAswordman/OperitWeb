### AI Tools

AI tools give Operit AI the ability to interact with your device and network. By calling these tools, AI can execute a series of complex tasks from file management to system settings modifications.

#### Available Tools List

Below is a list of currently available AI tools and their function descriptions.

---

#### General Tools

-   `sleep`:
    -   **Function**: Briefly pause execution.
    -   **Parameters**: `duration_ms` (milliseconds to pause, default is 1000, maximum is 10000).

-   `device_info`:
    -   **Function**: Returns detailed device information, including model, OS version, memory, storage, network status, etc.
    -   **Parameters**: None.

-   `use_package`:
    -   **Function**: Activate a specified package in the current session.
    -   **Parameters**: `package_name` (the package name to activate).

---

#### File System Tools

-   `list_files`: List files in directory.
-   `read_file`: Read file contents (supports OCR text extraction for images).
-   `read_file_part`: Read large file contents in chunks.
-   `apply_file`: Intelligently modify files, supporting multiple instruction formats.
-   `delete_file`: Delete file or directory.
-   `file_exists`: Check if file or directory exists.
-   `move_file`: Move or rename file/directory.
-   `copy_file`: Copy file/directory.
-   `make_directory`: Create new directory.
-   `find_files`: Search files by pattern.
-   `file_info`: Get detailed file or directory information.
-   `zip_files`: Compress files or directories.
-   `unzip_files`: Decompress ZIP files.
-   `open_file`: Open file with system default application.
-   `share_file`: Share file with other applications.
-   `download_file`: Download file from URL.
-   `convert_file`: Convert file format (such as video, image, audio, etc.).
-   `get_supported_conversions`: List supported file format conversion types.

---

#### HTTP Tools

-   `http_request`: Send HTTP request (GET/POST/PUT/DELETE).
-   `multipart_request`: Upload file.
-   `manage_cookies`: Manage HTTP Cookies.
-   `visit_web`: Visit web page and extract content.

---

#### System Operation Tools

**Note**: Some of these tools require explicit user authorization to execute.

##### Tools Requiring User Authorization

-   `get_system_setting`: Get system setting value.
-   `modify_system_setting`: Modify system setting value.
-   `install_app`: Install application (APK).
-   `uninstall_app`: Uninstall application.
-   `list_installed_apps`: List installed applications.
-   `start_app`: Start an application.
-   `stop_app`: Stop a running application.

##### Directly Usable Tools

-   `get_notifications`: Get device notification content.
-   `get_device_location`: Get device's current location information.

