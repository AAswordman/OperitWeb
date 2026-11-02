'use strict';

const File = Java.type('java.io.File');

return {
  success: true,
  mode: 'script-mode-return-java-proxy',
  file: new File('/sdcard/script-mode-return-java-proxy.txt'),
  nested: {
    child: new File('/sdcard/script-mode-return-java-proxy-child.txt'),
  },
  files: [
    new File('/sdcard/script-mode-return-java-proxy-a.txt'),
    new File('/sdcard/script-mode-return-java-proxy-b.txt'),
  ],
};
