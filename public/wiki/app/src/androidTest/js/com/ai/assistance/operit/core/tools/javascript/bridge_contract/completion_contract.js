'use strict';

const { makeFile, Runnable } = require('./common');

exports.catalog = function catalog() {
  return {
    functions: [
      'returnPlainJson',
      'completePlainJson',
      'returnJavaProxy',
      'completeJavaProxy',
      'returnNestedJavaValues',
      'completeNestedJavaValues',
      'returnCallbackProxy',
      'completeCallbackProxy',
      'returnMixedStructuredValue',
      'completeMixedStructuredValue',
      'returnJavaProxyArray',
      'completeJavaProxyArray',
      'returnClassAndEnumValues',
      'completeClassAndEnumValues',
    ],
  };
};

exports.returnPlainJson = function returnPlainJson() {
  return {
    ok: true,
    kind: 'plain-json',
    values: [1, 2, 3],
  };
};

exports.completePlainJson = function completePlainJson() {
  complete({
    ok: true,
    kind: 'plain-json',
    values: [1, 2, 3],
  });
};

exports.returnJavaProxy = function returnJavaProxy() {
  return makeFile('/sdcard/return-java-proxy.txt');
};

exports.completeJavaProxy = function completeJavaProxy() {
  complete(makeFile('/sdcard/complete-java-proxy.txt'));
};

exports.returnNestedJavaValues = function returnNestedJavaValues() {
  return {
    title: 'nested-java-values',
    file: makeFile('/sdcard/nested-a.txt'),
    files: [
      makeFile('/sdcard/nested-b.txt'),
      makeFile('/sdcard/nested-c.txt'),
    ],
  };
};

exports.completeNestedJavaValues = function completeNestedJavaValues() {
  complete({
    title: 'nested-java-values',
    file: makeFile('/sdcard/nested-a.txt'),
    files: [
      makeFile('/sdcard/nested-b.txt'),
      makeFile('/sdcard/nested-c.txt'),
    ],
  });
};

exports.returnCallbackProxy = function returnCallbackProxy() {
  return Java.implement(Runnable, {
    run: function () {},
  });
};

exports.completeCallbackProxy = function completeCallbackProxy() {
  complete(Java.implement(Runnable, {
    run: function () {},
  }));
};

exports.returnMixedStructuredValue = function returnMixedStructuredValue() {
  return {
    ok: true,
    count: 3,
    file: makeFile('/sdcard/mixed-structured.txt'),
    callback: Java.implement(Runnable, {
      run: function () {},
    }),
    nested: {
      values: [1, 'two', null],
      extraFile: makeFile('/sdcard/mixed-extra.txt'),
    },
  };
};

exports.completeMixedStructuredValue = function completeMixedStructuredValue() {
  complete({
    ok: true,
    count: 3,
    file: makeFile('/sdcard/mixed-structured.txt'),
    callback: Java.implement(Runnable, {
      run: function () {},
    }),
    nested: {
      values: [1, 'two', null],
      extraFile: makeFile('/sdcard/mixed-extra.txt'),
    },
  });
};

exports.returnJavaProxyArray = function returnJavaProxyArray() {
  return [
    makeFile('/sdcard/array-a.txt'),
    makeFile('/sdcard/array-b.txt'),
    makeFile('/sdcard/array-c.txt'),
  ];
};

exports.completeJavaProxyArray = function completeJavaProxyArray() {
  complete([
    makeFile('/sdcard/array-a.txt'),
    makeFile('/sdcard/array-b.txt'),
    makeFile('/sdcard/array-c.txt'),
  ]);
};

exports.returnClassAndEnumValues = function returnClassAndEnumValues() {
  return {
    fileClass: makeFile('/sdcard/class-enum.txt').getClass(),
    threadState: Java.java.lang.Thread.currentThread().getState(),
  };
};

exports.completeClassAndEnumValues = function completeClassAndEnumValues() {
  complete({
    fileClass: makeFile('/sdcard/class-enum.txt').getClass(),
    threadState: Java.java.lang.Thread.currentThread().getState(),
  });
};
