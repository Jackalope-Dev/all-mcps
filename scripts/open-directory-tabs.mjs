import { exec } from 'node:child_process';
import os from 'node:os';

const DIRECTORY_URLS = [
  'https://devhunt.org',
  'https://peerlist.io',
  'https://stackshare.io',
  'https://www.saashub.com/submit',
  'https://alternativeto.net',
  'https://www.toolify.ai/submit',
  'https://www.futurepedia.io/submit-tool',
  'https://www.futuretools.io/submit-a-tool',
  'https://aitoptools.com/submit-a-tool/',
  'https://www.uneed.best/submit',
  'https://microlaunch.net',
  'https://www.launchingnext.com/submit/',
  'https://betalist.com/submit',
  'https://www.producthunt.com/posts/new'
];

console.log(`Opening ${DIRECTORY_URLS.length} directory submission pages in your browser...`);

const platform = os.platform();

DIRECTORY_URLS.forEach((url, index) => {
  setTimeout(() => {
    let command;
    if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else if (platform === 'darwin') {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    exec(command, (err) => {
      if (err) console.error(`Failed to open ${url}:`, err.message);
      else console.log(`[${index + 1}/${DIRECTORY_URLS.length}] Opened ${url}`);
    });
  }, index * 400); // 400ms stagger between tab opens
});
