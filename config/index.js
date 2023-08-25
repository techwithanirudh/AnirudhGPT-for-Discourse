// config.js

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || '';
const DISCOURSE_API_KEY = process.env.DISCOURSE_API_KEY;
const BASE_URL = 'https://amcforum.wiki';
const CHANNEL_NAME = 'general';
const CHANNEL_ID = 2;
const PREFIX = '@anirudhgpt';
const STAFF_LIST = [
	'techwithanirudh',
	'python660',
	'OmegaOrbitals',
	'SnakeByte',
];
const CONTEXT_LENGTH = 50;
const MODEL = 'text-moderation-latest';
const EVENT_CONF = {
	SRV_START: 'blue',
	WEBHOOK_ERR: 'red',
	PARSE_ERR: 'red',
	WEBHOOK: 'blue',
	PROCESSING: 'blue',
	PROCESSED: 'yellow',
	NEWMSG: 'magenta',
	ADD_QUEUE: 'yellow',
	FETCH_ERR: 'red',
	CHECK_ADMIN: 'blue',
	CHECK_ADMIN_ERR: 'red',
	MSG_SAVE_ERR: 'red',
	MSG_LOAD_ERR: 'red',
	OPENAI_ERR: 'red',
	SCORES: 'red',
	ACTION_TAKEN: 'red',
	hidden: [
		'NOTIF_ALL_MSG',
		'NOTIF_OLD_MSG',
		'NOTIF_NEW_MSG',
		'NOTIF_QUEUE',
		'Q_QUEUE',
		'NOTIF_LASTOLDMSG',
		'CHECK_CMD',
		'WEBHOOK',
		'NOTIF_CHANNEL_ID',
		'ADD_QUEUE',
		'NEWMSG'
	],
};

export {
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	DISCOURSE_API_KEY,
	BASE_URL,
	CHANNEL_NAME,
	CHANNEL_ID,
	PREFIX,
	STAFF_LIST,
	CONTEXT_LENGTH,
	MODEL,
	EVENT_CONF
};
