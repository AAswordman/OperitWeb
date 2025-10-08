# MCP (Model Context Protocol)

### Importing and Configuring MCP

Now, you can import MCP plugins in three ways: from Git repository, ZIP file, or remote URL.

![Import MCP Plugin](/manuals/assets/package_or_MCP/7.png)

#### Import Methods

1.  **Repository (Git):** Enter the Git repository link to import directly from source code. This is the most common method.
2.  **ZIP:** Upload a ZIP archive containing MCP plugin files.
3.  **Remote:** Provide a remote URL that points directly to the plugin service or file.

#### Service Metadata

Regardless of which method you use, you need to provide the following metadata:

*   **Plugin Name:** Set an easily recognizable name for your plugin.
*   **Plugin Description:** Clearly describe the plugin's function in one sentence. **This is crucial** because AI will use this description to determine in which scenarios to call this plugin. A good description enables AI to use the tool more intelligently.

### Post-Addition Operations

After adding an MCP plugin, you need to load it according to its type (local or remote):

*   **Local MCP:**
    1.  Deploy the plugin.
    2.  Enable the plugin.
    3.  Click the load button in the lower right corner (or restart the software) to make the plugin take effect.

*   **Remote MCP:**
    1.  Simply click the load button in the lower right corner.

### MCP Working Mechanism

|| |
|| :--- | :---: |
|| Our MCP server runs locally through a built-in Linux environment (Ubuntu 24 based on proot) and interacts with the software. MCP will attempt to start when the software opens, with the startup command determined by the `arg` parameters and `env` environment variables in each plugin's configuration. | ![MCP Configuration Example](/manuals/assets/41ebc2ec5278bd28e8361e3eb72128d.jpg) |

### MCP Download and Deployment Mechanism

Due to the special environment and the fact that the MCP ecosystem itself is chaotic with README documentation quality varying widely, we have added an automatic package structure matching mechanism. Currently, it supports recognizing packages written in Node.js and Python.

When downloading MCP, the app will directly obtain the repository's ZIP archive, download it to the `Download/Operit/` directory, and modify a JSON file to add an ID. If needed, you can also import custom MCPs within the software or manually place files in that directory.

#### Deployment Mechanism

We will automatically generate execution commands for both project structures during deployment.

|| Python Package | Node.js Package |
|| :--- | :--- |
|| For Python packages, we will first try to install dependencies using `pip`, then automatically generate a startup command configuration. You can view and modify it through "Custom Deployment Command" during deployment. | For Node.js packages, we will first try to switch sources, then use `npm` or `pnpm` to download dependencies. If the project is written in TypeScript, we will try to compile the project; if it's JavaScript, we will try to directly obtain the entry file. Finally, the system will generate a configuration code, and the startup command will point to the entry file or compiled file. |

> The two recognition modes above are universal for many packages. Of course, there will always be some exceptions.
> **Note:** Before deployment and startup, package files will be copied to the built-in Linux environment for operations. In other words, only the downloaded original compressed package will be stored in the external `Download` path.

### MCP Common Issues

|| | |
|| :--- | :--- |
|| Some plugins require keys, but this part needs to be added manually. As shown in the figure, please write the key in the startup environment variables according to the readme, otherwise it will cause errors. | ![Configure Key](/manuals/assets/package_or_MCP/7b8ec8ba567c3c670d6a063121614fe.jpg) |
|| The deployment status of plugins can be manually checked by entering the built-in terminal as follows. Here, the build folder is the result of automatic compilation during deployment, containing the file paths we need for startup. | ![View Deployment](/manuals/assets/package_or_MCP/401cda27abf79b9d0311816947b1bdd.jpg) |
|| You can try running it to correct your startup command (in the image, startup failed due to missing key) | ![Correct Startup Command](/manuals/assets/package_or_MCP/0946d845d9adad20bbd039a93d1196f.jpg) |

> **Note:** Some packages come with Docker files, but we do not support Docker, please ignore it.

> **Note:** Our environment is Ubuntu 24 based on proot, which is a Linux environment. Some packages that can only be used on Windows need to run .exe files, such as playwright, which of course are not supported.

