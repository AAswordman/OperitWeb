'use strict';

const basicSyntax = require('./basic_syntax');
const hostRuntime = require('./host_runtime');
const interfaces = require('./interfaces');
const javaToJs = require('./java_to_js');
const jsToJava = require('./js_to_java');
const suspendAwait = require('./suspend_await');

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
    const result = suite.result;
    summary.success = summary.success && result.success;
    summary.passed += result.passed;
    summary.failed += result.failed;
    summary.durationMs += result.durationMs;
    summary.suites.push({
      name: suite.name,
      success: result.success,
      passed: result.passed,
      failed: result.failed,
      durationMs: result.durationMs,
      failures: result.failures,
    });
    for (const failure of result.failures) {
      summary.failures.push({
        name: suite.name + ' :: ' + failure.name,
        error: failure.error,
      });
    }
  }

  return summary;
}

exports.runBasicSyntax = basicSyntax.run;
exports.runHostRuntime = hostRuntime.run;
exports.runInterfaces = interfaces.run;
exports.runJavaToJs = javaToJs.run;
exports.runJsToJava = jsToJava.run;
exports.runSuspendAwait = suspendAwait.run;

exports.run = async function run() {
  const basic = await basicSyntax.run();
  const runtime = await hostRuntime.run();
  const iface = await interfaces.run();
  const inbound = await javaToJs.run();
  const outbound = await jsToJava.run();
  const suspend = await suspendAwait.run();
  return summarizeSuites([
    { name: 'basic_syntax', result: basic },
    { name: 'host_runtime', result: runtime },
    { name: 'interfaces', result: iface },
    { name: 'java_to_js', result: inbound },
    { name: 'js_to_java', result: outbound },
    { name: 'suspend_await', result: suspend },
  ]);
};
