# Bundled Shizuku APK Notes

## How to Add the Shizuku APK to the Project

To bundle the Shizuku APK in the app, follow these steps:

1. Download the latest Shizuku APK:
   - Download the latest Shizuku APK from [GitHub Releases](https://github.com/RikkaApps/Shizuku/releases/latest)
   - Or obtain the APK from the [Google Play Store](https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api)

2. Rename the downloaded APK file to `shizuku.apk`

3. Copy the `shizuku.apk` file into this directory (`app/src/main/assets/`)

4. Update the version number in the `shizuku_version.txt` file so it matches the copied APK version

## Notes

- Make sure to use the latest stable Shizuku APK to stay compatible with the latest Android versions
- Shizuku is open source under the Apache-2.0 license, with some restriction clauses. For details, see the [Shizuku License](https://github.com/RikkaApps/Shizuku#license)
- Bundled Shizuku is only for users without app store access; normally, installing from the app store should still be preferred

## Version Information

- Currently bundled version: See the `shizuku_version.txt` file
- Last updated: <!-- Add the date when updating -->

## Bundled Applications

This folder contains bundled applications that can be installed directly from the app:

1. **shizuku.apk** - Shizuku app for privileged API access without root
   * Version: See shizuku_version.txt
   * Used for advanced system operations

## Assets Folders

- **js/** - JavaScript files and shell scripts for various features
- **packages/** - Additional package files for the app
