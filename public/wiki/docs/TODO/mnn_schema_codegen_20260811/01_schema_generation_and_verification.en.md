# Step 1: Schema Generation and Verification

## Original Implementation

`llm/mnn/CMakeLists.txt` directly adds the MNN downloaded via FetchContent to the build. MNN upstream does not generate `schema/current/*.h` in its top-level CMake, so when the schema and the C++ sources are briefly out of sync between upstream commits, a clean archive fails to compile outright.

## Intent of the Fix

Before adding the MNN subdirectory to the parent build, build MNN's bundled FlatBuffers `flatc` host tool, clean and regenerate the public schema header files. On Linux, use `gcc` and `g++` to compile that host tool, to avoid older FlatBuffers CMake promoting known Clang warnings to errors; the Android target compiler is only responsible for the final native library and is not executed as a host tool.

## Verification Record

- [x] `:mnn:assembleDebug --no-build-cache --no-daemon`: Local Windows Android NDK build succeeded
- [x] `:app:testDebugUnitTest --no-build-cache --no-daemon`: Local JVM unit tests succeeded
- [ ] Cloud `Candidate checks` all green
- [ ] PR #926 merged into `main` via a normal merge
