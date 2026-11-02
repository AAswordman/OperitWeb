# Operit Android Project

This is a modern Android app development template based on **Jetpack Compose**.

## 🚀 Project Features

✅ **Jetpack Compose** - Modern declarative UI framework  
✅ **Material Design 3** - Latest design guidelines  
✅ **Kotlin** - 100% written in Kotlin  
✅ **Gradle Version Catalog** - Unified dependency management  
✅ **Ready out of the box** - Includes a complete project structure  

## 📁 Project Structure

```
android-project/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/java/myapplication/
│   │   │   │   ├── MainActivity.kt          # 主Activity
│   │   │   │   └── ui/theme/
│   │   │   │       ├── Color.kt             # 颜色定义
│   │   │   │       ├── Theme.kt             # 主题配置
│   │   │   │       └── Type.kt              # 字体配置
│   │   │   ├── res/                         # 资源文件
│   │   │   └── AndroidManifest.xml          # 应用清单
│   │   ├── androidTest/                     # Android测试
│   │   └── test/                            # 单元测试
│   ├── build.gradle.kts                     # App模块配置
│   └── proguard-rules.pro                   # 混淆规则
├── gradle/
│   ├── libs.versions.toml                   # 依赖版本管理
│   └── wrapper/                             # Gradle Wrapper
├── build.gradle.kts                         # 项目级配置
├── settings.gradle.kts                      # 项目设置
├── gradle.properties                        # Gradle属性
├── gradlew / gradlew.bat                    # Gradle命令
└── .gitignore                               # Git忽略
```

## 🛠️ Quick Start

### 1. Environment Requirements
- ✅ **JDK 17+** (required)
- ✅ **Gradle** (Wrapper included)
- ✅ **Android SDK** (optional, for full builds)

### 2. Building the Project

#### Using Operit's built-in command buttons
- 🔧 **Initialize Gradle Wrapper** - First time use
- 🔨 **Build Project** - Compile the whole project
- 🧹 **Clean Build** - Clear the build cache
- 📋 **View All Tasks** - List available tasks

#### Command line
```bash
# Linux/Mac
./gradlew build              # 构建项目
./gradlew assembleDebug      # 打包Debug APK
./gradlew installDebug       # 安装到设备
./gradlew clean              # 清理构建

# Windows
gradlew.bat build
gradlew.bat assembleDebug
```

### 3. Generated APK Location
```
app/build/outputs/apk/debug/app-debug.apk
```

## 📦 Dependency Management

The project uses the **Gradle Version Catalog** to manage dependency versions uniformly.

### Viewing current dependencies
Defined in `gradle/libs.versions.toml`:

```toml
[versions]
agp = "9.0.0"
kotlin = "2.3.10"
composeBom = "2026.01.01"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
```

### Adding a new dependency
1. Add the version and library definition in `gradle/libs.versions.toml`
2. Reference it in `app/build.gradle.kts`:
   ```kotlin
   dependencies {
       implementation(libs.your.library.name)
   }
   ```

## 🎨 Customizing the App

### Changing the app name
Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">你的应用名</string>
```

### Changing the package name
1. Update `namespace` and `applicationId` in `app/build.gradle.kts`
2. Rename the `java/com/java/myapplication` directory structure
3. Update the package name references in `AndroidManifest.xml`

### Changing theme colors
Edit `app/src/main/java/.../ui/theme/Color.kt`:
```kotlin
val Purple80 = Color(0xFFD0BCFF)  // 修改为你的颜色
```

## 📱 Compose Example

The current `MainActivity.kt` contains a simple Greeting example:

```kotlin
@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    Text(
        text = "Hello $name!",
        modifier = modifier
    )
}
```

You can:
- Add more Composable functions
- Use Material3 components
- Implement navigation (Navigation Compose recommended)
- Integrate architecture components such as ViewModel and Repository

## 🔧 Common Gradle Tasks

```bash
./gradlew tasks              # 查看所有可用任务
./gradlew clean              # 清理构建
./gradlew build              # 完整构建
./gradlew assembleDebug      # 构建Debug APK
./gradlew assembleRelease    # 构建Release APK
./gradlew installDebug       # 安装Debug到设备
./gradlew test               # 运行单元测试
./gradlew connectedAndroidTest # 运行Android测试
```

## 📝 Notes

⚠️ **About the Android SDK**  
- This template can be built in Operit's Ubuntu environment
- A full build requires the Android SDK to be installed
- Android Studio is recommended for full development

### ⚠️ AAPT2 Replacement in ARM64 Environments (built into the template)

Gradle automatically downloads AAPT2 from Google Maven, but the official distribution cannot be used directly in ARM64 Linux environments.
This template already includes an ARM64 `aapt2`, and `setup_android_env.sh` automatically replaces it into the SDK build-tools and the Gradle cache.

**Built-in sources in the template**:
- Release: https://github.com/ReVanced/aapt2/releases/tag/v1.0.0
- ARM64 aapt2: https://github.com/ReVanced/aapt2/releases/download/v1.0.0/aapt2-arm64-v8a
- SHA-256: `e5b5ff7f0d4f6ecd7fa5d05d77fed3f09f6f1bf80f078b8aada82bc578848561`

**You only need to run**
```bash
chmod +x ./setup_android_env.sh
./setup_android_env.sh
```

The script automatically completes:
- Replacing `$ANDROID_SDK/build-tools/35.0.0/aapt2`
- Replacing the binary inside the jar under `~/.gradle/caches/modules-2/files-2.1/com.android.tools.build/aapt2`
- Replacing `aapt2` already extracted in `~/.gradle/caches/transforms-*`

⚠️ **About the package name**  
- The default package name is `com.java.myapplication`
- Please change it to your own unique package name before release

⚠️ **About signing**  
- Debug builds automatically use the debug signature
- Release builds require a signing key to be configured

## 🌐 Related Resources

- [Jetpack Compose Official Documentation](https://developer.android.com/jetpack/compose)
- [Material Design 3](https://m3.material.io/)
- [Android Developer Guide](https://developer.android.com/)
- [Kotlin Official Documentation](https://kotlinlang.org/)

## 💡 Tips

- Use `./gradlew --scan` to view a detailed build analysis
- Use `./gradlew build --info` to view detailed build logs
- Modifying `gradle.properties` can tune build performance

Happy Coding! 🤖✨
