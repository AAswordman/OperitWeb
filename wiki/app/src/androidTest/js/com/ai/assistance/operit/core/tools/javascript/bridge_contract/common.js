'use strict';

const { assert, assertEq, test, runTests } = require('../../../../../../../../lib/harness');

const File = Java.type('java.io.File');
const Thread = Java.type('java.lang.Thread');
const Runnable = Java.type('java.lang.Runnable');
const Callable = Java.type('java.util.concurrent.Callable');
const FutureTask = Java.type('java.util.concurrent.FutureTask');
const StringBuilder = Java.type('java.lang.StringBuilder');
const ArrayList = Java.type('java.util.ArrayList');
const HashMap = Java.type('java.util.HashMap');
const JSONObject = Java.type('org.json.JSONObject');
const JSONArray = Java.type('org.json.JSONArray');
const Integer = Java.java.lang.Integer;
const MathClass = Java.java.lang.Math;
const Charset = Java.java.nio.charset.Charset;
const MapEntry = Java.java.util.Map.Entry;
const ArraysClass = Java.java.util.Arrays;
const Collections = Java.java.util.Collections;
const TimeUnit = Java.java.util.concurrent.TimeUnit;
const BuildVersion = Java.android.os.Build.VERSION;

function makeFile(path) {
  return new File(String(path));
}

function runThreadAndJoin(runnableLike, timeoutMs) {
  const worker = new Thread(runnableLike);
  worker.start();
  worker.join(timeoutMs || 2000);
}

function runFutureTask(callableLike, timeoutMs) {
  const task = new FutureTask(callableLike);
  const worker = new Thread(task);
  worker.start();
  worker.join(timeoutMs || 2000);
  return task.get();
}

function assertArray(value, message) {
  assert(Array.isArray(value), message || 'expected JS array');
}

function assertPlainObject(value, message) {
  assert(value && typeof value === 'object' && !Array.isArray(value), message || 'expected plain object');
}

async function runSuite(tests) {
  const result = await runTests(tests);
  assert(result.passed + result.failed > 0, 'no tests executed');
  return result;
}

module.exports = {
  assert,
  assertEq,
  test,
  runSuite,
  assertArray,
  assertPlainObject,
  makeFile,
  runThreadAndJoin,
  runFutureTask,
  File,
  Thread,
  Runnable,
  Callable,
  FutureTask,
  StringBuilder,
  ArrayList,
  HashMap,
  JSONObject,
  JSONArray,
  Integer,
  MathClass,
  Charset,
  MapEntry,
  ArraysClass,
  Collections,
  TimeUnit,
  BuildVersion,
};
