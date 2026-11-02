# **Android Project Operit Build Guide (Linux/Ubuntu)**

This guide describes in detail all the environment setup and steps required to build the Android project **Operit** in a Linux environment (Ubuntu/Debian recommended).

## **About Operit**

**Operit AI** is the first fully-featured AI assistant app on mobile. It runs **entirely standalone** on your Android device and has powerful **tool-calling capabilities**. This project aims to provide developers with a deeply customizable and extensible AI assistant framework.

Before you start building, please make sure you understand the project's features and goals. For more information, see the project homepage's [README.md](../../../README.md).

## **Contents**

1. Step 1: Install system base dependencies
2. Step 2: Install Android command line tools
3. Step 3: Configure environment variables
4. Step 4: Install the Android SDK and NDK
5. Appendix: Performance optimization - configuring build resources
6. Step 5: Clone and build the project
7. Troubleshooting common issues

## **1. Step 1: Install system base dependencies**

First, we need to update the package manager and install the key base software required for building: **Git**, **JDK 21**, **Node.js**, **npm**, and **Python 3**.
```bash 
# Update the package list  
sudo apt update

# Install the required tools, JDK 21, Node.js, npm, and Python 3
sudo apt install -y git wget unzip openjdk-21-jdk nodejs npm python3

# Install pnpm (used when tools/example_packages/sync_example_packages.py pre-builds examples)
sudo npm install -g pnpm

# After installation, verify that the Java version is correct
java -version  
# The expected output should contain "OpenJDK Runtime Environment (build 21..." or similar information

# It is also recommended to confirm that Node.js, npm, pnpm, and Python 3 are available
node -v
npm -v
pnpm -v
python3 --version
``` 
**Note:** The project officially requires **JDK 21**. For maximum compatibility, installing and using JDK 21 is strongly recommended.

**Additional note:** The project's `web-chat` is built with React + Vite; `tools/example_packages/sync_example_packages.py` pre-builds the script packages under `examples/` and packs them into `.toolpkg`. Therefore, in addition to the Android environment, Node.js, npm, pnpm, and Python 3 must also be prepared. If a later frontend build reports that the Node.js version is too low, please upgrade to a newer Node.js LTS version before continuing.

## **2. Step 2: Install Android command line tools**

To manage the SDK, we will use the lighter-weight Android command line tools instead of the bulky Android Studio.

1. **Create the Android SDK directory:**  
```bash
mkdir -p ~/Android/cmdline-tools
```
2. Download the command line tools:  
Visit the Android Developers website and copy the link for the latest Linux version.  
**Warning:** The link below is only an example. Be sure to check and replace it with the latest link provided officially!  
```bash
# Example link — be sure to check and replace it with the latest version  
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O ~/cmdline-tools.zip
```

3. Unzip and set up the directory structure:  
The command line tools require their files to be located in a subdirectory named latest, otherwise sdkmanager may not recognize them.  
```bash
# Unzip to the target directory  
unzip ~/cmdline-tools.zip -d ~/Android/cmdline-tools

# Move the extracted cmdline-tools into the latest subdirectory  
mv ~/Android/cmdline-tools/cmdline-tools ~/Android/cmdline-tools/latest

# Clean up the downloaded archive  
rm ~/cmdline-tools.zip
```
The final tool path should be ~/Android/cmdline-tools/latest/bin.

## **3. Step 3: Configure environment variables**

Configure environment variables so the system can find the commands related to **Java** and the **Android SDK**, such as java, git, and sdkmanager.

1. **Edit the configuration file:**  
```bash
nano ~/.bashrc
```

2. **Append the following content to the end of the file:**  
```bash
# =============== Java JDK 21 configuration ===============  
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64  
export PATH=$JAVA_HOME/bin:$PATH

# =============== Android SDK configuration ===============  
export ANDROID_HOME=$HOME/Android  
# Add latest/bin to PATH  
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH  
# Add platform-tools (ADB/Fastboot) to PATH  
export PATH=$ANDROID_HOME/platform-tools:$PATH
```

