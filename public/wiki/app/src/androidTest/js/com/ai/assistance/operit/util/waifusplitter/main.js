'use strict';

const { assert, assertEq, test, runTests } = require('../../../../../../lib/harness');

function getWaifuMessageProcessorInstance() {
  return Java.type('com.ai.assistance.operit.util.WaifuMessageProcessor').INSTANCE;
}

function getStreamingSessionClass() {
  return Java.type('com.ai.assistance.operit.util.WaifuMessageProcessor$StreamingSession');
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (value == null) {
    return [];
  }
  if (typeof value.size === 'function' && typeof value.get === 'function') {
    const size = Number(value.size());
    const out = [];
    for (let i = 0; i < size; i += 1) {
      out.push(String(value.get(i)));
    }
    return out;
  }
  return [String(value)];
}

function assertListEq(actual, expected, message) {
  assertEq(JSON.stringify(normalizeList(actual)), JSON.stringify(expected), message);
}

function createKotlinAdapter() {
  const processor = getWaifuMessageProcessorInstance();
  const StreamingSession = getStreamingSessionClass();

  return {
    splitMessageBySentences(content, removePunctuation) {
      return normalizeList(processor.splitMessageBySentences(content, !!removePunctuation));
    },
    splitStableMessageSegments(content, removePunctuation) {
      return normalizeList(processor.splitStableMessageSegments(content, !!removePunctuation));
    },
    createStreamingSession(removePunctuation) {
      const session = new StreamingSession(!!removePunctuation);
      return {
        collectStableSegments(content) {
          return normalizeList(session.collectStableSegments(content));
        },
        collectFinalSegments(content) {
          return normalizeList(session.collectFinalSegments(content));
        },
      };
    },
    cleanContentForWaifu(content) {
      return String(processor.cleanContentForWaifu(content));
    },
  };
}

const SENTENCE_END_RE = /(?:[。！？~～.!?…]|\.\.\.)\s*$/;
const URL_CHAR_CLASS = "[A-Za-z0-9._~:/?#\\[\\]@!$&'()*+,;=%-]";
const URL_RE = new RegExp(`https?://${URL_CHAR_CLASS}+`);
const DOMAIN_URL_RE = new RegExp(
  `(?:www\\.)?(?:[A-Za-z0-9-]+\\.)+[A-Za-z]{2,}(?::\\d+)?(?:[/?#]${URL_CHAR_CLASS}*)?`
);
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

