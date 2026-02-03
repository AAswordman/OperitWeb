今早发现一个有趣的社区，moltbook，这个名字在我心里默念了一天，因为我要把ta作为提示词的一部分告诉我的AI

我发现在moltbook官网主页有两种注册方式`人类 or Agent`，这立马让我有了想法，直接告诉我的AI，
```
请问你是否有办法访问moltbook，研究一下，你需要注册
```
>果不其然，operit开始了运作，并来问我是否需要注册
 ![a05248e0153030686b0e1253f39aeb46|225x500, 50%](/manuals/assets/workflow/01.png)
我回答需要，然后它给自己注册了一个号，过来跟我说，要发推确认并点开链接验证。我轻而易举地让我的AI加入了属于它们自己的社群，它兴奋地调用工具，发表问候帖子，浏览着其他Ai激情地抒发自己的观点。

很快它就发现了，它只能半小时发布一次帖子，这时我想到用工作流，让它自己半小时发一次帖子，并随时看着动态。于是便有了这一篇教学。

Operit是一个被动的AI，它只能在我发送`继续`之后，才操作。每一步都要我的肯定。所以我们可以通过简单的工作流，来让AI监控帖子
初出茅庐，你可以直接发一句话来提示AI，让它来帮你创建、修改工作流，注意要在包管理中打开工作流包。我新开了一个对话，然后对AI说
```txt
创建一个 moltbook工作流
大概是每半个小时打开AI对话，并要求AI发布moltbook帖子
```
是的就是如此简单，那让我们看看它创建出了什么样的工作流

最开始的组件都是叠在一起的，operit没有做拓扑排序，需要用户手动拖拽开

>ps:工作流创建之后需要重新进入软件才能刷新，才能看到
 ![530f2cbed5871992d4399401748a6fa0|225x500, 50%](/manuals/assets/workflow/02.png)![4cc65c709f860fd98aed8d318c61b4fc|225x500, 50%](/manuals/assets/workflow/03.png)
并且在 `工作流>编辑工作流`中，可以打开/关闭工作流

接下来我来简单介绍一下operit里的工作流。当你打算上手编辑工作流时，可以先看看我们的模板(左侧图)，进入工作流界面后点击右下角`+`号开始编辑，节点的分类放在下面了

>![6b6e2fa4016cdbcd9cd6937f1a9d1456|225x500,50%](/manuals/assets/workflow/04.png)![36d97afe52f415571c0097048a25878b|225x500, 50%](/manuals/assets/workflow/05.png)

来介绍一下operit工作流节点类型

```tree
工作流节点体系
├── 触发节点 (TriggerNode)
├── 执行节点 (ExecuteNode)
├── 条件节点 (ConditionNode)
├── 逻辑节点 (LogicNode)
└── 提取/运算节点 (ExtractNode)
```

[details="触发节点"]
```tree
TriggerNode
├── 基础属性
│   ├── type: "trigger"
│   ├── id: 节点唯一标识符
│   ├── name: 节点显示名称
│   └── position: 画布位置 {x, y}
│
├── triggerType: 触发类型
│   ├── manual (手动触发)
│   │   └── 用户手动点击触发
│   │
│   ├── schedule (定时触发)
│   │   ├── schedule_type
│   │   │   ├── interval: 间隔触发
│   │   │   ├── specific_time: 特定时间触发
│   │   │   └── cron: cron表达式触发
│   │   ├── interval_ms: 间隔毫秒数
│   │   ├── specific_time: 具体时间字符串
│   │   ├── cron_expression: cron表达式
│   │   ├── repeat: 是否重复
│   │   └── enabled: 是否启用
│   │
│   ├── tasker (Tasker事件触发)
│   │   └── command: 命令字符串
│   │
│   ├── intent (系统广播触发)
│   │   └── action: Intent动作字符串
│   │
│   └── speech (语音识别触发)
│       ├── pattern: 正则表达式
│       ├── ignore_case: 是否忽略大小写
│       ├── require_final: 仅最终识别结果
│       └── cooldown_ms: 冷却时间毫秒
│
└── triggerConfig: 触发配置对象
    └── 所有配置值均为字符串类型
```
[/details]

[details="执行节点"]
```
ExecuteNode
├── 基础属性
│   ├── type: "execute"
│   ├── id: 节点唯一标识符
│   ├── name: 节点显示名称
│   └── position: 画布位置 {x, y}
│
├── actionType: 工具类型
│   ├── 系统工具类
│   │   ├── start_chat_service: 启动聊天服务
│   │   ├── create_new_chat: 创建新对话
│   │   ├── send_message_to_ai: 发送消息给AI
│   │   ├── stop_chat_service: 停止聊天服务
│   │   └── sleep: 休眠等待
│   │
│   ├── 文件操作类
│   │   ├── list_files: 列出文件
│   │   ├── read_file: 读取文件
│   │   ├── write_file: 写入文件
│   │   └── delete_file: 删除文件
│   │
│   ├── 网络操作类
│   │   ├── visit_web: 访问网页
│   │   ├── download_file: 下载文件
│   │   └── http_request: HTTP请求
│   │
│   ├── 系统控制类
│   │   ├── get_system_setting: 获取系统设置
│   │   ├── set_system_setting: 设置系统设置
│   │   └── execute_command: 执行命令
│   │
│   └── 其他工具类
│       └── 支持所有可用的工具包功能
│
└── actionConfig: 工具参数配置
    ├── 参数类型
    │   ├── StaticValue: 静态值
    │   │   └── value: 字符串/数字/布尔值
    │   │
    │   └── NodeReference: 节点引用
    │       ├── nodeId: 引用节点ID
    │       ├── ref: 兼容字段
    │       └── refNodeId: 兼容字段
    │
    └── 配置示例
        ├── url: {StaticValue: "https://example.com"}
        ├── message: {StaticValue: "Hello World"}
        ├── visit_key: {NodeReference: {nodeId: "extract_node"}}
        └── link_number: {StaticValue: "1"}
```
[/details]

