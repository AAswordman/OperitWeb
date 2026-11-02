# API Documentation: `system.d.ts`

`system.d.ts` describes the `Tools.System` namespace. It is responsible for interacting with the device, apps, system settings, notifications, location, and terminal sessions.

## Role

The current definitions cover:

- Sleep and basic system setting reads/writes.
- App installation, uninstallation, launch, stop, and enumeration.
- App foreground usage duration statistics.
- Device info, notifications, location, and Bluetooth.
- Shell / Intent / Broadcast.
- Persistent terminal sessions.

## Runtime Entry Point

```ts
Tools.System
```

## Main APIs

### Basic Control

#### `sleep(milliseconds)`

```ts
sleep(milliseconds: string | number): Promise<SleepResultData>
```

#### `getSetting(setting, namespace?)`

Reads a system setting, returning `SystemSettingData`.

#### `setSetting(setting, value, namespace?)`

Modifies a system setting, returning `SystemSettingData`.

### Device and Prompts

#### `getDeviceInfo()`

Gets device info, returning `DeviceInfoResultData`.

#### `toast(message)`

Shows a Toast on the device, returning `StringResultData`.

#### `sendNotification(message, title?)`

Sends a notification, returning `StringResultData`.

### Music Playback

Music playback capability lives under `Tools.System.music`, returning `MusicPlaybackResultData`.

#### `music.play(options)`

Plays a single audio track.

```ts
Tools.System.music.play({
  source: "/sdcard/Download/song.mp3",
  sourceType: "path",
  title: "Song",
  artist: "Artist",
  loop: false,
  volume: 1,
  startPositionMs: 0
})
```

#### `music.playQueue(options)`

Plays an audio queue. Each track in `items` needs to provide `source` and `sourceType`, with optional `title` and `artist`.

```ts
Tools.System.music.playQueue({
  items: [
    { source: "/sdcard/Download/one.mp3", sourceType: "path", title: "One" },
    { source: "/sdcard/Download/two.mp3", sourceType: "path", title: "Two" }
  ],
  loop: false,
  volume: 1,
  startIndex: 0,
  startPositionMs: 0
})
```

#### Other Controls

```ts
Tools.System.music.pause()
Tools.System.music.resume()
Tools.System.music.stop()
Tools.System.music.seek(30000)
Tools.System.music.setVolume(0.8)
Tools.System.music.status()
```

### App Management

#### `usePackage(packageName)`

Loads a tool package. The return type in the definition is `Promise<any>`, and the specifics depend on the target package's exported capabilities.

#### `installApp(path)`

Installs an APK, returning `AppOperationData`.

#### `uninstallApp(packageName)`

Uninstalls an app, returning `AppOperationData`.

#### `stopApp(packageName)`

Stops an app, returning `AppOperationData`.

#### `listApps(includeSystem?)`

Enumerates installed apps, returning `AppListData`.

#### `startApp(packageName, activity?)`

Launches an app, optionally specifying an Activity, returning `AppOperationData`.

#### `getAppUsageTime(options?)`

Reads foreground app usage durations provided by Android Usage Access, returning `AppUsageTimeResultData`.

```ts
getAppUsageTime({
  packageName?,
  sinceHours?,
  limit?,
  includeSystemApps?
}): Promise<AppUsageTimeResultData>
```

Notes:

- By default, statistics cover the most recent `24` hours.
- When `packageName` is passed, it returns that app's usage duration.
- When `packageName` is not passed, it returns the top `limit` apps sorted by usage duration in descending order.
- If the "Usage Access" permission is missing, the runtime guides the user to the authorization page.

### Notifications and Location

#### `getNotifications(limit?, includeOngoing?)`

Returns `NotificationData`.

#### `getLocation(highAccuracy?, timeout?, includeAddress?)`

Returns `LocationData`. `includeAddress` defaults to `true`; when set to `false`, only coordinates are returned, skipping the system coordinate reverse lookup.

### Bluetooth

Bluetooth capability lives under `Tools.System.bluetooth`.

#### `bluetooth.requestPermission()`

Requests the Bluetooth nearby-devices permission, returning `StringResultData`.

#### `bluetooth.getState()`

Reads the Bluetooth adapter state, returning `BluetoothStateData`.

#### `bluetooth.requestEnable()`

Opens the system Bluetooth enable dialog, returning `StringResultData`.

#### `bluetooth.listBondedDevices()`

Lists paired Bluetooth devices, returning `BluetoothBondedDevicesData`.

#### `bluetooth.scan(options?)`

```ts
bluetooth.scan({ durationMs?, includeBle? }): Promise<BluetoothScanResultData>
```

Scans for nearby Bluetooth Classic and BLE devices.

#### Classic Connection and Data Transfer

