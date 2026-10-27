# critic 报告（首轮）— ui-packages-market（Issue #102）

结论：FAIL。源码钉住 dbf71916。

- facts 抽查 30 条（索引 0–116 步长 4）：全部说法准确（MarketInstallStage 9 阶段、@Synchronized update、marker 读写、install 三路径分发、纯配置 mergeConfigFromJson、defaultVersion 安装、parseMcpServerIds、MarketReviewReason 10 种、11 分类图标、market-notifications 独立 VM、toRankMetric、日期分组、描述截断、搜索回填、评论树、日期回退、主按钮四条件、点赞登录、头像缓存、Scope 四 kind、三排序、installEntry finally、marketLikeCount、四 tab、作者页）。
- quality 12 条全部实锤：high Q0（mergeConfigFromJson 把远端 JSON 的 importedServer.command 直接写入本地 MCP 配置，MCPLocalServer.kt:625，一键安装无确认）、high Q1（deleteRecursively 先删后装无回滚）、high Q2（installSkillEntry 直接 clone 服务端下发的 source.url）、warn Q3–Q7、suggestion Q8–Q11 逐行核实。
- 正文 §9 齐全；来源段（117/12）一致；无禁用词；status.json 无误。

必须修正 4 项：(1) facts.json 全 117 条用 `claim` 键，须改名为 `fact`（check_staleness.py 读 fact 键）；(2) fact[36] MarketAgreementDialog.kt:60→:64（CURRENT_MARKET_AGREEMENT_VERSION 在 :66）；(3) fact[48] 拆条——[48] 保留默认值断言（:36），新增"featuredOnly 选中显示 Check 图标"（:67）；(4) fact[52] MarketBrowseSection.kt:52→:17（MarketBrowseEntry 定义 :15–19）。
