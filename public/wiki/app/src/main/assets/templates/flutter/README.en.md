# Operit Flutter Project

This is an Operit Flutter project organized from the official Flutter stable app template, including the base structure for Android, iOS, Web, Windows, macOS, and Linux, plus the default counter example and widget test.

## Quick Start

1. Run `bash android/setup_android_env.sh` first. If the current environment does not have Flutter yet, this script will first automatically install Flutter stable from the official Flutter `storage.flutter-io.cn / storage.googleapis.com` sources, then continue initializing the Flutter host artifacts, Java, Android SDK, Gradle, AAPT2 replacement, and so on; it also persists `FLUTTER_STORAGE_BASE_URL` and `PUB_HOSTED_URL` to `~/.bashrc` so that later `flutter pub get` runs keep using the same sources.
2. Run `flutter pub get` in the project root.
3. For a browser preview, run `flutter run -d web-server --web-hostname 0.0.0.0 --web-port 5013`.
4. For an Android package, run `flutter build apk`.

## Template Notes

- `lib/main.dart` keeps the default Flutter counter example, suitable as a minimal starting point.
- `test/widget_test.dart` keeps the default widget smoke test.
- `android/local.properties` is a placeholder file; to run Android Gradle tasks directly, first change it to your local Flutter SDK and Android SDK paths.
- `android/setup_android_env.sh` copies and adapts the Android template's initialization script, including automatically installing Flutter from the official Flutter `cn/com` storage, automatically pre-fetching the artifacts needed for Linux / Android, Java / Android SDK / Gradle preparation, and ARM64 `aapt2` replacement.
- Linux ARM64 also uses the official Flutter sources: the script first installs the official Linux SDK package, then uses Flutter's own official download logic to fill in the ARM64 Dart SDK and host artifacts.
- Files that strongly depend on the local environment, such as `.metadata` and `.idea`, are not baked into the template; if you want to fill them in according to the Flutter environment on the current machine, run `flutter create .` in the project root.

## Common Commands

- `flutter doctor`
- `bash android/setup_android_env.sh`
- `flutter pub get`
- `flutter analyze`
- `flutter test`
- `flutter build apk`
- `flutter build web --no-tree-shake-icons`

## Key Directories

- `android/`
- `ios/`
- `macos/`
- `linux/`
- `windows/`
- `web/`
- `lib/`
- `test/`
