'use strict';

const {
  assert,
  assertEq,
  test,
  runSuite,
  assertArray,
  assertPlainObject,
  makeFile,
  Thread,
  JSONObject,
  JSONArray,
  Collections,
  ArraysClass,
  ArrayList,
  HashMap,
} = require('./common');

exports.run = async function run() {
  return runSuite([
    test('Map returns to JS as plain object', () => {
      const mapValue = Collections.singletonMap('alpha', 1);
      assertPlainObject(mapValue, 'Map should normalize to plain object');
      assertEq(Number(mapValue.alpha), 1);
    }),
    test('List returns to JS as array', () => {
      const listValue = ArraysClass.asList('a', 'b', 'c');
      assertArray(listValue, 'List should normalize to JS array');
      assertEq(listValue.length, 3);
      assertEq(String(listValue[1]), 'b');
    }),
    test('constructed ArrayList remains a Java proxy', () => {
      const listValue = new ArrayList(ArraysClass.asList('left', 'right'));
      assertEq(String(listValue.className), 'java.util.ArrayList');
      assertEq(Number(listValue.size()), 2);
      assertEq(String(listValue.call('get', 0)), 'left');
    }),
    test('JSONArray returns to JS as array', () => {
      const arrayValue = new JSONObject('{"arr":["x","y","z"]}').getJSONArray('arr');
      assertArray(arrayValue, 'JSONArray should normalize to JS array');
      assertEq(arrayValue.length, 3);
      assertEq(String(arrayValue[2]), 'z');
    }),
    test('JSONObject returned from Java method normalizes to plain object', () => {
      const jsonValue = new JSONObject('{"payload":{"alpha":1,"enabled":true}}').getJSONObject('payload');
      assertPlainObject(jsonValue, 'JSONObject should normalize to plain object');
      assertEq(Number(jsonValue.alpha), 1);
      assertEq(Boolean(jsonValue.enabled), true);
    }),
    test('nested JSONObject and JSONArray normalize recursively', () => {
      const nested = new JSONObject('{"payload":{"meta":{"name":"bridge"},"items":[1,2,3]}}').getJSONObject('payload');
      assertPlainObject(nested, 'nested JSONObject should normalize to plain object');
      assertPlainObject(nested.meta, 'nested meta should normalize to plain object');
      assertArray(nested.items, 'nested items should normalize to JS array');
      assertEq(String(nested.meta.name), 'bridge');
      assertEq(Number(nested.items[1]), 2);
    }),
    test('Java array returns to JS as array', () => {
      const arrayValue = Java.callStatic('java.lang.reflect.Array', 'newInstance', 'java.lang.String', 2);
      assertArray(arrayValue, 'Java array should normalize to JS array');
      assertEq(arrayValue.length, 2);
      assertEq(arrayValue[0], null);
    }),
    test('Map with nested list normalizes recursively', () => {
      const mapValue = Collections.singletonMap(
        'payload',
        Collections.singletonMap('letters', ArraysClass.asList('a', 'b'))
      );
      assertPlainObject(mapValue, 'HashMap should normalize to plain object');
      assertPlainObject(mapValue.payload, 'nested map should normalize to JS object');
      assertArray(mapValue.payload.letters, 'nested list should normalize to JS array');
      assertEq(String(mapValue.payload.letters[1]), 'b');
    }),
    test('Class values return to JS as strings', () => {
      const classValue = makeFile('/sdcard/class-value.txt').getClass();
      assertEq(typeof classValue, 'string');
      assertEq(String(classValue), 'java.io.File');
    }),
    test('Enum values return to JS as strings', () => {
      const stateValue = Thread.currentThread().getState();
      assertEq(typeof stateValue, 'string');
      assert(String(stateValue).length > 0, 'enum string should not be empty');
    }),
    test('ordinary Java objects return to JS as proxies', () => {
      const file = makeFile('/sdcard/proxy-value.txt');
      assertEq(String(file.className), 'java.io.File');
      assertEq(String(file.getName()), 'proxy-value.txt');
    }),
    test('application context returns to JS as proxy object', () => {
      const context = Java.getApplicationContext();
      assertEq(String(context.getPackageName()), 'com.ai.assistance.operit');
    }),
  ]);
};
