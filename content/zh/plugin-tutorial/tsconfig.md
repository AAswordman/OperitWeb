# tsconfig 基础模板

这一章只做一件事：把单文件脚本最常用的 `tsconfig.json` 模板建立起来。  
更复杂的场景，比如多文件工程、ToolPkg、类型不生效时怎么排错，会放到下一章专门讲。

## 学完这一章，你应该能做到

- 看懂一个最常用的脚本包 `tsconfig.json`。
- 知道 `target`、`module`、`lib`、`typeRoots` 这几项为什么关键。
- 知道 `typeRoots` 为什么和 `examples/types` 有直接关系。

## 建议先具备

- 已经看过《TypeScript 类型入门》。
- 知道 `.d.ts` 是类型声明文件。

## 本章对应的真实文件

- `examples/tsconfig.json`
- `examples/types/index.d.ts`
- `docs/SCRIPT_DEV_GUIDE.md`

## 先看一个最小例子

下面这份配置和 `examples/tsconfig.json` 的思路是一致的：

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "strict": false,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "typeRoots": ["./types"]
  },
  "include": [
    "*.ts",
    "*.d.ts",
    "types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

## 把例子拆开理解

### `target: "es2020"`

这决定输出的 JavaScript 语法目标版本。  
这里选 `es2020`，是为了和仓库示例保持一致，也方便使用相对现代的语法能力。

### `module: "commonjs"`

这在插件脚本里非常关键。  
因为宿主脚本的导出方式本来就更接近：

```js
exports.main = main;
```

也就是 `CommonJS` 风格，而不是浏览器侧常见的 ESM 加载方式。

### `lib: ["es2020"]`

这一项看起来不起眼，但非常重要。  
它的作用是告诉 TypeScript：默认只把 ECMAScript 标准库当作基础。

这样做的好处是：

- 不会默认把 DOM 类型带进来
- 不会让你误以为这里天然是网页脚本环境

### `typeRoots: ["./types"]`

这项和 `examples/types` 的关系最直接。  
如果你在独立项目里想获得宿主环境的类型提示，通常就要：

1. 把 `examples/types` 复制成你项目里的 `types/`
2. 再通过 `typeRoots` 把它接进编译器

否则即使你写了：

```ts
/// <reference path="./types/index.d.ts" />
```

整体类型接入也可能不完整，或者项目里别的文件拿不到对应声明。

### `include`

```json
"include": [
  "*.ts",
  "*.d.ts",
  "types/**/*.ts"
]
```

它决定哪些文件进入编译范围。  
如果文件根本没被纳入编译，后面很多“怎么没有类型”“怎么没产物”的问题都不会解决。

## 回到源码仓库，它为什么这样写

`examples/tsconfig.json` 的核心设计目标非常明确：

- 适合单文件或小规模脚本开发
- 对齐宿主的 `commonjs` 风格
- 不默认引入网页 DOM 类型
- 为 `types/` 目录留出清楚入口

这也是为什么在 `SCRIPT_DEV_GUIDE.md` 里，独立项目的建议写法会反复强调：

- 复制 `examples/types/`
- 把它放进自己的 `types/`
- 用 `typeRoots` 接进去

## 本章最容易踩的坑

### 坑 1：把 `module` 配成和宿主导出风格不一致的模式

结果经常是：

- 编译能过
- 运行时导出不生效

### 坑 2：没有意识到 `typeRoots` 本质上是在告诉编译器“宿主类型目录在哪里”

结果就是只复制了示例代码，却没有把宿主类型真正接进项目。

### 坑 3：默认把这个环境当成有 DOM 的前端环境

如果你一开始就把类型体系配成网页脚本心智，后面会一直混淆。

## 本章自查

- 我是否知道为什么这里常用 `module: "commonjs"`？
- 我是否知道 `lib: ["es2020"]` 为什么在这里比默认 DOM 环境更合适？
- 我是否知道 `typeRoots` 和 `examples/types` 之间的直接关系？

## 下一章

建议继续看《[场景化 tsconfig 与排错](/#/guide/plugin/tsconfig-scenarios)》。
