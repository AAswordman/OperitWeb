'use strict';

const {
  assert,
  assertEq,
  test,
  runSuite,
} = require('./common');

function extractErrorMessage(error) {
  return String(error && error.message ? error.message : error);
}

function assertSleepResult(result, expectedMs, label) {
  assert(result && typeof result === 'object', (label || 'sleep') + ' should return object');
  assertEq(Number(result.requestedMs), expectedMs, (label || 'sleep') + ' requestedMs mismatch');
  assertEq(Number(result.sleptMs), expectedMs, (label || 'sleep') + ' sleptMs mismatch');
}

async function expectRejectMessage(factory) {
  try {
    await factory();
  } catch (e) {
    return extractErrorMessage(e);
  }
  throw new Error('expected promise rejection');
}

async function measureSleepBatch(mode, durations) {
  const startedAt = Date.now();
  const results = await Promise.all(
    durations.map(async function (durationMs, index) {
      const result =
        mode === 'tools'
          ? await Tools.System.sleep(durationMs)
          : await toolCall('sleep', { duration_ms: durationMs });
      return {
        index,
        requestedMs: Number(result.requestedMs),
        sleptMs: Number(result.sleptMs),
        finishedAtMs: Date.now() - startedAt,
      };
    })
  );

  return {
    mode,
    durations,
    totalMs: Date.now() - startedAt,
    results,
  };
}

async function measureSequentialSleep(mode, durations) {
  const startedAt = Date.now();
  const results = [];

  for (const durationMs of durations) {
    const result =
      mode === 'tools'
        ? await Tools.System.sleep(durationMs)
        : await toolCall('sleep', { duration_ms: durationMs });
    results.push({
      requestedMs: Number(result.requestedMs),
      sleptMs: Number(result.sleptMs),
      finishedAtMs: Date.now() - startedAt,
    });
  }

  return {
    mode,
    durations,
    totalMs: Date.now() - startedAt,
    results,
  };
}

exports.run = async function run() {
  return runSuite([
    test('Tools.System.sleep returns structured result with stable string form', async () => {
      const result = await Tools.System.sleep(18);
      assertSleepResult(result, 18, 'Tools.System.sleep');
    }),
    test('toolCall one-arg form returns structured sleep result', async () => {
      const result = await toolCall('sleep', { duration_ms: 16 });
      assertSleepResult(result, 16, 'toolCall(name, params)');
    }),
    test('toolCall explicit type form returns structured sleep result', async () => {
      const result = await toolCall('default', 'sleep', { duration_ms: 14 });
      assertSleepResult(result, 14, 'toolCall(type, name, params)');
    }),
    test('toolCall config form returns structured sleep result', async () => {
      const result = await toolCall({
        type: 'default',
        name: 'sleep',
        params: { duration_ms: 12 },
      });
      assertSleepResult(result, 12, 'toolCall(config)');
    }),
    test('NativeInterface.callTool returns structured success json for sync sleep', () => {
      const parsed = JSON.parse(
        NativeInterface.callTool('default', 'sleep', '{"duration_ms":9}'),
      );
      assertEq(parsed.success, true);
      assert(parsed.data && typeof parsed.data === 'object', 'sync tool result should include data object');
      assertEq(Number(parsed.data.requestedMs), 9);
      assertEq(Number(parsed.data.sleptMs), 9);
    }),
    test('NativeInterface.callTool returns explicit error text for empty tool name', () => {
      const raw = String(NativeInterface.callTool('default', '', '{}'));
      assert(raw.indexOf('Tool name cannot be empty') >= 0, 'missing empty-name error detail');
    }),
    test('toolCall rejects with explicit message for empty tool name', async () => {
      const message = await expectRejectMessage(async function () {
        await toolCall({
          type: 'default',
          name: '',
          params: {},
        });
      });
      assert(message.indexOf('Tool name cannot be empty') >= 0, 'missing async empty-name error detail');
    }),
    test('Promise.all over toolCall preserves result order and values', async () => {
      const results = await Promise.all([
        toolCall('sleep', { duration_ms: 11 }),
        toolCall('sleep', { duration_ms: 22 }),
        toolCall('sleep', { duration_ms: 33 }),
      ]);
      assertEq(results.length, 3);
      assertSleepResult(results[0], 11, 'toolCall result[0]');
      assertSleepResult(results[1], 22, 'toolCall result[1]');
      assertSleepResult(results[2], 33, 'toolCall result[2]');
    }),
    test('Promise.all over toolCall sleep overlaps relative to sequential execution', async () => {
      const durations = [90, 90, 90];
      const parallel = await measureSleepBatch('toolCall', durations);
      const sequential = await measureSequentialSleep('toolCall', durations);
      assert(parallel.totalMs + 60 < sequential.totalMs, 'toolCall parallel batch did not overlap enough');
    }),
    test('Promise.all over Tools.System.sleep overlaps relative to sequential execution', async () => {
      const durations = [80, 80, 80];
      const parallel = await measureSleepBatch('tools', durations);
      const sequential = await measureSequentialSleep('tools', durations);
      assert(parallel.totalMs + 60 < sequential.totalMs, 'Tools.System.sleep parallel batch did not overlap enough');
    }),
  ]);
};
