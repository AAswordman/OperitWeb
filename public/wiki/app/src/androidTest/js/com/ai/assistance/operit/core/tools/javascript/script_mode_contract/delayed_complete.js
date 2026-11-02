'use strict';

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

delay(50).then(function () {
  complete({
    success: true,
    mode: 'script-mode-delayed-complete',
    waitedMs: 50,
  });
});
