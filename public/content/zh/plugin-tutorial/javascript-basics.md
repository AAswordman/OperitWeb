# 变量、对象与数组

这一章只做一件事：把写插件时最常用的数据组织方式讲清楚。  
这里不是在做完整 JavaScript 教材，而是在讲“你在脚本包里最常会怎么用这些语法”。

## 学完这一章，你应该能做到

- 看懂参数对象、结果对象、数组列表这三种最常见的数据形态。
- 知道什么时候优先用 `const`，什么时候改用 `let`。
- 知道字符串、数字、对象、数组在插件开发里各自常扮演什么角色。

## 建议先具备

- 知道变量是什么。
- 不排斥用对象和数组来组织数据。

## 本章对应的真实文件

- `examples/quick_start.ts`
- `docs/SCRIPT_DEV_GUIDE.md`
- `examples/types/results.d.ts`

## 先看一个最小例子

```js
const packageName = "demo_reader";
let retryCount = 0;

const params = {
  path: "/sdcard/Download/demo.txt",
  trim: true,
};

const previewLines = ["第一行", "第二行", "第三行"];

const result = {
  success: true,
  packageName,
  retryCount,
  previewLines,
};
```

## 把例子拆开理解

### 字符串

像 `packageName`、文件路径、提示词、错误消息，这些大部分都是字符串。

```js
const packageName = "demo_reader";
const path = "/sdcard/Download/demo.txt";
```

在插件里，字符串经常用于：

- 包名和工具名
- 文件路径
- 用户输入
- 返回消息

### 数字

数字常见于：

- 重试次数
- 延迟毫秒数
- 行号
- 分页参数

```js
let retryCount = 0;
retryCount += 1;
```

### 对象

对象通常是写插件时最重要的数据形态，因为：

- 参数经常是对象
- 返回结果经常是对象
- 配置项经常是对象

```js
const params = {
  path: "/sdcard/Download/demo.txt",
  trim: true,
};
```

你可以把对象理解成“有名字的字段集合”。  
插件里最常见的两个对象，就是：

- `params`
- `result`

### 数组

数组适合放同一类、按顺序组织的数据。

```js
const previewLines = ["第一行", "第二行", "第三行"];
```

插件开发里数组常见于：

- 工具列表
- 搜索结果
- 文件列表
- 多条消息

## `const` 和 `let` 怎么选

最稳的经验法则是：

- 默认先用 `const`
- 只有这个绑定后面真的要重新赋值，再用 `let`

```js
const toolName = "hello_world";
let attempts = 0;

attempts += 1;
```

这样做有两个好处：

- 代码更稳定，别人更容易判断哪些值不会变
- 出问题时更容易定位“到底是谁改了这个变量”

## 回到源码仓库，它为什么这样写

在 `examples/quick_start.ts` 里，你会不断看到这种写法：

- 参数先收进对象
- 处理结果再返回对象
- 有些字段是字符串，有些字段是数组或布尔值

这不是偶然，而是因为宿主环境和 AI 调用都更适合处理结构化数据。  
`examples/types/results.d.ts` 里也能看到这一点：很多返回值结构都是对象，比如：

- `FileContentData`
- `DirectoryListingData`
- `HttpResponseData`
- `UIPageResultData`

也就是说，你在自己的脚本里学会用对象和数组组织数据，后面接宿主 API 时会自然很多。

## 本章最容易踩的坑

### 坑 1：所有变量都用 `let`

这不会立刻报错，但会让代码越来越难读，也更难追踪状态变化。

### 坑 2：把参数拆成太多零散变量

当工具参数变多时，零散变量会很快失控；而对象更容易传递、校验和扩展。

### 坑 3：返回值只给一段字符串

如果后面你想附带更多信息，比如 `path`、`count`、`items`，就会发现结构很难扩展。  
很多场景下，返回对象会比只返回字符串更适合。

## 本章自查

- 我是否知道参数对象和结果对象为什么这么常见？
- 我是否知道数组在插件里通常拿来放哪类数据？
- 我是否已经养成“默认先用 `const`”的习惯？

## 下一章

建议继续看《[函数、模板字符串与流程控制](/#/plugin-tutorial/javascript-functions-flow)》。
