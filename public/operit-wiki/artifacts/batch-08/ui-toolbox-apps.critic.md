# critic 报告（首轮）— ui-toolbox-apps（Issue #107）

结论：FAIL。源码钉住 dbf71916。

- quality 12 条（warn 5 / suggestion 7）逐字验证：应用切换权限加载协程无取消旧结果可覆盖新应用；cleanupOnFinish=false 任务结束不释放 Shower 虚拟屏/悬浮层；API Key 输入框无掩码；docFile.name!! 潜在 NPE；pm grant/revoke 绕过系统确认无二次确认。
- 发现 7 处问题：全部 facts/quality 路径须补全为仓库根相对全路径；fact[35] 改为"颜色表共 14 项，其中 3 个为兜底组"；fact[60]→AppPermissionsScreen.kt:1354；fact[90]→AutoGlmOneClickToolScreen.kt:263；fact[135]→ProcessLimitRemoverScreen.kt:445；fact[155]→TextToSpeechScreen.kt:126；Q3→line 338；正文"16 个 Kotlin 文件"改为 15。
- Q10 锚点：critic 建议 :139，经 parent 实地核对实际为 :137，采用 :137。