```ts
bluetooth.connect({ address, uuid? }): Promise<BluetoothSessionData>
bluetooth.listen({ name?, uuid? }): Promise<BluetoothSessionData>
bluetooth.accept(listenerSessionId, timeoutMs?): Promise<BluetoothSessionData>
bluetooth.send(sessionId, { text?, dataBase64? }): Promise<BluetoothTransferData>
bluetooth.read(sessionId, { maxBytes?, timeoutMs? }): Promise<BluetoothReadData>
bluetooth.sendAndRead(sessionId, { text?, dataBase64?, maxBytes?, timeoutMs? }): Promise<BluetoothReadData>
bluetooth.close(sessionId): Promise<StringResultData>
```

`sendAndRead` is used to read the response immediately after sending a command. Text is sent as UTF-8; binary data uses `dataBase64`.

#### BLE

```ts
bluetooth.ble.connect({ address, autoConnect? }): Promise<BluetoothSessionData>
bluetooth.ble.discoverServices(sessionId, timeoutMs?): Promise<BluetoothBleServicesData>
bluetooth.ble.readCharacteristic(sessionId, { serviceUuid, characteristicUuid, timeoutMs? }): Promise<BluetoothReadData>
bluetooth.ble.writeCharacteristic(sessionId, { serviceUuid, characteristicUuid, text?, dataBase64? }): Promise<BluetoothTransferData>
bluetooth.ble.writeAndReadCharacteristic(sessionId, { writeServiceUuid, writeCharacteristicUuid, readServiceUuid, readCharacteristicUuid, text?, dataBase64?, timeoutMs? }): Promise<BluetoothReadData>
bluetooth.ble.subscribe(sessionId, { serviceUuid, characteristicUuid, enable? }): Promise<BluetoothTransferData>
bluetooth.ble.readNotifications(sessionId, limit?): Promise<BluetoothBleNotificationData>
```

`writeAndReadCharacteristic` is used to read the response characteristic after writing a command. BLE notifications are enabled via `subscribe` and then read with `readNotifications` to get the data already received.

### Shell and Intent

#### `shell(command)`

```ts
shell(command: string): Promise<ADBResultData>
```

The type annotation explicitly states: this capability requires root.

#### `intent(options?)`

```ts
intent({
  action?,
  uri?,
  package?,
  component?,
  flags?,
  extras?,
  type?: 'activity' | 'broadcast' | 'service'
}): Promise<IntentResultData>
```

#### `sendBroadcast(options?)`

```ts
sendBroadcast({
  action,
  uri?,
  package?,
  component?,
  extras?,
  extra_key?,
  extra_value?,
  extra_key2?,
  extra_value2?
}): Promise<IntentResultData>
```

## Terminal Session APIs

Terminal capability lives under `Tools.System.terminal`.

### `terminal.create(sessionName?)`

Creates or gets a terminal session, returning `TerminalSessionCreationResultData`.

### `terminal.exec(sessionId, command, timeoutMs?)`

Executes a command in the specified session, returning `TerminalCommandResultData`.
On timeout, no error is thrown; the result is still returned normally, with `timedOut = true`.

The type annotation recommends always explicitly passing `timeoutMs`.

### `terminal.close(sessionId)`

Closes a session, returning `TerminalSessionCloseResultData`.

### `terminal.screen(sessionId)`

Reads the currently visible terminal screen, returning `TerminalSessionScreenResultData`.

### `terminal.input(sessionId, options?)`

```ts
input(sessionId, {
  input?,
  control?
}): Promise<StringResultData>
```

Notes:

- To input only text, pass `input`.
- To input only a control key, pass `control`.
- When both are passed, they are treated as a key combination, e.g. `control: 'ctrl', input: 'c'`.

## Examples

### Sleep and Toast

```ts
await Tools.System.sleep(1000);
await Tools.System.toast('执行完成');
```

### Launching an App

```ts
await Tools.System.startApp('com.android.settings');
```

### Reading the Past Day's App Usage Durations

```ts
const usage = await Tools.System.getAppUsageTime({
  sinceHours: 24,
  limit: 5
});
console.log(usage.toString());
```

### Sending a Broadcast

```ts
await Tools.System.sendBroadcast({
  action: 'com.example.SYNC',
  extra_key: 'mode',
  extra_value: 'full'
});
```

### Using a Terminal Session

```ts
const session = await Tools.System.terminal.create('demo');
await Tools.System.terminal.exec(session.sessionId, 'pwd', 5000);
const screen = await Tools.System.terminal.screen(session.sessionId);
console.log(screen.toString());
await Tools.System.terminal.close(session.sessionId);
```

## Related Files

- `examples/types/system.d.ts`
- `examples/types/results.d.ts`
- `docs/doc-src/package-dev/results.md`