function getLastVisibleLine(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

function lineAllowsStableWithoutSentenceEnding(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return false;
  }
  if (/^(?:```|\|)/.test(trimmed) || /^\$\$/.test(trimmed)) {
    return true;
  }
  if (/^(?:#+\s*|>\s*|[-*+]\s+|\d+\.\s+)/.test(trimmed)) {
    return true;
  }

  const cleaned = trimmed
    .replace(/^\*+|\*+$/g, '')
    .replace(/^_+|_+$/g, '')
    .replace(/^~+|~+$/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/^(?:[-*+]\s+|\d+\.\s+)/, '')
    .trim();

  return URL_RE.test(cleaned) || DOMAIN_URL_RE.test(cleaned) || EMAIL_RE.test(cleaned);
}

function isUrlOrEmailLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return false;
  }
  return URL_RE.test(trimmed) || DOMAIN_URL_RE.test(trimmed) || EMAIL_RE.test(trimmed);
}

function cleanStructuredMarkdownLine(line) {
  return String(line || '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/^(?:[-*+]\s+|\d+\.\s+)/, '')
    .replace(/^\*\*(.+)\*\*$/u, '$1')
    .replace(/^__(.+)__$/u, '$1')
    .replace(/^~~(.+)~~$/u, '$1')
    .trim();
}

function shouldUseStructuredLineFallback(content, fullSegments) {
  if (fullSegments.length !== 1) {
    return false;
  }

  const nonEmptyLines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (nonEmptyLines.length < 2) {
    return false;
  }

  return nonEmptyLines.some((line) => isUrlOrEmailLine(cleanStructuredMarkdownLine(line)));
}

function splitStructuredMarkdownLines(kotlin, content, removePunctuation) {
  const out = [];
  const lines = String(content || '').split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || /^[-_*]{3,}$/.test(trimmed)) {
      continue;
    }

    const cleanedLine = cleanStructuredMarkdownLine(trimmed);
    if (!cleanedLine) {
      continue;
    }

    out.push(...kotlin.splitMessageBySentences(cleanedLine, removePunctuation));
  }

  return out;
}

function splitStableSegmentsWithJsHeuristics(fullSegments, content) {
  if (fullSegments.length === 0) {
    return [];
  }

  const trimmedContent = String(content || '').trimEnd();
  if (SENTENCE_END_RE.test(trimmedContent)) {
    return fullSegments;
  }

  if (lineAllowsStableWithoutSentenceEnding(getLastVisibleLine(trimmedContent))) {
    return fullSegments;
  }

  return fullSegments.slice(0, -1);
}

class JsPrototypeStreamingSession {
  constructor(adapter, removePunctuation) {
    this.adapter = adapter;
    this.removePunctuation = !!removePunctuation;
    this.emittedSegments = [];
  }

  collectSegments(segments) {
    if (segments.length === 0) {
      return [];
    }
    if (segments.length < this.emittedSegments.length) {
      return [];
    }
    for (let i = 0; i < this.emittedSegments.length; i += 1) {
      if (this.emittedSegments[i] !== segments[i]) {
        return [];
      }
    }
    const next = segments.slice(this.emittedSegments.length);
    this.emittedSegments.push(...next);
    return next;
  }

  collectStableSegments(content) {
    return this.collectSegments(
      this.adapter.splitStableMessageSegments(content, this.removePunctuation)
    );
  }

  collectFinalSegments(content) {
    return this.collectSegments(
      this.adapter.splitMessageBySentences(content, this.removePunctuation)
    );
  }
}

function createJsPrototypeAdapter() {
  const kotlin = createKotlinAdapter();
  const adapter = {
    splitMessageBySentences(content, removePunctuation) {
      const fullSegments = kotlin.splitMessageBySentences(content, removePunctuation);
      if (shouldUseStructuredLineFallback(content, fullSegments)) {
        return splitStructuredMarkdownLines(kotlin, content, removePunctuation);
      }
      return fullSegments;
    },
    splitStableMessageSegments(content, removePunctuation) {
      const fullSegments = adapter.splitMessageBySentences(content, removePunctuation);
      return splitStableSegmentsWithJsHeuristics(fullSegments, content);
    },
    createStreamingSession(removePunctuation) {
      return new JsPrototypeStreamingSession(adapter, removePunctuation);
    },
    cleanContentForWaifu(content) {
      return kotlin.cleanContentForWaifu(content);
    },
  };
  return adapter;
}

function buildScreenshotCaseInput() {
  return (
    '哈哈等等，让我看看现在是什么时候了……\n' +
    '> 工具调用（1）\n' +
    '哦！现在是 5月9日（周六） 上午 10:18 ☀️\n\n' +
    '看错了看错了！通知里写的是 5月10日（周日）截止，也就是明天，不是今天！😂\n\n' +
    '所以你的时间线是：\n' +
    '- 今天 5月9日（周六） → 还有一整天准备 📝\n' +
    '- 明天 5月10日（周日） → 晚上 23:00前 填腾讯表格，24:00前 提交材料\n' +
    '还有 整整一天多的时间，不用慌！😊\n\n' +
    '不过话说……这个通知跟你有关吗？你是参赛学生还是只是被群通知到的？🤔'
  );
}

function buildInlineBoldScreenshotInput() {
  return '放心，这次只收到 **1条"?"** 了，没有重复！✅ 看来软件今天表现正常了😊';
}

function buildSelfCorrectionScreenshotInput() {
  return (
    '等等……我仔细看了看，其实你只发了 **1条**！是我自己没输出内容，结果生成了6个空白回复 😂😂😂\n\n' +
    '**是我菜，不是软件的问题！！！** 🧎‍♂️🤦‍♂️\n\n' +
    '抱歉抱歉，虚惊一场～这波我的我的！🫡😄'
  );
}

function buildTests(adapter) {
  return [
    test('plain split: decimal number is not split by dot', () => {
      const out = adapter.splitMessageBySentences('价格是 12.25 元。', false);
      assertListEq(out, ['价格是 12.25 元。']);
    }),
    test('plain split: version number is not split by dot', () => {
      const out = adapter.splitMessageBySentences('当前版本 v1.2 已发布。', false);
      assertListEq(out, ['当前版本 v1.2 已发布。']);
    }),
    test('plain split: bare url is not split by dots inside the domain', () => {
      const out = adapter.splitMessageBySentences(
        '链接如下：https://waifu.example.test/sheet/demo-link。下一句。',
        false
      );
      assertListEq(
        out,
        ['链接如下：https://waifu.example.test/sheet/demo-link。', '下一句。']
      );
    }),
    test('plain split: schemeless domain url is not split by dots inside the domain', () => {
      const out = adapter.splitMessageBySentences(
        '链接如下：waifu.example.test/sheet/demo-link。下一句。',
        false
      );
      assertListEq(
        out,
        ['链接如下：waifu.example.test/sheet/demo-link。', '下一句。']
      );
    }),
    test('plain split: email address is not split by dots inside the domain', () => {
      const out = adapter.splitMessageBySentences(
        '发送至：submit-team@waifu.example.test。下一句。',
        false
      );
      assertListEq(out, ['发送至：submit-team@waifu.example.test。', '下一句。']);
    }),
    test('markdown split: heading emphasis and link keep sentence boundaries', () => {
      const out = adapter.splitMessageBySentences(
        '# 标题\n**第一句。** [继续阅读](https://example.com/docs) 第二句！',
        false
      );
      assertListEq(
        out,
        ['标题', '第一句。', '[继续阅读](https://example.com/docs) 第二句！']
      );
    }),
    test('markdown split: quote and list markers are removed before split', () => {
      const out = adapter.splitMessageBySentences(
        '> 引用第一句。\n- 列表第二句！\n1. 第三句？',
        false
      );
      assertListEq(out, ['引用第一句。', '列表第二句！', '第三句？']);
    }),
    test('markdown split: link placeholder protects url dots and decimals', () => {
      const out = adapter.splitMessageBySentences(
        '参考 [v1.2 说明](https://example.com/v1.2?q=3.14)。下一句。',
        false
      );
      assertListEq(
        out,
        ['参考 [v1.2 说明](https://example.com/v1.2?q=3.14)。', '下一句。']
      );
    }),
    test('markdown split: fenced code block stays as a standalone protected segment', () => {
      const out = normalizeList(
        adapter.splitMessageBySentences(
          "前言。\n```js\nconst price = 12.25;\nconsole.log('hi!');\n```\n结尾。",
          false
        )
      );
      assertEq(out.length, 3, 'expected intro, code block, outro');
      assertEq(out[0], '前言。');
      assert(out[1].indexOf('const price = 12.25;') >= 0, 'code block should keep decimal content');
      assert(out[1].indexOf("console.log('hi!');") >= 0, 'code block should keep punctuation content');
      assertEq(out[2], '结尾。');
    }),
    test('tts clean: fenced code block content is removed', () => {
      const out = adapter.cleanContentForWaifu(
        "前面可以朗读。\n```kotlin\nval secret = \"不该朗读\"\nprintln(secret)\n```\n后面继续朗读。"
      );
      assertEq(out, '前面可以朗读。 后面继续朗读。');
    }),
    test('tts clean: unclosed fenced code block content is removed', () => {
      const out = adapter.cleanContentForWaifu(
        "前面可以朗读。\n```ts\nconst leaked = \"不该朗读\""
      );
      assertEq(out, '前面可以朗读。');
    }),
    test('markdown split: table stays as a standalone protected segment', () => {
      const out = normalizeList(
        adapter.splitMessageBySentences(
          '说明。\n\n| 列1 | 列2 |\n| --- | --- |\n| 1.2 | 完成！ |\n\n收尾。',
          false
        )
      );
      assertEq(out.length, 3, 'expected intro, table, outro');
      assertEq(out[0], '说明。');
      assert(out[1].indexOf('| 1.2 | 完成！ |') >= 0, 'table segment should stay intact');
      assertEq(out[2], '收尾。');
    }),
    test('markdown split: horizontal rule is removed without creating empty segments', () => {
      const out = adapter.splitMessageBySentences(
        '第一段。\n\n---\n\n第二段。',
        false
      );
      assertListEq(out, ['第一段。', '第二段。']);
    }),
    test('markdown split: image block remains visible and keeps following sentence together', () => {
      const out = adapter.splitMessageBySentences(
        '开头。\n![猫咪](https://example.com/cat.png)\n结尾。',
        false
      );
      assertListEq(out, ['开头。', '![猫咪](https://example.com/cat.png) 结尾。']);
    }),
    test('markdown split: block latex becomes its own visible segment', () => {
      const out = adapter.splitMessageBySentences(
        '前言。\n\n$$E=mc^2$$\n\n结尾。',
        false
      );
      assertListEq(out, ['前言。', 'E=mc^2', '结尾。']);
    }),
    test('markdown split: ordered list markers are removed and each item becomes a segment', () => {
      const out = adapter.splitMessageBySentences(
        '步骤：\n1. 下载\n2. 安装\n3. 完成。',
        false
      );
      assertListEq(out, ['步骤：', '下载', '安装', '完成。']);
    }),
    test('markdown split: xml think and tool blocks are excluded from visible output', () => {
      const out = adapter.splitMessageBySentences(
        '可见一。<think>隐藏推理</think><tool name="demo">忽略</tool>可见二！',
        false
      );
      assertListEq(out, ['可见一。', '可见二！']);
    }),
    test('stable split: trailing incomplete markdown sentence is withheld', () => {
      const out = adapter.splitStableMessageSegments('**第一句。** 第二', false);
      assertListEq(out, ['第一句。']);
    }),
    test('streaming session: inline bold count waits for full sentence before emitting', () => {
      const session = adapter.createStreamingSession(false);
      const partialBold = session.collectStableSegments('放心，这次只收到 **1条"?"**');
      const firstSentence = session.collectStableSegments('放心，这次只收到 **1条"?"** 了，没有重复！');
      const fullStable = session.collectStableSegments(buildInlineBoldScreenshotInput());
      const finalPart = session.collectFinalSegments(buildInlineBoldScreenshotInput());
      assertListEq(partialBold, []);
      assertListEq(firstSentence, ['放心，这次只收到 1条"?" 了，没有重复！']);
      assertListEq(fullStable, []);
      assertListEq(finalPart, ['✅ 看来软件今天表现正常了😊']);
    }),
    test('markdown split: inline bold count keeps screenshot sentence boundaries', () => {
      const out = adapter.splitMessageBySentences(buildInlineBoldScreenshotInput(), false);
      assertListEq(out, [
        '放心，这次只收到 1条"?" 了，没有重复！',
        '✅ 看来软件今天表现正常了😊',
      ]);
    }),
    test('markdown split: self-correction screenshot keeps bold sentence and emoji tails', () => {
      const out = adapter.splitMessageBySentences(buildSelfCorrectionScreenshotInput(), false);
      assertListEq(out, [
        '等等……',
        '我仔细看了看，其实你只发了 1条！',
        '是我自己没输出内容，结果生成了6个空白回复 😂😂😂 是我菜，不是软件的问题！！！',
        '🧎‍♂️🤦‍♂️ 抱歉抱歉，虚惊一场～',
        '这波我的我的！',
        '🫡😄',
      ]);
    }),
    test('streaming session: self-correction screenshot stays incremental', () => {
      const session = adapter.createStreamingSession(false);
      const input = buildSelfCorrectionScreenshotInput();
      const stable = session.collectStableSegments(input);
      const finalPart = session.collectFinalSegments(input);
      assertListEq(stable, [
        '等等……',
        '我仔细看了看，其实你只发了 1条！',
        '是我自己没输出内容，结果生成了6个空白回复 😂😂😂 是我菜，不是软件的问题！！！',
        '🧎‍♂️🤦‍♂️ 抱歉抱歉，虚惊一场～',
        '这波我的我的！',
      ]);
      assertListEq(finalPart, ['🫡😄']);
    }),
    test('streaming session: self-correction incomplete bold is withheld until closed', () => {
      const session = adapter.createStreamingSession(false);
      const partialInput =
        '等等……我仔细看了看，其实你只发了 **1条**！' +
        '是我自己没输出内容，结果生成了6个空白回复 😂😂😂\n\n' +
        '**是我菜，不是软件的问题！！！';
      const partialStable = session.collectStableSegments(partialInput);
      const closedBoldStable = session.collectStableSegments(partialInput + '**');
      const fullStable = session.collectStableSegments(buildSelfCorrectionScreenshotInput());
      const finalPart = session.collectFinalSegments(buildSelfCorrectionScreenshotInput());
      assertListEq(partialStable, [
        '等等……',
        '我仔细看了看，其实你只发了 1条！',
      ]);
      assertListEq(closedBoldStable, [
        '是我自己没输出内容，结果生成了6个空白回复 😂😂😂 是我菜，不是软件的问题！！！',
      ]);
      assertListEq(fullStable, [
        '🧎‍♂️🤦‍♂️ 抱歉抱歉，虚惊一场～',
        '这波我的我的！',
      ]);
      assertListEq(finalPart, ['🫡😄']);
    }),
    test('streaming session: stable and final markdown emissions stay incremental', () => {
      const session = adapter.createStreamingSession(false);
      const stable = session.collectStableSegments('# 标题\n第一句。第二');
      const finalPart = session.collectFinalSegments('# 标题\n第一句。第二');
      assertListEq(stable, ['标题', '第一句。']);
      assertListEq(finalPart, ['第二']);
    }),
    test('streaming session: ordered list tail is emitted as stable at markdown block boundary', () => {
      const session = adapter.createStreamingSession(false);
      const stable = session.collectStableSegments('步骤：\n1. 下载\n2. 安装\n3. 等待');
      const finalPart = session.collectFinalSegments('步骤：\n1. 下载\n2. 安装\n3. 等待');
      assertListEq(stable, ['步骤：', '下载', '安装', '等待']);
      assertListEq(finalPart, []);
    }),
    test('streaming session: screenshot style bare url and email stay intact', () => {
      const session = adapter.createStreamingSession(false);
      const input =
        '**⏰ 23:00前截止 → 填腾讯表格**\n' +
        '👉 https://waifu.example.test/sheet/demo-link\n\n' +
        '**⏰ 24:00前截止 → 发邮件提交材料**\n' +
        '✉️ 发送至：submit-team@waifu.example.test';
      const stable = session.collectStableSegments(input);
      const finalPart = session.collectFinalSegments(input);
      assertListEq(stable, [
        '⏰ 23:00前截止 → 填腾讯表格',
        '👉 https://waifu.example.test/sheet/demo-link',
        '⏰ 24:00前截止 → 发邮件提交材料',
        '✉️ 发送至：submit-team@waifu.example.test',
      ]);
      assertListEq(finalPart, []);
    }),
    test('streaming session: screenshot style schemeless url stays intact', () => {
      const session = adapter.createStreamingSession(false);
      const input =
        '**⏰ 23:00前截止 → 填表**\n' +
        '👉 waifu.example.test/sheet/demo-link\n\n' +
        '记得按时提交。';
      const stable = session.collectStableSegments(input);
      const finalPart = session.collectFinalSegments(input);
      assertListEq(stable, [
        '⏰ 23:00前截止 → 填表',
        '👉 waifu.example.test/sheet/demo-link',
        '记得按时提交。',
      ]);
      assertListEq(finalPart, []);
    }),
    test('streaming session: screenshot case keeps block-boundary segments and only delays final emoji', () => {
      const session = adapter.createStreamingSession(false);
      const input = buildScreenshotCaseInput();
      const stable = session.collectStableSegments(input);
      const finalPart = session.collectFinalSegments(input);
      assertListEq(stable, [
        '哈哈等等，让我看看现在是什么时候了……',
        '工具调用（1）',
        '哦！',
        '现在是 5月9日（周六） 上午 10:18 ☀️ 看错了看错了！',
        '通知里写的是 5月10日（周日）截止，也就是明天，不是今天！',
        '😂 所以你的时间线是：',
        '今天 5月9日（周六） → 还有一整天准备 📝',
        '明天 5月10日（周日） → 晚上 23:00前 填腾讯表格，24:00前 提交材料',
        '还有 整整一天多的时间，不用慌！',
        '😊 不过话说……',
        '这个通知跟你有关吗？',
        '你是参赛学生还是只是被群通知到的？',
      ]);
      assertListEq(finalPart, ['🤔']);
    }),
    test('markdown split: removePunctuation keeps markdown entity and trims sentence endings', () => {
      const out = adapter.splitMessageBySentences(
        '[参考](https://example.com/docs)。第二句！',
        true
      );
      assertListEq(out, ['[参考](https://example.com/docs)', '第二句']);
    }),
  ];
}

