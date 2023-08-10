// HOW TO RUN:
// RUN: node --experimental-specifier-resolution=node sendMessage.js

import { postMessage } from "./utils";

const TROLL_MESSAGE = `Hello world!

- This message is sent by a human`
postMessage(TROLL_MESSAGE, "anirudhgpt", "1")