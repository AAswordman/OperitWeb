# critic 报告（首轮）— ui-common-dsl（Issue #108）

结论：FAIL。源码钉住 dbf71916。

- facts 抽查 38 条：全部说法为真，无事实错误；9 处锚点漂移。
- quality 18 条全部实锤：high Q0（ToolPkgComposeDslWebView.kt:2104，onPermissionRequest 直接 grant(request.resources)，页面请求的摄像头/麦克风等权限全部自动授予）、high Q1（:2261–2263，allowFileAccessFromFileURLs/allowUniversalAccessFromFileURLs 默认 true，file:// 页面可跨域读本地文件）、high Q2（:2108，onGeolocationPermissionsShowPrompt 中 callback?.invoke(origin.orEmpty(), true, false)，定位权限静默自动授予）；warn 6 / suggestion 9 核实。
- frontmatter sources=6=distinct 文件数；status.json 无误。

必须修正 13 项（均为锚点错位）：facts[105]→:68、[110]→:160、[120]→:413、[125]→:771、[135] 拆两条（:1116/:1174）、[140] 拆三条（:1841/:1869/:1886）、[150] 拆四条（:2253/:2261/:2273/:2281）、[161]→DebugSnapshotStore:120、[162]→:142；Q8→line 1244（evidence :1244–1253）、Q11→2019（:2019–2029）、Q14→308（:302–313）、Q17→97。
