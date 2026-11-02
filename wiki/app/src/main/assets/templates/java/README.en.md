# Operit Java Project

This is a Java project template built with standard Gradle.

## Project Structure

```
operit-java-project/
├── build.gradle.kts          # Gradle build configuration
├── settings.gradle.kts       # Gradle project configuration
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/operit/app/
│   │   │       ├── Main.java           # Main program entry point
│   │   │       └── Calculator.java     # Example class
│   │   └── resources/
│   │       └── application.properties  # Configuration file
│   └── test/
│       └── java/
│           └── com/operit/app/
│               └── CalculatorTest.java # Unit test
└── .gitignore                # Git ignore file
```

## Quick Start

### 1️⃣ Install Dependencies (First Use)
Go to **Terminal → Environment Configuration** and install the following tools:
- ✅ OpenJDK 17
- ✅ Gradle

### 2️⃣ Initialize the Project
1. Click the **"🔧 Initialize Gradle Wrapper"** button
   - This generates the `gradlew` and `gradle/` directories
   - The first run automatically downloads Gradle 8.5

### 3️⃣ Build and Run
- **Build Project**: Click "🔨 Build Project"
- **Run Program**: Click "▶️ Run Program"
- **Run Tests**: Click "🧪 Run Tests"
- **Package JAR**: Click "📦 Package JAR"
- **Clean Build**: Click "🧹 Clean Build"

### Manual Commands
```bash
# Using the Gradle Wrapper (recommended)
./gradlew build
./gradlew run
./gradlew test

# Or use gradle directly
gradle build
gradle run
```

### Generate an Executable JAR
```bash
./gradlew jar
java -jar build/libs/operit-java-project-1.0.0.jar
```

## Features

✅ **Standard Gradle Project Structure**
✅ **Java 17** Support
✅ **JUnit 5** Unit Testing Framework
✅ **Package Management** - Maven Central + Alibaba Cloud Mirror
✅ **Fat JAR** - Executable JAR containing all dependencies

## Adding Dependencies

Add dependencies in `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.google.guava:guava:32.1.2-jre")
    implementation("com.google.code.gson:gson:2.10.1")
}
```

## Custom Configuration

- Modify `build.gradle.kts` to change the build configuration
- Add new Java classes under `src/main/java`
- Add unit tests under `src/test/java`
- Edit `.operit/config.json` to customize Operit commands

Happy Coding! ☕