3. **Apply the configuration:**  
```bash
source ~/.bashrc
```

## **4. Step 4: Install the Android SDK and NDK**

Use the sdkmanager command configured above to install the SDK platform, build tools, and the specific NDK version required by the project.

1. Accept all SDK licenses (critical step!):  
This step is required, otherwise the Gradle build will fail due to license issues.  
```bash
yes | sdkmanager --licenses
```

2. Install the platform tools, SDK platform, and build tools:  
The Operit project depends on the android-34 platform and the 34.0.0 build tools.  
```bash
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```
3. Install the NDK version specified by the project:  
This project requires NDK 25.1.8937393.  
```bash
sdkmanager "ndk;25.1.8937393"
```

## **Appendix: Performance optimization - configuring build resources**

For higher-spec machines (e.g. 16GB of memory or more), build speed can be significantly improved by adjusting the Gradle configuration.  
In the **gradle.properties** file in the project root, you can adjust the following parameters:  

```properties
# Set the maximum JVM memory used by Gradle, e.g. 8GB  
org.gradle.jvmargs=-Xmx8g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError

# Enable parallel compilation  
org.gradle.parallel=true

# (Optional) Set the number of parallel compilation workers, usually recommended to be the number of CPU cores  
# org.gradle.workers.max=8
``` 

## **5. Step 5: Clone and build the project**

With the environment ready, now start building the project.

1. Clone the project repository and enter the directory:  
Choose one of the following two cloning methods as needed (the project contains Git submodules):

