'use strict';

const {
  assert,
  assertEq,
  test,
  runSuite,
  makeFile,
  File,
  StringBuilder,
  Integer,
  MathClass,
  Charset,
  MapEntry,
  BuildVersion,
} = require('./common');

exports.run = async function run() {
  return runSuite([
    test('Java.type resolves class proxy', () => {
      const Cls = Java.type('java.lang.StringBuilder');
      assertEq(String(Cls.className), 'java.lang.StringBuilder');
    }),
    test('Java.use resolves class proxy', () => {
      const Cls = Java.use('java.io.File');
      assertEq(String(Cls.className), 'java.io.File');
    }),
    test('Java.importClass resolves class proxy', () => {
      const Cls = Java.importClass('java.io.File');
      assertEq(String(Cls.className), 'java.io.File');
    }),
    test('Java.package resolves package proxy', () => {
      const pkg = Java.package('java.lang');
      assertEq(String(pkg.path), 'java.lang');
      assertEq(String(pkg.StringBuilder.className), 'java.lang.StringBuilder');
    }),
    test('package chain resolves nested Android class', () => {
      assert(Number(BuildVersion.SDK_INT) > 0, 'SDK_INT should be positive');
    }),
    test('class proxy constructors support new direct and newInstance', () => {
      const byNew = new File('/sdcard/contract-new.txt');
      const byCall = File('/sdcard/contract-call.txt');
      const byFactory = File.newInstance('/sdcard/contract-factory.txt');
      assertEq(String(byNew.getName()), 'contract-new.txt');
      assertEq(String(byCall.getName()), 'contract-call.txt');
      assertEq(String(byFactory.getName()), 'contract-factory.txt');
    }),
    test('instance method sugar matches explicit call', () => {
      const file = makeFile('/sdcard/alpha/beta.txt');
      assertEq(String(file.getName()), String(file.call('getName')));
      assertEq(String(file.getAbsolutePath()), String(file.call('getAbsolutePath')));
    }),
    test('instance field sugar mirrors getter results', () => {
      const file = makeFile('/sdcard/property-name.txt');
      assertEq(String(file.name), String(file.getName()));
      assertEq(String(file.absolutePath), String(file.getAbsolutePath()));
      assertEq(String(file.parent), '/sdcard');
    }),
    test('static field and static method sugar work', () => {
      assertEq(Number(Integer.MAX_VALUE), 2147483647);
      assertEq(Number(Integer.parseInt('456')), 456);
      assertEq(Number(MathClass.max(2, 9)), 9);
    }),
    test('nested class sugar resolves outer$inner', () => {
      assert(String(MapEntry.className).indexOf('java.util.Map$Entry') >= 0, 'nested class name mismatch');
    }),
    test('top-level Java.classExists newInstance and callStatic work', () => {
      assertEq(Java.classExists('java.io.File'), true);
      assertEq(Java.classExists('com.example.DoesNotExist'), false);
      const file = Java.newInstance('java.io.File', '/sdcard/top-level.txt');
      assertEq(String(file.getName()), 'top-level.txt');
      assertEq(Number(Java.callStatic('java.lang.Integer', 'parseInt', '123')), 123);
    }),
    test('class proxy metadata and package chain static calls remain available', () => {
      const now = Number(Java.java.lang.System.currentTimeMillis());
      assertEq(String(File.className), 'java.io.File');
      assertEq(String(StringBuilder.className), 'java.lang.StringBuilder');
      assert(now > 0, 'currentTimeMillis should be positive');
    }),
    test('top-level package chain constructs java objects directly', () => {
      const file = Java.java.io.File('/sdcard/package-chain.txt');
      assertEq(String(file.getName()), 'package-chain.txt');
      assertEq(String(file.className), 'java.io.File');
    }),
    test('StringBuilder syntax sugar supports chaining', () => {
      const builderA = new StringBuilder();
      const builderB = StringBuilder();
      const builderC = StringBuilder.newInstance();
      assertEq(String(builderA.append('he').append('llo').toString()), 'hello');
      assertEq(String(builderB.append('a').append('b').append('c').toString()), 'abc');
      assertEq(String(builderC.append('x').append('y').append('z').toString()), 'xyz');
    }),
    test('class proxy exists helper returns normalized boolean', () => {
      assertEq(File.exists(), true);
      assertEq(Java.type('com.example.DoesNotExist').exists(), false);
    }),
    test('top-level Java.listLoadedCodePaths returns JS array', () => {
      const paths = Java.listLoadedCodePaths();
      assert(Array.isArray(paths), 'listLoadedCodePaths should return array');
    }),
    test('application context is exposed as java proxy', () => {
      const context = Java.getApplicationContext();
      assertEq(String(context.getPackageName()), 'com.ai.assistance.operit');
    }),
    test('Kotlin alias mirrors Java bridge entry points', () => {
      const file = Kotlin.type('java.io.File')('/sdcard/kotlin-alias.txt');
      assertEq(String(file.getName()), 'kotlin-alias.txt');
      assertEq(Kotlin.classExists('java.io.File'), true);
    }),
    test('java instance proxies expose stable JSON metadata', () => {
      const file = makeFile('/sdcard/metadata.txt');
      const metadata = file.toJSON();
      assertEq(String(metadata.__javaClass), 'java.io.File');
      assert(String(metadata.__javaHandle).length > 0, 'java handle should not be empty');
    }),
    test('java class proxies stringify with class name', () => {
      assertEq(String(File), '[JavaClass java.io.File]');
      assertEq(String(StringBuilder), '[JavaClass java.lang.StringBuilder]');
    }),
    test('nested class methods still work through package chain', () => {
      const utf8 = Charset.forName('UTF-8');
      assertEq(String(utf8.name()), 'UTF-8');
    }),
  ]);
};