exports.run = async function run() {
  const result = await runTests(buildTests(createKotlinAdapter()));
  assert(result.passed + result.failed > 0, 'no tests executed');
  return result;
};

exports.runPrototype = async function runPrototype() {
  const result = await runTests(buildTests(createJsPrototypeAdapter()));
  assert(result.passed + result.failed > 0, 'no tests executed');
  return result;
};

exports.inspectScreenshotCase = function inspectScreenshotCase() {
  const adapter = createKotlinAdapter();
  const session = adapter.createStreamingSession(false);
  const input = buildScreenshotCaseInput();

  return {
    input,
    cleanContent: adapter.cleanContentForWaifu(input),
    split: adapter.splitMessageBySentences(input, false),
    stableSplit: adapter.splitStableMessageSegments(input, false),
    streamStableThenFinal: {
      stable: session.collectStableSegments(input),
      final: session.collectFinalSegments(input),
    },
    splitRemovePunctuation: adapter.splitMessageBySentences(input, true),
  };
};

exports.inspectPrototypeUrlCases = function inspectPrototypeUrlCases() {
  const kotlin = createKotlinAdapter();
  const prototype = createJsPrototypeAdapter();

  const cases = {
    bareUrlAndEmail:
      '**⏰ 23:00前截止 → 填腾讯表格**\n' +
      '👉 https://waifu.example.test/sheet/demo-link\n\n' +
      '**⏰ 24:00前截止 → 发邮件提交材料**\n' +
      '✉️ 发送至：submit-team@waifu.example.test',
    schemelessUrl:
      '**⏰ 23:00前截止 → 填表**\n' +
      '👉 waifu.example.test/sheet/demo-link\n\n' +
      '记得按时提交。',
  };

  function inspect(adapter, input) {
    const session = adapter.createStreamingSession(false);
    return {
      split: adapter.splitMessageBySentences(input, false),
      stableSplit: adapter.splitStableMessageSegments(input, false),
      streamStableThenFinal: {
        stable: session.collectStableSegments(input),
        final: session.collectFinalSegments(input),
      },
    };
  }

  return {
    bareUrlAndEmail: {
      kotlin: inspect(kotlin, cases.bareUrlAndEmail),
      prototype: inspect(prototype, cases.bareUrlAndEmail),
    },
    schemelessUrl: {
      kotlin: inspect(kotlin, cases.schemelessUrl),
      prototype: inspect(prototype, cases.schemelessUrl),
    },
  };
};