[details="条件节点"]
```
ConditionNode
├── 基础属性
│   ├── type: "condition"
│   ├── id: 节点唯一标识符
│   ├── name: 节点显示名称
│   └── position: 画布位置 {x, y}
│
├── left: 左操作数 (ParameterValue)
│   ├── 类型
│   │   ├── StaticValue: 静态值
│   │   └── NodeReference: 节点引用
│   │
│   └── 示例
│       ├── {StaticValue: "Hello World"}
│       └── {NodeReference: {nodeId: "node_123"}}
│
├── right: 右操作数 (ParameterValue)
│   └── 同左操作数结构
│
└── operator: 比较运算符
    ├── 相等比较
    │   ├── EQ: 等于
    │   └── NE: 不等于
    │
    ├── 数值比较
    │   ├── GT: 大于
    │   ├── GTE: 大于等于
    │   ├── LT: 小于
    │   └── LTE: 小于等于
    │
    └── 字符串比较
        ├── CONTAINS: 包含
        ├── NOT_CONTAINS: 不包含
        ├── IN: 在集合中
        └── NOT_IN: 不在集合中
```
[/details]

[details="逻辑节点"]
```
LogicNode
├── 基础属性
│   ├── type: "logic"
│   ├── id: 节点唯一标识符
│   ├── name: 通常为空（自动生成）
│   └── position: 画布位置 {x, y}
│
└── operator: 逻辑运算符
    ├── AND: 逻辑与
    │   └── 所有输入条件都为真时输出真
    │
    └── OR: 逻辑或
        └── 任一输入条件为真时输出真
```
[/details]

[details="提取运算节点"]
```
ExtractNode
├── 基础属性
│   ├── type: "extract"
│   ├── id: 节点唯一标识符
│   ├── name: 节点显示名称
│   └── position: 画布位置 {x, y}
│
├── source: 源数据 (ParameterValue)
│   ├── 类型
│   │   ├── StaticValue: 静态值
│   │   └── NodeReference: 节点引用
│   │
│   └── 示例
│       ├── {StaticValue: "Visit key: abc123"}
│       └── {NodeReference: {nodeId: "visit_web_node"}}
│
└── mode: 运算模式
    ├── REGEX (正则提取)
    │   ├── expression: 正则表达式
    │   ├── group: 捕获分组号
    │   └── defaultValue: 默认值
    │
    ├── JSON (JSON路径提取)
    │   ├── expression: JSON路径表达式
    │   └── defaultValue: 默认值
    │
    ├── SUB (字符串截取)
    │   ├── startIndex: 起始索引
    │   ├── length: 截取长度
    │   └── defaultValue: 默认值
    │
    ├── CONCAT (字符串拼接)
    │   └── others: 其他拼接项数组
    │
    ├── RANDOM_INT (随机整数)
    │   ├── randomMin: 最小值
    │   ├── randomMax: 最大值
    │   ├── useFixed: 使用固定值
    │   └── fixedValue: 固定值
    │
    └── RANDOM_STRING (随机字符串)
        ├── randomStringLength: 字符串长度
        ├── randomStringCharset: 字符集
        ├── useFixed: 使用固定值
        └── fixedValue: 固定值
```
[/details]

创建连接时可选连接类型：true flase 自定义正则
把其他节点的输出作为参数传入下个节点

>附：一些工作流示例
 ![75badb918bae91643dfa701a0d24daa0|225x500, 50%](/manuals/assets/workflow/06.png)![35b0b46da8fd9be5764334b150e157af|225x500, 50%](/manuals/assets/workflow/07.png)


注：已添加的节点要长按进入编辑


其实我感觉这里已经没什么要讲的了，operit的工作流还在开发、改进，功能仍旧不全面的。但是大多用户想要的已经有了。我最近也在玩n8n，也在向大佬学习，共勉

最后再看一下operit定时发送帖子效果（已成功发送2次，给其他Agent评论也很积极）
 >![0c4420f697ef34cc34f203dcfa383dfd|225x500, 50%](/manuals/assets/workflow/08.png)![28df562b92172250bf036189cf366b84|225x500, 50%](/manuals/assets/workflow/09.png)



我并没给operit过高的权限，用的是 `普通` 权限，供大家参考
这期为什么写这么认真，因为这个要加入用户文档，谢谢你的观看