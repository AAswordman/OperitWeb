'use strict';

const { assert, assertEq, test, runTests } = require('../../../../../../../../lib/harness');

const File = Java.type('java.io.File');
const Thread = Java.type('java.lang.Thread');
const StringBuilder = Java.type('java.lang.StringBuilder');
const ArrayList = Java.type('java.util.ArrayList');
const JSONObject = Java.type('org.json.JSONObject');
const JSONArray = Java.type('org.json.JSONArray');
const Integer = Java.java.lang.Integer;
const MathClass = Java.java.lang.Math;
const ArraysClass = Java.java.util.Arrays;
const Charset = Java.java.nio.charset.Charset;
const MapEntry = Java.java.util.Map.Entry;

function makeFile(path) {
  return new File(String(path));
}

function makeStringList(items) {
  const list = new ArrayList();
  for (const item of items) {
    list.add(String(item));
  }
  return list;
}

function makeRunnable(impl) {
  return Java.implement('java.lang.Runnable', impl);
}

function assertArray(value, message) {
  assert(Array.isArray(value), message || 'expected JS array');
}

function assertPlainObject(value, message) {
  assert(value && typeof value === 'object' && !Array.isArray(value), message || 'expected plain object');
}

function parseBridgeJson(raw, label) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch (e) {
    throw new Error((label || 'bridge JSON') + ' parse failed: ' + e);
  }
  assert(parsed && typeof parsed === 'object', (label || 'bridge JSON') + ' should parse to object');
  return parsed;
}

function expectBridgeSuccess(raw, label) {
  const parsed = parseBridgeJson(raw, label);
  assert(parsed.success === true, (label || 'bridge call') + ' failed: ' + String(parsed.error || 'unknown error'));
  return parsed.data;
}

function capture(label, fn) {
  try {
    return {
      ok: true,
      label,
      value: fn(),
    };
  } catch (e) {
    return {
      ok: false,
      label,
      error: String(e && e.stack ? e.stack : e),
    };
  }
}

async function captureAsync(label, fn) {
  try {
    return {
      ok: true,
      label,
      value: await fn(),
    };
  } catch (e) {
    return {
      ok: false,
      label,
      error: String(e && e.stack ? e.stack : e),
    };
  }
}

function makeCyclicObject() {
  const root = { label: 'root' };
  root.self = root;
  root.child = { label: 'child', parent: root };
  return root;
}

function makeBigIntPayload() {
  return {
    id: 9007199254740993123456789n,
    nested: {
      count: 2n,
    },
  };
}

function runThreadAndJoin(runnableLike) {
  const worker = new Thread(runnableLike);
  worker.start();
  worker.join(2000);
}

async function sleepViaToolCall(ms) {
  return toolCall('sleep', { duration_ms: ms });
}

async function sleepViaToolCallWithType(ms) {
  return toolCall('default', 'sleep', { duration_ms: ms });
}

async function sleepViaToolCallConfig(ms) {
  return toolCall({
    name: 'sleep',
    params: { duration_ms: ms },
  });
}

function extractReportedSleepMs(result) {
  if (result && typeof result === 'object') {
    if (result.requestedMs != null) {
      return Number(result.requestedMs);
    }
    if (result.sleptMs != null) {
      return Number(result.sleptMs);
    }
  }

  const text = String(result);
  const match = text.match(/Slept for (\d+)ms/);
  return match ? Number(match[1]) : null;
}

async function measureSleepBatch(mode, count, ms) {
  const start = Date.now();
  const tasks = [];
  const startMarks = [];

  function createTask(index) {
    return (async function task() {
      startMarks.push({
        index,
        startedAtMs: Date.now() - start,
      });

      let result;
      if (mode === 'toolCall') {
        result = await sleepViaToolCall(ms);
      } else if (mode === 'tools') {
        result = await Tools.System.sleep(ms);
      } else {
        throw new Error('unknown sleep batch mode: ' + mode);
      }

      return {
        index,
        finishedAtMs: Date.now() - start,
        reportedMs: extractReportedSleepMs(result),
      };
    }());
  }

  for (let i = 0; i < count; i += 1) {
    tasks.push(createTask(i));
  }

  const results = await Promise.all(tasks);
  const totalMs = Date.now() - start;
  const serialThresholdMs = Math.max(ms * count - 60, ms);

  return {
    mode,
    count,
    requestedMs: ms,
    totalMs,
    serialThresholdMs,
    classification: totalMs >= serialThresholdMs ? 'serialish' : 'overlap',
    startMarks,
    results,
  };
}

