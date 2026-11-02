'use strict';

const value = await Promise.resolve(42);

return {
  success: true,
  mode: 'script-mode-await-return',
  value,
};
