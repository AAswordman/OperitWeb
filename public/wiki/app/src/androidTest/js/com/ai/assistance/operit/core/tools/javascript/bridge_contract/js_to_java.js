'use strict';

const {
  assertEq,
  test,
  runSuite,
  assertArray,
  assertPlainObject,
  makeFile,
  ArrayList,
  HashMap,
  JSONObject,
  JSONArray,
  ArraysClass,
} = require('./common');

exports.run = async function run() {
  return runSuite([
    test('plain object converts to JSONObject constructor input', () => {
      const json = new JSONObject({
        alpha: 1,
        enabled: true,
        name: 'bridge',
      });
      assertEq(Number(json.getInt('alpha')), 1);
      assertEq(Boolean(json.getBoolean('enabled')), true);
      assertEq(String(json.getString('name')), 'bridge');
    }),
    test('nested plain object converts to JSONObject recursively', () => {
      const json = new JSONObject({
        meta: {
          count: 2,
          enabled: true,
        },
        name: 'nested',
      });
      const meta = json.getJSONObject('meta');
      assertPlainObject(meta, 'nested JSONObject result should normalize to plain object');
      assertEq(Number(meta.count), 2);
      assertEq(Boolean(meta.enabled), true);
      assertEq(String(json.getString('name')), 'nested');
    }),
    test('JS array converts to JSONArray constructor input', () => {
      const array = new JSONArray(['left', 'right']);
      assertEq(Number(array.length()), 2);
      assertEq(String(array.getString(0)), 'left');
      assertEq(String(array.getString(1)), 'right');
    }),
    test('nested JS array converts to JSONArray recursively', () => {
      const array = new JSONArray([['left', 'right'], [1, 2]]);
      const first = array.getJSONArray(0);
      const second = array.getJSONArray(1);
      assertArray(first, 'nested JSONArray result should normalize to JS array');
      assertArray(second, 'nested JSONArray result should normalize to JS array');
      assertEq(String(first[1]), 'right');
      assertEq(Number(second[0]), 1);
    }),
    test('plain object converts to java.util.Map constructor input', () => {
      const map = new HashMap({
        alpha: 1,
        beta: 'two',
      });
      assertEq(Number(map.call('get', 'alpha')), 1);
      assertEq(String(map.call('get', 'beta')), 'two');
    }),
    test('nested plain object converts to java.util.Map recursively', () => {
      const map = new HashMap({
        meta: {
          count: 3,
        },
        title: 'bridge',
      });
      const meta = map.call('get', 'meta');
      assertPlainObject(meta, 'nested map result should normalize to plain object');
      assertEq(Number(meta.count), 3);
      assertEq(String(map.call('get', 'title')), 'bridge');
    }),
    test('JS array converts to Collection constructor input', () => {
      const list = new ArrayList(['a', 'b', 'c']);
      assertEq(Number(list.size()), 3);
      assertEq(String(list.call('get', 2)), 'c');
    }),
    test('nested JS array converts to Collection constructor input', () => {
      const list = new ArrayList([
        ['a', 'b'],
        ['c'],
      ]);
      const first = list.call('get', 0);
      assertArray(first, 'nested collection result should normalize to JS array');
      assertEq(first.length, 2);
      assertEq(String(first[1]), 'b');
    }),
    test('JS array converts to Java varargs', () => {
      const listValue = ArraysClass.asList(['x', 'y', 'z']);
      assertArray(listValue, 'varargs result should normalize to JS array');
      assertEq(listValue.length, 3);
      assertEq(String(listValue[1]), 'y');
    }),
    test('string converts to Class parameter when calling Enum.valueOf', () => {
      const enumValue = Java.callStatic('java.lang.Enum', 'valueOf', 'java.lang.Thread$State', 'RUNNABLE');
      assertEq(String(enumValue), 'RUNNABLE');
    }),
    test('java instance proxy converts back to original Java object when passed as argument', () => {
      const parent = makeFile('/sdcard');
      const child = new Java.java.io.File(parent, 'child.txt');
      assertEq(String(child.getAbsolutePath()), '/sdcard/child.txt');
    }),
    test('java instance proxy remains valid when nested inside JS array arguments', () => {
      const parent = makeFile('/sdcard');
      const results = ArraysClass.asList([parent, new Java.java.io.File(parent, 'nested.txt')]);
      assertArray(results, 'nested java proxies should round-trip through JS array arguments');
      assertEq(String(results[0].getAbsolutePath()), '/sdcard');
      assertEq(String(results[1].getAbsolutePath()), '/sdcard/nested.txt');
    }),
  ]);
};