async function measureSequentialSleep(mode, count, ms) {
  const start = Date.now();
  const results = [];

  for (let i = 0; i < count; i += 1) {
    let result;
    if (mode === 'toolCall') {
      result = await sleepViaToolCall(ms);
    } else if (mode === 'tools') {
      result = await Tools.System.sleep(ms);
    } else {
      throw new Error('unknown sequential sleep mode: ' + mode);
    }
    results.push({
      index: i,
      reportedMs: extractReportedSleepMs(result),
      finishedAtMs: Date.now() - start,
    });
  }

  return {
    mode,
    count,
    requestedMs: ms,
    totalMs: Date.now() - start,
    results,
  };
}

function buildSpecTests() {
  return [
    test('instance method syntax sugar works for java.io.File', () => {
      const file = makeFile('/sdcard/demo.txt');
      assertEq(String(file.getName()), 'demo.txt');
      assertEq(String(file.name), 'demo.txt');
    }),
    test('instance method syntax sugar matches explicit call', () => {
      const file = makeFile('/sdcard/alpha/beta.txt');
      assertEq(String(file.getName()), String(file.call('getName')));
      assertEq(String(file.getAbsolutePath()), String(file.call('getAbsolutePath')));
    }),
    test('class proxy constructor sugar works with direct call', () => {
      const file = File('/sdcard/direct-call.txt');
      assertEq(String(file.getName()), 'direct-call.txt');
    }),
    test('class proxy constructor sugar works with new', () => {
      const file = new File('/sdcard/new-call.txt');
      assertEq(String(file.getName()), 'new-call.txt');
    }),
    test('class proxy constructor sugar works with newInstance', () => {
      const file = File.newInstance('/sdcard/new-instance.txt');
      assertEq(String(file.getName()), 'new-instance.txt');
    }),
    test('package-chain class access works for constructors', () => {
      const PkgFile = Java.java.io.File;
      const file = new PkgFile('/sdcard/package-chain.txt');
      assertEq(String(file.getName()), 'package-chain.txt');
    }),
    test('Java.package helper resolves package proxies', () => {
      const pkg = Java.package('java.lang');
      assertEq(String(pkg.path), 'java.lang');
      assertEq(String(pkg.StringBuilder.className), 'java.lang.StringBuilder');
    }),
    test('static field syntax sugar works through package proxy', () => {
      assertEq(Number(Integer.MAX_VALUE), 2147483647);
    }),
    test('static method syntax sugar works through package proxy', () => {
      assertEq(Number(Integer.parseInt('123')), 123);
      assertEq(Number(MathClass.max(7, 11)), 11);
    }),
    test('package-chain static call syntax sugar works', () => {
      const now = Number(Java.java.lang.System.currentTimeMillis());
      assert(now > 0, 'System.currentTimeMillis() should be positive');
    }),
    test('Android nested class static field syntax sugar works', () => {
      const sdkInt = Number(Java.android.os.Build.VERSION.SDK_INT);
      assert(sdkInt > 0, 'SDK_INT should be positive');
    }),
    test('static method syntax sugar matches explicit callStatic', () => {
      assertEq(Number(Integer.parseInt('456')), Number(Integer.callStatic('parseInt', '456')));
      assertEq(Number(MathClass.max(2, 9)), Number(Java.callStatic('java.lang.Math', 'max', 2, 9)));
    }),
    test('nested class syntax sugar works', () => {
      const utf8 = Charset.forName('UTF-8');
      const defaultCharset = Charset.defaultCharset();
      assertEq(String(utf8.name()), 'UTF-8');
      assert(String(MapEntry.className).indexOf('java.util.Map$Entry') >= 0, 'nested class name mismatch');
      assert(String(defaultCharset.name()).length > 0, 'default charset name should not be empty');
    }),
    test('getter property sugar works on java.io.File', () => {
      const file = makeFile('/sdcard/property-name.txt');
      assertEq(String(file.absolutePath), String(file.getAbsolutePath()));
      assertEq(String(file.parent), '/sdcard');
    }),
    test('StringBuilder chaining works through syntax sugar', () => {
      const builder = new StringBuilder();
      const result = builder.append('he').append('llo').toString();
      assertEq(String(result), 'hello');
    }),
    test('StringBuilder direct-call constructor sugar works', () => {
      const builder = StringBuilder();
      const text = builder.append('a').append('b').append('c').toString();
      assertEq(String(text), 'abc');
    }),
    test('StringBuilder newInstance constructor sugar works', () => {
      const builder = StringBuilder.newInstance();
      const text = builder.append('x').append('y').append('z').toString();
      assertEq(String(text), 'xyz');
    }),
    test('Java.use alias resolves the same class proxy', () => {
      const FileViaUse = Java.use('java.io.File');
      const file = new FileViaUse('/sdcard/use-alias.txt');
      assertEq(String(file.getName()), 'use-alias.txt');
      assertEq(String(FileViaUse.className), 'java.io.File');
    }),
    test('Java.importClass alias resolves the same class proxy', () => {
      const FileViaImport = Java.importClass('java.io.File');
      const file = FileViaImport('/sdcard/import-alias.txt');
      assertEq(String(file.getName()), 'import-alias.txt');
      assertEq(String(FileViaImport.className), 'java.io.File');
    }),
    test('Java.implement Runnable runs in Thread constructor position', () => {
      let count = 0;
      const runnable = makeRunnable({
        run: function () {
          count += 1;
        },
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('Java.implement SAM shorthand works in interface position', () => {
      let count = 0;
      const runnable = Java.implement(function () {
        count += 1;
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('object literal auto-adapts to Runnable interface', () => {
      let count = 0;
      runThreadAndJoin({
        run: function () {
          count += 1;
        },
      });
      assertEq(count, 1);
    }),
    test('interface class proxy call syntax sugar creates implementation', () => {
      let count = 0;
      const Runnable = Java.java.lang.Runnable;
      const runnable = Runnable({
        run: function () {
          count += 1;
        },
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('Java collection proxy still exposes method sugar', () => {
      const list = makeStringList(['a', 'b', 'c']);
      assertEq(Number(list.size()), 3);
      assertEq(String(list.get(1)), 'b');
    }),
    test('ArrayList constructor sugar works with direct call', () => {
      const list = ArrayList();
      list.add('left');
      list.add('right');
      assertEq(Number(list.size()), 2);
      assertEq(String(list.get(0)), 'left');
    }),
    test('ArrayList constructor sugar works with new', () => {
      const list = new ArrayList();
      list.add('first');
      assertEq(Number(list.size()), 1);
      assertEq(String(list.get(0)), 'first');
    }),
    test('class metadata stays available on proxies', () => {
      assertEq(String(File.className), 'java.io.File');
      assertEq(String(ArrayList.className), 'java.util.ArrayList');
      assertEq(String(StringBuilder.className), 'java.lang.StringBuilder');
    }),
    test('classExists API agrees for existing and missing classes', () => {
      assertEq(Java.classExists('java.lang.String'), true);
      assertEq(Java.classExists('com.example.DoesNotExist'), false);
      assertEq(StringBuilder.exists(), true);
    }),
  ];
}

function buildConversionTests() {
  return [
    test('top-level Java.newInstance creates Java proxy', () => {
      const file = Java.newInstance('java.io.File', '/sdcard/top-level-new-instance.txt');
      assertEq(String(file.getName()), 'top-level-new-instance.txt');
      assertEq(String(file.className), 'java.io.File');
    }),
    test('top-level Java.callStatic matches class proxy static call', () => {
      assertEq(Number(Java.callStatic('java.lang.Integer', 'parseInt', '321')), 321);
      assertEq(Number(Java.callStatic('java.lang.Math', 'max', 4, 12)), 12);
    }),
    test('application context is exposed as Java proxy', () => {
      const context = Java.getApplicationContext();
      assert(String(context.className).length > 0, 'application context className should not be empty');
      assertEq(String(context.getPackageName()), 'com.ai.assistance.operit');
    }),
    test('NativeInterface javaClassExists matches high-level bridge', () => {
      assertEq(String(NativeInterface.javaClassExists('java.lang.String')), 'true');
      assertEq(String(NativeInterface.javaClassExists('com.example.DoesNotExist')), 'false');
      assertEq(Java.classExists('java.lang.String'), true);
    }),
    test('NativeInterface javaCallStatic returns parseable bridge JSON', () => {
      const data = expectBridgeSuccess(
        NativeInterface.javaCallStatic('java.lang.Integer', 'parseInt', '["42"]'),
        'javaCallStatic(parseInt)'
      );
      assertEq(Number(data), 42);
    }),
    test('NativeInterface javaNewInstance plus javaCallInstance work together', () => {
      const instance = expectBridgeSuccess(
        NativeInterface.javaNewInstance('java.io.File', '["/sdcard/raw-file.txt"]'),
        'javaNewInstance(File)'
      );
      assertEq(String(instance.__javaClass), 'java.io.File');
      const name = expectBridgeSuccess(
        NativeInterface.javaCallInstance(String(instance.__javaHandle), 'getName', '[]'),
        'javaCallInstance(getName)'
      );
      assertEq(String(name), 'raw-file.txt');
    }),
    test('NativeInterface javaGetStaticField returns raw static field value', () => {
      const maxValue = expectBridgeSuccess(
        NativeInterface.javaGetStaticField('java.lang.Integer', 'MAX_VALUE'),
        'javaGetStaticField(MAX_VALUE)'
      );
      assertEq(Number(maxValue), 2147483647);
    }),
    test('Map results normalize to plain JS objects', () => {
      const mapObject = Java.callStatic('java.util.Collections', 'singletonMap', 'alpha', 1);
      assertPlainObject(mapObject, 'JSONObject.toMap() should return a plain object');
      assertEq(Number(mapObject.alpha), 1);
    }),
    test('List results normalize to JS arrays', () => {
      const listValue = Java.callStatic('java.util.Arrays', 'asList', 'a', 'b', 'c');
      assertArray(listValue, 'Arrays.asList should return a JS array after crossing to JS');
      assertEq(listValue.length, 3);
      assertEq(String(listValue[1]), 'b');
    }),
    test('Class return values normalize to strings', () => {
      const classValue = makeFile('/sdcard/class-value.txt').getClass();
      assertEq(typeof classValue, 'string');
      assertEq(String(classValue), 'java.io.File');
    }),
    test('Enum return values normalize to strings', () => {
      const stateValue = Thread.currentThread().getState();
      assertEq(typeof stateValue, 'string');
      assert(String(stateValue).length > 0, 'thread state should not be empty');
    }),
    test('plain object adapts to JSONObject constructor input', () => {
      const json = new JSONObject({
        alpha: 1,
        enabled: true,
        name: 'bridge',
      });
      assertEq(Number(json.getInt('alpha')), 1);
      assertEq(Boolean(json.getBoolean('enabled')), true);
      assertEq(String(json.getString('name')), 'bridge');
    }),
    test('JS array adapts to JSONArray constructor input', () => {
      const array = new JSONArray(['left', 'right']);
      assertEq(Number(array.length()), 2);
      assertEq(String(array.getString(0)), 'left');
      assertEq(String(array.getString(1)), 'right');
    }),
    test('JS array expands into Java varargs and returns normalized array', () => {
      const values = ArraysClass.asList(['x', 'y', 'z']);
      assertArray(values, 'Arrays.asList should return a normalized JS array');
      assertEq(values.length, 3);
      assertEq(String(values[2]), 'z');
    }),
  ];
}

function buildHostInteropTests() {
  return [
    test('Tools.System.sleep returns requested and slept milliseconds', async () => {
      const result = await Tools.System.sleep(30);
      assertEq(Number(result.requestedMs), 30);
      assertEq(Number(result.sleptMs), 30);
      assertEq(String(result), 'Slept for 30ms');
    }),
    test('toolCall one-argument form works for sleep', async () => {
      const result = await sleepViaToolCall(25);
      assertEq(Number(result.requestedMs), 25);
      assertEq(Number(result.sleptMs), 25);
    }),
    test('toolCall explicit tool type form works for sleep', async () => {
      const result = await sleepViaToolCallWithType(20);
      assertEq(Number(result.requestedMs), 20);
      assertEq(Number(result.sleptMs), 20);
    }),
    test('toolCall object config form works for sleep', async () => {
      const result = await sleepViaToolCallConfig(15);
      assertEq(Number(result.requestedMs), 15);
      assertEq(Number(result.sleptMs), 15);
    }),
    test('toolCall options object does not break promise resolution', async () => {
      let intermediateCount = 0;
      const result = await toolCall('sleep', { duration_ms: 10 }, {
        onIntermediateResult: function () {
          intermediateCount += 1;
        },
      });
      assertEq(Number(result.requestedMs), 10);
      assertEq(Number(result.sleptMs), 10);
      assertEq(intermediateCount, 0);
    }),
    test('NativeInterface.callTool synchronous path returns result JSON', () => {
      const raw = NativeInterface.callTool('default', 'sleep', '{"duration_ms":5}');
      const parsed = parseBridgeJson(raw, 'NativeInterface.callTool(sleep)');
      assertEq(parsed.success, true);
      assertEq(Number(parsed.data.requestedMs), 5);
      assertEq(Number(parsed.data.sleptMs), 5);
    }),
    test('Promise.all over toolCall sleep returns all results with timing profile', async () => {
      const measurement = await measureSleepBatch('toolCall', 3, 40);
      assertEq(measurement.results.length, 3);
      assert(measurement.totalMs >= 35, 'parallel sleep total should be at least one sleep duration');
      assert(['serialish', 'overlap'].indexOf(measurement.classification) >= 0, 'unexpected classification');
    }),
    test('Promise.all over Tools.System.sleep returns all results with timing profile', async () => {
      const measurement = await measureSleepBatch('tools', 3, 35);
      assertEq(measurement.results.length, 3);
      assert(measurement.totalMs >= 30, 'parallel Tools.System.sleep total should be at least one sleep duration');
      assert(['serialish', 'overlap'].indexOf(measurement.classification) >= 0, 'unexpected classification');
    }),
  ];
}

function buildExploratoryTests() {
  return [
    test('Java.implement Runnable keeps closure values visible inside callback', () => {
      let observed = '';
      const suffix = 'value-from-closure';
      const runnable = makeRunnable({
        run: function () {
          observed = suffix;
        },
      });
      runThreadAndJoin(runnable);
      assertEq(observed, suffix);
    }),
    test('bare function auto-adapts to Runnable interface', () => {
      let count = 0;
      runThreadAndJoin(function () {
        count += 1;
      });
      assertEq(count, 1);
    }),
    test('Java.type inside callback still works', () => {
      let observed = '';
      runThreadAndJoin(makeRunnable({
        run: function () {
          const CallbackFile = Java.type('java.io.File');
          const callbackFile = new CallbackFile('/sdcard/callback.txt');
          observed = String(callbackFile.getName());
        },
      }));
      assertEq(observed, 'callback.txt');
    }),
  ];
}

function summarizeSuites(suites) {
  const summary = {
    success: true,
    passed: 0,
    failed: 0,
    durationMs: 0,
    failures: [],
    suites: [],
  };

  for (const suite of suites) {
    const name = suite.name;
    const result = suite.result;
    summary.success = summary.success && result.success;
    summary.passed += result.passed;
    summary.failed += result.failed;
    summary.durationMs += result.durationMs;
    summary.suites.push({
      name,
      success: result.success,
      passed: result.passed,
      failed: result.failed,
      durationMs: result.durationMs,
      failures: result.failures,
    });
    for (const failure of result.failures) {
      summary.failures.push({
        name: name + ' :: ' + failure.name,
        error: failure.error,
      });
    }
  }

  return summary;
}

async function runSuite(tests) {
  const result = await runTests(tests);
  assert(result.passed + result.failed > 0, 'no tests executed');
  return result;
}

exports.runSpec = async function runSpec() {
  return runSuite(buildSpecTests());
};

exports.runConversion = async function runConversion() {
  return runSuite(buildConversionTests());
};

exports.runHostInterop = async function runHostInterop() {
  return runSuite(buildHostInteropTests());
};

exports.runExploratory = async function runExploratory() {
  return runSuite(buildExploratoryTests());
};

exports.run = async function run() {
  const spec = await exports.runSpec();
  const conversion = await exports.runConversion();
  const hostInterop = await exports.runHostInterop();
  const exploratory = await exports.runExploratory();
  const result = summarizeSuites([
    { name: 'spec', result: spec },
    { name: 'conversion', result: conversion },
    { name: 'host_interop', result: hostInterop },
    { name: 'exploratory', result: exploratory },
  ]);
  assert(result.passed + result.failed > 0, 'no tests executed');
  return result;
};

exports.measureToolCallSleepConcurrency = async function measureToolCallSleepConcurrency() {
  const parallel = await measureSleepBatch('toolCall', 3, 150);
  const sequential = await measureSequentialSleep('toolCall', 3, 150);
  return {
    mode: 'toolCall',
    parallel,
    sequential,
  };
};

exports.measureToolsSleepConcurrency = async function measureToolsSleepConcurrency() {
  const parallel = await measureSleepBatch('tools', 3, 150);
  const sequential = await measureSequentialSleep('tools', 3, 150);
  return {
    mode: 'tools',
    parallel,
    sequential,
  };
};

exports.inspectHostApiShapes = async function inspectHostApiShapes() {
  return {
    toolsSleep: await captureAsync('Tools.System.sleep', async function () {
      return Tools.System.sleep(12);
    }),
    toolCallOneArg: await captureAsync('toolCall(name, params)', async function () {
      return sleepViaToolCall(12);
    }),
    toolCallWithType: await captureAsync('toolCall(type, name, params)', async function () {
      return sleepViaToolCallWithType(12);
    }),
    toolCallConfig: await captureAsync('toolCall(config)', async function () {
      return sleepViaToolCallConfig(12);
    }),
    nativeCallTool: capture('NativeInterface.callTool', function () {
      return parseBridgeJson(
        NativeInterface.callTool('default', 'sleep', '{"duration_ms":12}'),
        'NativeInterface.callTool(sleep)'
      );
    }),
  };
};

exports.inspectConversionShapes = function inspectConversionShapes() {
  return {
    highLevelClassExists: {
      string: Java.classExists('java.lang.String'),
      missing: Java.classExists('com.example.DoesNotExist'),
      proxy: StringBuilder.exists(),
    },
    lowLevelClassExists: {
      string: NativeInterface.javaClassExists('java.lang.String'),
      missing: NativeInterface.javaClassExists('com.example.DoesNotExist'),
    },
    rawStaticField: capture('javaGetStaticField', function () {
      return parseBridgeJson(
        NativeInterface.javaGetStaticField('java.lang.Integer', 'MAX_VALUE'),
        'javaGetStaticField(MAX_VALUE)'
      );
    }),
    rawNewInstanceAndCall: capture('javaNewInstance + javaCallInstance', function () {
      const instance = expectBridgeSuccess(
        NativeInterface.javaNewInstance('java.io.File', '["/sdcard/raw-file.txt"]'),
        'javaNewInstance(File)'
      );
      const name = expectBridgeSuccess(
        NativeInterface.javaCallInstance(String(instance.__javaHandle), 'getName', '[]'),
        'javaCallInstance(getName)'
      );
      return {
        instance,
        name,
      };
    }),
    jsonObjectToMap: capture('JSONObject.toMap', function () {
      const value = new JSONObject('{"alpha":1,"enabled":true}').toMap();
      return {
        isArray: Array.isArray(value),
        type: typeof value,
        keys: value && typeof value === 'object' ? Object.keys(value) : [],
        value,
      };
    }),
    jsonArrayToList: capture('JSONArray.toList', function () {
      const value = new JSONArray('["a","b","c"]').toList();
      return {
        isArray: Array.isArray(value),
        type: typeof value,
        length: value && typeof value.length === 'number' ? value.length : null,
        value,
      };
    }),
    plainObjectToJSONObject: capture('new JSONObject(plain object)', function () {
      const json = new JSONObject({
        alpha: 1,
        enabled: true,
      });
      return {
        alpha: json.getInt('alpha'),
        enabled: json.getBoolean('enabled'),
      };
    }),
    jsArrayToJSONArray: capture('new JSONArray(js array)', function () {
      const arr = new JSONArray(['left', 'right']);
      return {
        length: arr.length(),
        first: arr.getString(0),
        second: arr.getString(1),
      };
    }),
    arraysAsListFromJsArray: capture('Arrays.asList(js array)', function () {
      const value = ArraysClass.asList(['x', 'y', 'z']);
      return {
        isArray: Array.isArray(value),
        length: value && typeof value.length === 'number' ? value.length : null,
        value,
      };
    }),
  };
};

exports.emitEventShapes = function emitEventShapes() {
  emit('string-event');
  emit({
    type: 'object-event',
    ok: true,
    count: 2,
  });
  console.log('console-log-event');
  complete({
    success: true,
    eventKinds: ['emit:string', 'emit:object', 'console.log'],
  });
};

exports.returnJavaFileImplicit = function returnJavaFileImplicit() {
  return makeFile('/sdcard/implicit-java-file.txt');
};

exports.explicitCompleteJavaFile = function explicitCompleteJavaFile() {
  complete(makeFile('/sdcard/explicit-java-file.txt'));
};

exports.explicitCompleteNestedJavaValues = function explicitCompleteNestedJavaValues() {
  complete({
    title: 'nested-java-values',
    file: makeFile('/sdcard/nested-java-file.txt'),
    nested: {
      child: makeFile('/sdcard/nested-child.txt'),
    },
    files: [
      makeFile('/sdcard/nested-a.txt'),
      makeFile('/sdcard/nested-b.txt'),
    ],
  });
};

exports.explicitCompleteNestedJavaValuesWithJavaList = function explicitCompleteNestedJavaValuesWithJavaList() {
  complete({
    title: 'nested-java-values-with-java-list',
    file: makeFile('/sdcard/nested-java-file.txt'),
    list: makeStringList(['x', 'y', 'z']),
  });
};

exports.explicitCompleteCyclicObject = function explicitCompleteCyclicObject() {
  complete(makeCyclicObject());
};

exports.explicitCompleteBigIntObject = function explicitCompleteBigIntObject() {
  complete(makeBigIntPayload());
};

exports.explicitCompleteUndefinedAndFunctionValues = function explicitCompleteUndefinedAndFunctionValues() {
  complete({
    title: 'undefined-and-function-values',
    present: true,
    skippedUndefined: undefined,
    skippedFunction: function () {
      return 'ignored';
    },
    nested: {
      keep: 'value',
      skip: undefined,
    },
    array: [1, undefined, function () {}, 4],
  });
};

exports.explicitCompleteDateAndRegexValues = function explicitCompleteDateAndRegexValues() {
  complete({
    title: 'date-and-regex-values',
    createdAt: new Date('2024-01-02T03:04:05.000Z'),
    matcher: /bridge-test/gi,
  });
};

exports.explicitCompleteMapAndSetValues = function explicitCompleteMapAndSetValues() {
  complete({
    title: 'map-and-set-values',
    map: new Map([
      ['alpha', 1],
      ['beta', true],
    ]),
    set: new Set(['left', 'right']),
  });
};

exports.explicitCompleteSymbolValues = function explicitCompleteSymbolValues() {
  const marker = Symbol('bridge-edge');
  complete({
    title: 'symbol-values',
    objectSymbol: marker,
    arraySymbol: [marker, 'tail'],
  });
};

exports.explicitCompleteSerializationError = function explicitCompleteSerializationError() {
  complete({
    ok: true,
    toJSON: function () {
      throw new Error('intentional toJSON failure for serialization edge test');
    },
  });
};
