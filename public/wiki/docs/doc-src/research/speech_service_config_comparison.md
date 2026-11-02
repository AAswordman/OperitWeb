# TTS/STT 配置方案对比

## 当前应用的已发布版本

`SpeechServicesPreferences` 使用一个 TTS 服务类型、一份共享 TTS HTTP/VITS 参数，以及一个 STT 服务类型和一份共享 STT HTTP 参数。切换服务时会覆盖同一组字段，因此不能同时保存多套端点、模型、密钥和音色。

## `prog/assistance2`

`TtsConfigManager` 和 `SttConfigManager` 分别保存配置 ID 列表、当前配置 ID 和每个配置的完整 JSON。配置具备名称、时间戳、独立模型和音色字段，并通过创建、更新、删除、选择接口管理。它还提供 Provider catalog、参数校验、本地模型安装校验和角色绑定删除保护。

## 结论

就独立模型管理、扩展性和数据校验而言，`assistance2` 更好；它把配置实体和 Provider 实现解耦，新增 Provider 不需要复用一份共享字段。当前应用的 Provider 实现和已发布数据格式更适合渐进迁移，因此本分支采用相同的 ID 列表和当前选择模型，但保留现有参数类型和 Provider 构造器，并把当前档案投影回旧 DataStore。

这样得到的取舍是：用户可以独立创建、编辑、切换和删除 TTS/STT 档案，同时已发布版本的旧读取接口和现有 Provider 不需要一次性重写。后续增加 Provider catalog 或角色绑定时，应在档案管理层扩展，而不是恢复共享单配置。