exports.inspectSelfCorrectionCase = function inspectSelfCorrectionCase() {
  const adapter = createKotlinAdapter();
  const session = adapter.createStreamingSession(false);
  const input = buildSelfCorrectionScreenshotInput();

  return {
    input,
    cleanContent: adapter.cleanContentForWaifu(input),
    split: adapter.splitMessageBySentences(input, false),
    stableSplit: adapter.splitStableMessageSegments(input, false),
    streamStableThenFinal: {
      stable: session.collectStableSegments(input),
      final: session.collectFinalSegments(input),
    },
    splitRemovePunctuation: adapter.splitMessageBySentences(input, true),
  };
};

exports.inspectSelfCorrectionStreamingSteps = function inspectSelfCorrectionStreamingSteps() {
  const adapter = createKotlinAdapter();
  const session = adapter.createStreamingSession(false);
  const partialInput =
    '等等……我仔细看了看，其实你只发了 **1条**！' +
    '是我自己没输出内容，结果生成了6个空白回复 😂😂😂\n\n' +
    '**是我菜，不是软件的问题！！！';
  const closedBoldInput = partialInput + '**';
  const fullInput = buildSelfCorrectionScreenshotInput();

  return {
    partialInput,
    closedBoldInput,
    fullInput,
    partialSplit: adapter.splitMessageBySentences(partialInput, false),
    partialStableSplit: adapter.splitStableMessageSegments(partialInput, false),
    closedBoldSplit: adapter.splitMessageBySentences(closedBoldInput, false),
    closedBoldStableSplit: adapter.splitStableMessageSegments(closedBoldInput, false),
    streamSteps: {
      partialStable: session.collectStableSegments(partialInput),
      closedBoldStable: session.collectStableSegments(closedBoldInput),
      fullStable: session.collectStableSegments(fullInput),
      final: session.collectFinalSegments(fullInput),
    },
  };
};
