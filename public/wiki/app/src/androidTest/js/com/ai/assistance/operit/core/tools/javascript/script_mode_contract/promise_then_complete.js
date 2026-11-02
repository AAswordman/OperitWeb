'use strict';

Promise.resolve({
  success: true,
  mode: 'script-mode-promise-then-complete',
  values: ['a', 'b', 'c'],
}).then(function (payload) {
  complete(payload);
});
