# critic 报告（首轮）— ui-main（Issue #110）

结论：FAIL。源码钉住 dbf71916。

- quality 14 条（warn 7 / suggestion 7）逐字验证：MainActivity.kt:575 设置 preferredDisplayModeId 后未 setAttributes() 高刷可能不生效；ScreenRouteRegistry.kt:480 反射构建 Screen 失败被静默吞掉；composable 缓存堆积；rememberLocal 先写后读竞态；OAuth 回调端口精确匹配可能超时。
- 发现 6 处锚点错位：fact[30]→MainActivity:683、fact[36]→OperitApp:129、fact[96] 改写（五档属于 AndroidPermissionLevel，ref→DrawerContent:77）、fact[108]→PhoneLayout:94、fact[114]→TabletLayout:77、fact[156]→MaterialIconNameResolver:31。
