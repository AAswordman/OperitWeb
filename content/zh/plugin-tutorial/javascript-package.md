# 第一个 JavaScript 脚本包

这一章开始真正把前面的基础拼起来。  
目标不是再讲一遍语法，而是让你看到一个最小可运行脚本包到底由哪些部分组成。

## 学完这一章，你应该能做到

- 看懂一个最小 JavaScript 脚本包的整体结构。
- 知道 `METADATA`、工具函数、`exports` 这三部分分别负责什么。
- 能自己写出一个可以被宿主发现和调用的最小包。

## 建议先具备

- 已经看过前面的 JavaScript 三章。
- 知道 `async`、`try / catch`、对象返回值的基本用途。

## 本章对应的真实文件

- `examples/quick_start.ts`
- `examples/README.md`
- `docs/SCRIPT_DEV_GUIDE.md`

## 先看一个最小例子

```js
/*
METADATA
{
  "name": "hello_package",
  "description": {
    "zh": "一个最小的示例脚本包",
    "en": "A minimal demo script package"
  },
  "category": "Utility",
  "tools": [
    {
      "name": "hello_world",
      "description": {
        "zh": "向指定名字问好",
        "en": "Say hello to a given name"
      },
      "parameters": [
        {
          "name": "name",
          "description": {
            "zh": "名字",
            "en": "Name"
          },
          "type": "string",
          "required": true
        }
      ]
    }
  ]
}
*/

async function hello_world(params) {
  try {
    const name = params.name || "世界";
    await Tools.System.sleep(300);

    complete({
      success: true,
      message: `你好，${name}`,
    });
  } catch (error) {
    complete({
      success: false,
      message: `执行失败：${String(error.message || error)}`,
    });
  }
}

exports.hello_world = hello_world;
```

## 把例子拆开理解

### 第一部分：`METADATA`

这是宿主读取“这个包是谁、里面有哪些工具、每个工具要什么参数”的入口。  
你可以把它理解成这份脚本包的说明书。

### 第二部分：工具函数本体

这里的 `hello_world` 就是被宿主调用的真正逻辑。

它做了三件事：

1. 接收参数
2. 执行业务逻辑
3. 通过 `complete(...)` 返回结果

### 第三部分：`exports`

```js
exports.hello_world = hello_world;
```

这一步相当于把工具函数挂到公开接口上。  
如果漏掉它，宿主通常找不到你的工具实现。

## 从宿主视角看，这个包是怎么被调用的

可以把宿主的动作想成下面这条链路：

1. 先解析 `METADATA`
2. 知道这个包里声明了一个叫 `hello_world` 的工具
3. 真正调用时，去找 `exports.hello_world`
4. 把参数对象传进去
5. 等脚本通过 `complete(...)` 返回结果

这也是为什么后面要专门有一章讲《METADATA、exports 与 complete》。  
因为这三者并不是松散拼在一起的，而是一条完整协议。

## 回到源码仓库，它为什么这样写

`examples/quick_start.ts` 虽然是教学示例，但它已经把最关键的真实结构放进去了：

- 文件顶部是 `METADATA`
- 中间是业务函数和 wrapper
- 最后通过 `exports` 暴露工具

你以后去看更大的包，比如 `examples/github/src/index.ts`，会发现包规模变大了，但这个骨架其实没有变：

- 仍然有工具声明
- 仍然有函数实现
- 仍然要把函数暴露给宿主

## 本章最容易踩的坑

### 坑 1：能跑的函数写出来了，但没写 `METADATA`

这样宿主根本不知道该把它当成哪个工具。

### 坑 2：`METADATA` 里写了工具名，但没有对应的导出

看起来像“声明了工具”，实际调用时却找不到实现。

### 坑 3：所有事情都塞到一个超长函数里

最小示例可以先这样做，但只要逻辑稍微变复杂，就应该考虑 wrapper 和更清楚的结构分层。

## 本章自查

- 我是否知道一个最小脚本包至少包含哪三部分？
- 我是否知道宿主是先看 `METADATA`，再去找导出函数？
- 我是否已经能写出一个最小但结构完整的 `hello_world` 包？

## 下一章

建议继续看《[METADATA、exports 与 complete](/#/plugin-tutorial/metadata-exports-complete)》。
