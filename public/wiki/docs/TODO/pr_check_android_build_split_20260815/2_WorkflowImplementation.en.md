# Workflow Implementation

## PR Check

Change the existing single job into a fast gate, an Android build, Android JVM tests, and an aggregation job. After the fast gate passes, the two Android jobs run in parallel; `android_full` no longer triggers the WebChat typecheck, WASM packaging, and ToolPkg special checks from the fast job, but the Android build still runs the assets sync required to generate the APK.

## Android Build

Remove the JVM test inputs and test step. Keep the dependencies, assets generation, Gradle build, and Android artifact upload required for compilation.

## Android Tests

Add a trusted main/manual workflow, reusing the SDK, dependencies, and native ripgrep preparation steps required by the JVM tests, without generating an APK/AAB.
