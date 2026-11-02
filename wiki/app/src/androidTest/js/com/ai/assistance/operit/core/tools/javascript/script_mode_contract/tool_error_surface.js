'use strict';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'assertion failed');
  }
}

const syncError = String(NativeInterface.callTool('default', '', '{}'));
assert(
  syncError.indexOf('Tool name cannot be empty') >= 0,
  'sync empty-tool call should expose explicit error'
);

let asyncMessage = '';
try {
  await toolCall({
    type: 'default',
    name: '',
    params: {},
  });
  throw new Error('toolCall should reject for empty tool name');
} catch (e) {
  asyncMessage = String(e && e.message ? e.message : e);
}

assert(
  asyncMessage.indexOf('Tool name cannot be empty') >= 0,
  'async empty-tool call should expose explicit error'
);

return {
  success: true,
  mode: 'script-mode-tool-error-surface',
  syncError: syncError,
  asyncError: asyncMessage,
};
