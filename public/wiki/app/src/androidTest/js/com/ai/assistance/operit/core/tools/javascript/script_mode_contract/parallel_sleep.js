'use strict';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'assertion failed');
  }
}

async function measure(mode, durations) {
  const startedAt = Date.now();

  if (mode === 'parallel-toolCall') {
    const results = await Promise.all(
      durations.map(function (durationMs) {
        return toolCall('sleep', { duration_ms: durationMs });
      })
    );
    return {
      mode,
      totalMs: Date.now() - startedAt,
      requested: results.map(function (item) { return Number(item.requestedMs); }),
      slept: results.map(function (item) { return Number(item.sleptMs); }),
    };
  }

  if (mode === 'sequential-toolCall') {
    const requested = [];
    const slept = [];
    for (const durationMs of durations) {
      const result = await toolCall('sleep', { duration_ms: durationMs });
      requested.push(Number(result.requestedMs));
      slept.push(Number(result.sleptMs));
    }
    return {
      mode,
      totalMs: Date.now() - startedAt,
      requested,
      slept,
    };
  }

  if (mode === 'parallel-tools') {
    const results = await Promise.all(
      durations.map(function (durationMs) {
        return Tools.System.sleep(durationMs);
      })
    );
    return {
      mode,
      totalMs: Date.now() - startedAt,
      requested: results.map(function (item) { return Number(item.requestedMs); }),
      slept: results.map(function (item) { return Number(item.sleptMs); }),
    };
  }

  throw new Error('unknown mode: ' + mode);
}

const durations = [100, 100, 100];
const parallelToolCall = await measure('parallel-toolCall', durations);
const sequentialToolCall = await measure('sequential-toolCall', durations);
const parallelTools = await measure('parallel-tools', durations);

assert(parallelToolCall.totalMs + 60 < sequentialToolCall.totalMs, 'toolCall parallel sleep did not overlap');
assert(parallelTools.totalMs + 60 < sequentialToolCall.totalMs, 'Tools.System.sleep parallel sleep did not overlap');

return {
  success: true,
  mode: 'script-mode-parallel-sleep',
  parallelToolCall,
  sequentialToolCall,
  parallelTools,
};
