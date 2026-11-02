# DragonBones Module

This module provides the ability to use DragonBones skeletal animations in an Android app. It uses a WebView to load DragonBones.js and Three.js to render animations.

## Features

- Supports loading and playing DragonBones skeletal animations
- Provides both a Compose component and a traditional View component
- Supports animation control (play, stop, setting speed, etc.)
- Supports model transformation (position, scale)
- Supports fetching the animation list and other model information

## Usage

### 1. Prepare Model Files

Place DragonBones model files in the `assets/dragonbones/models/` directory. Each model needs to include the following files:

- `xxx.json` - skeletal data file
- `xxx_tex.json` - texture data file
- `xxx_tex.png` - texture image file

### 2. Using in Compose

```kotlin
// 创建模型对象
val model = DragonBonesModel(
    skeletonPath = "file:///android_asset/dragonbones/models/loong/loongbones-web.json",
    texturePath = "file:///android_asset/dragonbones/models/loong/loongbones-web_tex.json",
    textureImagePath = "file:///android_asset/dragonbones/models/loong/loongbones-web_tex.png"
)

// 创建配置对象
val config = DragonBonesConfig(
    scale = 0.5f,
    translateX = 0f,
    translateY = 0f,
    speed = 1.0f
)

// 使用 Compose 组件
DragonBonesViewCompose(
    modifier = Modifier.fillMaxSize(),
    model = model,
    config = config,
    animationToPlay = "stand",
    onModelLoaded = {
        // 模型加载完成后的回调
    }
)
```

### 3. Using in a Traditional View

```kotlin
// 创建 DragonBonesView
val dragonBonesView = DragonBonesView(context)

// 设置加载完成回调
dragonBonesView.setOnReadyCallback {
    // 模型加载完成后的回调
}

// 加载模型
dragonBonesView.loadModel(
    "file:///android_asset/dragonbones/models/loong/loongbones-web.json",
    "file:///android_asset/dragonbones/models/loong/loongbones-web_tex.json",
    "file:///android_asset/dragonbones/models/loong/loongbones-web_tex.png"
)

// 播放动画
dragonBonesView.play("stand")

// 设置速度
dragonBonesView.setSpeed(1.0f)

// 设置位置
dragonBonesView.setPosition(0f, 0f)

// 设置缩放
dragonBonesView.setScale(0.5f)
```

## Example

See the `DragonBonesLoongExample.kt` file for a complete example of using the dragon model.

## Notes

1. Ensure the INTERNET permission is added in AndroidManifest.xml
2. Ensure the model file paths are correct
3. Model loading is asynchronous; please use callbacks to handle the logic after loading completes
