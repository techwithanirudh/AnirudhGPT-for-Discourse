// HOW TO RUN:
// RUN: node --experimental-specifier-resolution=node sendMessage.js

import { postMessage } from './utils';

const TROLL_MESSAGE = `Nuclear launch succeeded. ETA: 3:54:12.`;
postMessage(TROLL_MESSAGE, 'general', '2');
console.log(TROLL_MESSAGE);
