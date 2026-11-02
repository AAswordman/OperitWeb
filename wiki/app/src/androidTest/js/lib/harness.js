'use strict';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'assertion failed');
  }
}

function assertEq(actual, expected, message) {
  if (actual !== expected) {
    const prefix = message ? message + ': ' : '';
    throw new Error(prefix + 'expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
  }
}

function test(name, fn) {
  return { name: String(name || '').trim() || '(unnamed)', fn };
}

function normalizeRunOptions(options) {
  const normalized = options && typeof options === 'object' ? options : {};
  return {
    only: normalized.only ? String(normalized.only) : '',
    startAt: normalized.startAt ? String(normalized.startAt) : '',
  };
}

function selectTests(tests, options) {
  const normalized = normalizeRunOptions(options);
  if (normalized.only) {
    const matched = tests.filter((t) => t.name === normalized.only);
    if (matched.length === 0) {
      throw new Error('test not found: ' + normalized.only);
    }
    return matched;
  }
  if (normalized.startAt) {
    const startIndex = tests.findIndex((t) => t.name === normalized.startAt);
    if (startIndex < 0) {
      throw new Error('startAt test not found: ' + normalized.startAt);
    }
    return tests.slice(startIndex);
  }
  return tests;
}

async function runTests(tests, options) {
  const startedAt = Date.now();
  let passed = 0;
  const failures = [];
  const selectedTests = selectTests(tests, options);

  for (const t of selectedTests) {
    try {
      const out = t.fn();
      if (out && typeof out.then === 'function') {
        await out;
      }
      passed += 1;
    } catch (e) {
      failures.push({
        name: t.name,
        error: String(e && e.stack ? e.stack : e),
      });
    }
  }

  const failed = failures.length;
  return {
    success: failed === 0,
    passed,
    failed,
    durationMs: Date.now() - startedAt,
    failures,
    selectedCount: selectedTests.length,
  };
}

module.exports = {
  assert,
  assertEq,
  test,
  runTests,
};
