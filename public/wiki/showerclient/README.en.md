## Shower Client Library (`showerclient` module)

A minimal Shower client library, keeping only instructions on **how to integrate and use** it.

---

## 1. Add the Dependency

In the host App module's `build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":showerclient"))
}
```

---

## 2. Provide a `ShellRunner` Implementation

`showerclient` does not execute shell commands directly; it only requests the capability from outside through an interface:

```kotlin
fun interface ShellRunner {
    suspend fun run(command: String, identity: ShellIdentity): ShellCommandResult
}
```

Implement it in the App module and inject it at application startup:

```kotlin
class OperitShowerShellRunner : ShellRunner {
    override suspend fun run(command: String, identity: ShellIdentity): ShellCommandResult {
        // 在这里调用你自己的 shell 执行器
        // 并把结果转换成 ShellCommandResult 返回
    }
}

class YourApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        ShowerEnvironment.shellRunner = OperitShowerShellRunner()
    }
}
```

`ShellIdentity` is used to distinguish the execution identity, for example `DEFAULT` / `SHELL` / `ROOT`; map it according to your project's needs.

---

## 3. Shower Server JAR (Built In)

This library already bundles `shower-server.jar` in its own module:

- The host App does **not** need to manually package or copy any JAR files;
- At runtime, the library automatically reads it from its own `assets`, copies it to `/sdcard/Download/Operit/shower-server.jar`, and then copies it to `/data/local/tmp/shower-server.jar`.

---

## 4. Handle the Binder Handover Broadcast

After the Shower server starts, it sends the `IBinder` of `IShowerService` to the client via a broadcast. The host App needs to hand it to this library in a broadcast receiver:

Broadcast protocol (consistent with the main project):

 - **Action**: `com.ai.assistance.operit.action.SHOWER_BINDER_READY`
 - **Extra key**: `binder_container`
 - **Extra type**: `com.ai.assistance.shower.ShowerBinderContainer` (`Parcelable`, internally containing the `IBinder`)

```kotlin
class ShowerBinderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_SHOWER_BINDER_READY) return

        val container = intent.getParcelableExtra<ShowerBinderContainer>(EXTRA_BINDER_CONTAINER)
        val binder = container?.binder ?: return
        val service = IShowerService.Stub.asInterface(binder)
        ShowerBinderRegistry.setService(service)
    }

    companion object {
        const val ACTION_SHOWER_BINDER_READY =
            "com.ai.assistance.operit.action.SHOWER_BINDER_READY"
        const val EXTRA_BINDER_CONTAINER = "binder_container"
    }
}
```

Register the Receiver in `AndroidManifest.xml` (**requires `exported=true`**, because the broadcast sender runs in a separate shower-server process):

```xml
<receiver
    android:name=".ShowerBinderReceiver"
    android:exported="true">
    <intent-filter>
        <action android:name="com.ai.assistance.operit.action.SHOWER_BINDER_READY" />
    </intent-filter>
</receiver>
```

Notes:

 - The `ShowerServerManager` start command carries the host package name as a parameter: `CLASSPATH=/data/local/tmp/shower-server.jar app_process / com.ai.assistance.shower.Main <hostPackage> &`.
 - After reading that parameter, shower-server sends `SHOWER_BINDER_READY` via `IActivityManager.broadcastIntent(...)`, and uses `Intent.setPackage(<hostPackage>)` to deliver it only to the target host package.
 - Therefore, the key point on the host App side is: **the action declared in the Manifest's intent-filter must match**, and in `onReceive()` the `ShowerBinderContainer` must be handed to `ShowerBinderRegistry.setService()`.

---

## 5. Start the Shower Server and Create a Virtual Display

Wherever you need to use Shower (for example, in an Agent or Service):

```kotlin
// 1）确保 server 已启动并且成功收到 Binder
val ok = ShowerServerManager.ensureServerStarted(context)
if (!ok) return

// 2）创建 / 更新虚拟显示
val displayOk = ShowerController.ensureDisplay(
    context = context,
    width = 1080,
    height = 2400,
    dpi = 480,
    bitrateKbps = 8000,
)
if (!displayOk) return
```

After that, input events can be sent via `ShowerController`:

```kotlin
ShowerController.touchDown(x, y)
ShowerController.touchMove(x, y)
ShowerController.touchUp(x, y)
ShowerController.key(KeyEvent.KEYCODE_BACK)
```

Screenshot:

```kotlin
val pngBytes: ByteArray? = ShowerController.requestScreenshot()
```

---

## 6. Use the Built-in Video Components (Optional)

If you want to directly reuse the built-in video decoding and rendering, you can use:

- `com.ai.assistance.showerclient.ShowerVideoRenderer`
- `com.ai.assistance.showerclient.ui.ShowerSurfaceView`

Example: render the Shower virtual screen in a floating window:

```kotlin
// SurfaceView（也可以继承 ui.ShowerSurfaceView 做一层包装）
class ShowerSurfaceView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : com.ai.assistance.showerclient.ui.ShowerSurfaceView(context, attrs)
```

`ui.ShowerSurfaceView` already handles the following internally for you:

- Waits until `ShowerController.getVideoSize()` is ready;
- Calls `ShowerVideoRenderer.attach(surface, w, h)` when `surfaceCreated` fires;
- Binds the binary frame callbacks from `ShowerController` to `ShowerVideoRenderer.onFrame`;
- Cleans up the handler and calls `detach()` when `surfaceDestroyed` fires.

If you need custom decoding/rendering (screen recording, streaming, etc.), you can skip these components and implement it yourself:

```kotlin
ShowerController.setBinaryHandler { frame: ByteArray ->
    // 自己解码并渲染
}
```

---

## 7. Minimal Mental Model

- You provide: `ShellRunner`, the broadcast receiver;
- This library provides: `ShowerServerManager` + `ShowerController` + the optional `ShowerVideoRenderer` / `ui.ShowerSurfaceView`;
- Common call order: **inject ShellRunner → start server → receive Binder → ensureDisplay → send input / render video**.
