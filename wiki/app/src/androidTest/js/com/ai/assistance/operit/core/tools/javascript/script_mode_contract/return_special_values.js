'use strict';

return {
  success: true,
  mode: 'script-mode-return-special-values',
  payload: {
    createdAt: new Date('2024-01-02T03:04:05.000Z'),
    matcher: /script-mode-special/gi,
    count: 12345678901234567890n,
    map: new Map([
      ['alpha', 1],
      ['beta', true],
    ]),
    set: new Set(['left', 'right']),
    symbol: Symbol('script-mode-special'),
    nested: {
      keep: 'value',
      skip: undefined,
    },
    array: [1, undefined, function () { return 'ignored'; }, 4],
  },
};
