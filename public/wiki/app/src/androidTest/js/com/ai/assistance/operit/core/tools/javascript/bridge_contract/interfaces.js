'use strict';

const {
  assertEq,
  test,
  runSuite,
  runThreadAndJoin,
  runFutureTask,
  Runnable,
  Callable,
  TimeUnit,
} = require('./common');

exports.run = async function run() {
  return runSuite([
    test('Java.implement supports class proxy plus object implementation', () => {
      let count = 0;
      const runnable = Java.implement(Runnable, {
        run: function () {
          count += 1;
        },
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('Java.implement supports string interface plus SAM function', () => {
      let count = 0;
      const runnable = Java.implement('java.lang.Runnable', function () {
        count += 1;
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('Java.implement supports SAM shorthand without explicit interface name', () => {
      let count = 0;
      const runnable = Java.implement(function () {
        count += 1;
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('Java.proxy alias supports object implementation', () => {
      let count = 0;
      const runnable = Java.proxy(Runnable, {
        run: function () {
          count += 1;
        },
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('callback position accepts plain object for Runnable', () => {
      let count = 0;
      runThreadAndJoin({
        run: function () {
          count += 1;
        },
      });
      assertEq(count, 1);
    }),
    test('callback position accepts plain function for Runnable', () => {
      let count = 0;
      runThreadAndJoin(function () {
        count += 1;
      });
      assertEq(count, 1);
    }),
    test('interface class proxy call accepts plain object implementation', () => {
      let count = 0;
      const runnable = Runnable({
        run: function () {
          count += 1;
        },
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('interface class proxy call accepts plain function implementation', () => {
      let count = 0;
      const runnable = Runnable(function () {
        count += 1;
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('Java.proxy supports string interface plus SAM function', () => {
      let count = 0;
      const runnable = Java.proxy('java.lang.Runnable', function () {
        count += 1;
      });
      runThreadAndJoin(runnable);
      assertEq(count, 1);
    }),
    test('Java.implement supports non-void return values through Callable object', () => {
      const callable = Java.implement(Callable, {
        call: function () {
          return 'callable-object-result';
        },
      });
      assertEq(String(runFutureTask(callable)), 'callable-object-result');
    }),
    test('callback position accepts plain object for Callable return', () => {
      const value = runFutureTask({
        call: function () {
          return 'callable-plain-object';
        },
      });
      assertEq(String(value), 'callable-plain-object');
    }),
    test('callback position accepts plain function for Callable return', () => {
      const value = runFutureTask(function () {
        return 'callable-plain-function';
      });
      assertEq(String(value), 'callable-plain-function');
    }),
    test('Callable class proxy call accepts plain function implementation', () => {
      const callable = Callable(function () {
        return 'callable-class-proxy-function';
      });
      assertEq(String(runFutureTask(callable)), 'callable-class-proxy-function');
    }),
    test('Callable get(timeout, unit) resolves through callback pumping', () => {
      const task = new Java.java.util.concurrent.FutureTask(function () {
        return 'timed-callable-result';
      });
      const worker = new Java.java.lang.Thread(task);
      worker.start();
      const value = task.get(2, TimeUnit.SECONDS);
      worker.join(2000);
      assertEq(String(value), 'timed-callable-result');
    }),
    test('closure state remains visible across repeated Runnable invocations', () => {
      let count = 0;
      const runnable = Runnable(function () {
        count += 1;
      });
      runThreadAndJoin(runnable);
      runThreadAndJoin(runnable);
      assertEq(count, 2);
    }),
  ]);
};