**Recommended: Fork first, then clone your repository**  
Open the upstream repository on GitHub and click Fork: [AAswordman/Operit](https://github.com/AAswordman/Operit)  
Clone your Fork, and initialize only the publicly build-dependent `terminal` submodule:
```bash
git clone https://github.com/<你的 GitHub 用户名>/Operit.git
cd Operit
git submodule update --init --recursive terminal
```  
(Optional) Add the upstream repository so you can sync updates:  
```bash
git remote add upstream https://github.com/AAswordman/Operit.git
```  

**Alternative: Clone the upstream repository directly without forking (read-only)**  
```bash
git clone https://github.com/AAswordman/Operit.git
cd Operit
git submodule update --init --recursive terminal
```  

If you have already cloned but have not yet initialized the public submodule, run the following in the repository directory:
```bash
git submodule update --init --recursive terminal
```  
DragonBonesCPP, `ufbx`, `Bullet3`, `Saba`, `ncnn`, `sherpa-ncnn`, WAMR, `llama.cpp`, QuickJS, MNN, and the KleidiAI used by MNN are fetched by CMake via `FetchContent`. CMake first resolves the remote ref's commit, then downloads the corresponding GitHub archive, so it does not pull the full Git history; by default it follows each upstream's main branch, pinned commit, or the tag declared by the upstream project. To override a ref, set `OPERIT_DRAGONBONES_CPP_GIT_REF`, `OPERIT_UFBX_GIT_REF`, `OPERIT_BULLET3_GIT_REF`, `OPERIT_SABA_GIT_REF`, `OPERIT_NCNN_GIT_REF`, `OPERIT_SHERPA_NCNN_GIT_REF`, `OPERIT_WAMR_GIT_REF`, `OPERIT_LLAMA_CPP_GIT_REF`, `OPERIT_QUICKJS_GIT_REF`, `OPERIT_MNN_GIT_REF`, or `OPERIT_KLEIDIAI_GIT_REF` in the CMake arguments.

MNN's Android CMake configuration compiles a host `flatc` from MNN's own FlatBuffers source before adding the MNN subproject, and regenerates `schema/current/*.h` from the same `schema/default/*.fbs`. Therefore, in addition to the Android NDK and CMake, the build machine must also provide a usable host C/C++ compiler; Linux builds explicitly use `gcc` and `g++`, the generator does not compile with the Android ABI, and it does not rely on pre-generated header files outside the workspace.

2. **Download and place the non-model dependency libraries (critical step!):**
As mentioned in `README.md`, the project depends on some libraries that must be downloaded manually. Download the non-model files from [this Google Drive link](https://drive.google.com/drive/folders/1g-Q_i7cf6Ua4KX9ZM6V282EEZvTVVfF7?usp=sharing) and unzip or place them into the corresponding `libs` folder or folder containing a `.keep` file under the project root.  **Warning:** If you skip this step, the build will fail due to missing dependencies. Currently, you need to download and unzip these three archives: `subpack.zip`, `jniLibs.zip`, and `libs.zip`. The default local STT model is no longer prepared via `models.zip`; the Android build automatically fetches and verifies it from a fixed Hugging Face source as configured in `app/config/stt-model-assets.properties`.
```bash
./app/src/main/assets/subpack/.keep  
./app/src/main/jniLibs/.keep
./app/libs
```

3. **Switch to your working branch (if needed):**
```bash
git checkout docs/add-building-guide
# Replace the example branch name above with the name of a branch you created yourself
```

4. **Install the script dependencies in the project root:**
```bash
npm install
```
This step installs dependencies such as `typescript` and `esbuild` that `tools/example_packages/sync_example_packages.py` needs when pre-building the example script packages.

5. **Install the web-chat frontend dependencies:**
```bash
npm --prefix web-chat install
```

6. **Build web-chat first and sync it to the Android assets (critical step!):**
```bash
npm run build:webchat
```
This command first runs the `web-chat` React/Vite build, then syncs the generated static files to `app/src/main/assets/web-chat`. If you modify code under `web-chat/src`, you also need to run this step again before recompiling the APK.

7. **Package ToolPkg and sync the example packages to the app assets (critical step!):**
```bash
python3 ./tools/example_packages/sync_example_packages.py
```
This command pre-builds the script packages under `examples/` according to `tools/example_packages/packages_whitelist.txt`, packs directories containing `manifest.json` or `manifest.hjson` into `.toolpkg`, and finally outputs them to `app/src/main/assets/packages/`. If you modify script package code under `examples/`, you also need to run this step again before recompiling the APK.

8. **Add executable permission to the Gradle wrapper:**
```bash
chmod +x ./gradlew
```

9. Run the assembleDebug command to build:  
The first build downloads a large number of dependencies, so please be patient.  
```bash
./gradlew assembleDebug
```

Or run assembleDebugClone to build the coexisting variant:
```
./gradlew assembleDebugClone
```

10. Locate the APK file:  
After a successful build, the generated APK files are located at the following paths under the project directory:  
app/build/outputs/apk/debug/app-debug.apk
app/build/outputs/apk/clone/app-clone.apk

## **7. Troubleshooting common issues**

| Error message | Solution |
| :---- | :---- |
| sdkmanager: command not found | The environment variables were not set or applied correctly. Check the contents of the **~/.bashrc** file and run source ~/.bashrc. |
| Could not determine Java version... | The **JAVA_HOME** environment variable is incorrect, or the wrong JDK version is installed. Make sure **JDK 21** is installed and pointed to the correct path. |
| NDK not found. | Make sure you installed the **ndk;25.1.8937393** version required by the project in **Step 4** using sdkmanager. |
| pnpm: command not found | `pnpm` has not been installed yet. Run `sudo npm install -g pnpm` first, then rerun `python3 ./tools/example_packages/sync_example_packages.py`. |
| Missing web-chat/dist. Run `npm --prefix web-chat run build` first. | `web-chat` has not been built yet or the build failed. Run `npm --prefix web-chat install` first, then run `npm run build:webchat` in the project root. |
| ERROR: prebuild step failed | `tools/example_packages/sync_example_packages.py` failed while pre-building `examples/`. First confirm that you have run `npm install` in the project root, and check whether `pnpm -v` and `python3 --version` are available. |
| `Failed to build the host FlatBuffers compiler` | The MNN schema generation stage cannot find or run the host C/C++ toolchain. On Linux, install `gcc` and `g++`; on other platforms, install a compiler matching the current platform, then rerun the Gradle build. |
| You have not accepted the license agreements... | You skipped or did not successfully complete the license acceptance step. Please go back to **Step 4** and execute `yes`
