# API Documentation: `android.d.ts`

`android.d.ts` provides a set of APIs that are lower-level and more oriented toward native Android objects than `Tools.System`. Its design centers on several classes: `AdbExecutor`, `Intent`, `PackageManager`, `ContentProvider`, `SystemManager`, `DeviceController`, and the overall entry point `Android`.

## Global Entry Points

The following objects are declared as globally available in `index.d.ts`:

- `Intent`
- `IntentFlag`
- `IntentAction`
- `IntentCategory`
- `Android`

They can also be used by type from the exports in `index.d.ts`.

## `AdbExecutor`

This is the base class for several Android helper classes.

### Methods

- `executeAdb(command, timeout?)`
- `executeShell(command, timeout?)`
- `parseKeyValueOutput(output, separator?)`
- `escapeShellArg(str)`

Suitable for wrapping raw ADB / shell operations and result parsing.

## `IntentFlag` / `IntentAction` / `IntentCategory`

These three constant enums provide the commonly used Intent flags, actions, and categories.

### `IntentFlag`

Covers:

- Activity launch flags, such as `ACTIVITY_NEW_TASK` and `ACTIVITY_CLEAR_TOP`
- URI permission flags, such as `GRANT_READ_URI_PERMISSION`
- Receiver flags, such as `RECEIVER_FOREGROUND`
- Other system flags

### `IntentAction`

Covers common:

- Standard actions, such as `ACTION_VIEW`, `ACTION_SEND`, and `ACTION_PICK`
- System settings actions, such as `ACTION_SETTINGS`
- Media actions, such as `ACTION_IMAGE_CAPTURE`
- Communication actions and broadcast actions

### `IntentCategory`

Covers common categories, such as:

- `CATEGORY_DEFAULT`
- `CATEGORY_BROWSABLE`
- `CATEGORY_LAUNCHER`
- `CATEGORY_HOME`
- Various `CATEGORY_APP_*`

The complete enums are authoritative in `examples/types/android.d.ts`.

## `Intent` Class

### Constructor

```ts
new Intent(action?: string | IntentAction)
```

### Main Properties

- `action`
- `packageName`
- `component`
- `extras`
- `flags`
- `categories`
- `executor`
- `uri`
- `type`

### Chained Methods

- `setComponent(packageName, component)`
- `setPackage(packageName)`
- `setAction(action)`
- `setData(uri)`
- `setType(type)`
- `addCategory(category)`
- `removeCategory(category)`
- `hasCategory(category)`
- `getCategories()`
- `clearCategories()`
- `addFlag(flag)`
- `putExtra(key, value)`

### Execution Actions

- `start()`: launch as an Activity
- `sendBroadcast()`: send a broadcast
- `startService()`: start a Service

## `PackageManager`

Inherits from `AdbExecutor`, for application package management.

### Methods

- `install(apkPath, replaceExisting?)`
- `uninstall(packageName, keepData?)`
- `getInfo(packageName)`
- `getList(includeSystem?)`
- `clearData(packageName)`
- `isInstalled(packageName)`

## `ContentProvider`

Inherits from `AdbExecutor`, for accessing Content Providers.

### Methods

- `setUri(uri)`
- `query(projection?, selection?, selectionArgs?, sortOrder?)`
- `insert(values)`
- `update(values, selection?, selectionArgs?)`
- `delete(selection?, selectionArgs?)`

## `SystemManager`

Inherits from `AdbExecutor`, for reading and modifying system properties, settings, and screen information.

### Methods

- `getProperty(prop)`
- `setProperty(prop, value)`
- `getAllProperties()`
- `getSetting(namespace, key)`
- `setSetting(namespace, key, value)`
- `listSettings(namespace)`
- `getScreenInfo()`

Where `namespace` is constrained by type:

```ts
'system' | 'secure' | 'global'
```

## `DeviceController`

Inherits from `AdbExecutor`, for device-level control.

### Methods

- `takeScreenshot(outputPath)`
- `recordScreen(outputPath, timeLimit?, bitRate?, size?)`
- `setBrightness(brightness)`
- `setVolume(stream, volume)`
- `setAirplaneMode(enable)`
- `setWiFi(enable)`
- `setBluetooth(enable)`
- `lock()`
- `unlock()`
- `reboot(mode?)`

The `stream` of `setVolume()` is constrained by type:

```ts
'music' | 'call' | 'ring' | 'alarm' | 'notification'
```

## `Android` Overall Entry Point

### Constructor

```ts
new Android()
```

### Members

- `packageManager`
- `systemManager`
- `deviceController`

### Factory Methods

- `createIntent(action?)`
- `createContentProvider(uri)`

## Examples

### Construct and Launch an Intent

```ts
const intent = new Intent(IntentAction.ACTION_VIEW)
  .setData('https://example.com')
  .addFlag(IntentFlag.ACTIVITY_NEW_TASK);

await intent.start();
```

### Using the `Android` Overall Entry Point

```ts
const android = new Android();
const installed = await android.packageManager.isInstalled('com.android.settings');
console.log(installed);
```

### Reading System Settings

```ts
const android = new Android();
const value = await android.systemManager.getSetting('secure', 'enabled_accessibility_services');
console.log(value);
```

### Taking a Screenshot

```ts
const android = new Android();
await android.deviceController.takeScreenshot('/sdcard/screen.png');
```

## Related Files

- `examples/types/android.d.ts`
- `examples/types/index.d.ts`
- `docs/doc-src/package-dev/system.md`
