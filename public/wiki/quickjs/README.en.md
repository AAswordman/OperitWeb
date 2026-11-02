# quickjsjni

This directory now holds the connectable QuickJS JNI module itself.

Directory structure:
- `src/main/cpp/CMakeLists.txt`: native library build script, which fetches the upstream QuickJS C source via CMake
- `src/main/cpp/quickjs_jni.cpp`: QuickJS JNI Runtime
- `src/main/java/com/ai/assistance/operit/core/tools/javascript/QuickJsNativeRuntime.kt`: Kotlin Runtime wrapper
- `src/main/java/com/ai/assistance/operit/core/tools/javascript/QuickJsNativeHostDispatcher.kt`: default HostBridge, implementing console and timer
- `src/main/java/com/ai/assistance/operit/core/tools/javascript/QuickJsNativeCompatScriptBuilder.kt`: JS compatibility layer

Currently this part only lives in the `quickjs` directory, and has not yet been connected to the `app` module.
