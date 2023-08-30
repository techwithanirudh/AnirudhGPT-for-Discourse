// config.js

const DISCOURSE_API_KEY = process.env.DISCOURSE_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const BASE_URL = 'https://amcforum.wiki';
const CHANNEL_NAME = 'general';
const CHANNEL_ID = 2;
const PREFIX = '@anirudhgpt';
const BOT_NAME = 'anirudhgpt';
const FROM_EMAIL_ADDRESS = 'automod@techwithanirudh.com';
const TO_EMAIL_ADDRESS = 'techwithanirudh@protonmail.com';
const STAFF_LIST = [
	'techwithanirudh',
	'python660',
	'OmegaOrbitals',
	'SnakeByte',
];
const CONTEXT_LENGTH = 50;
const MODEL = 'TOXICITY';
const MAX_RETRIES = 50;
const MIN_SCORE = 0.9;
const EVENT_CONF = {
	SRV_START: 'blue',
	WEBHOOK_ERR: 'red',
	PARSE_ERR: 'red',
	WEBHOOK: 'blue',
	PROCESSING: 'blue',
	RETRY_AFTER: 'blue',
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
	DISCOURSE_API_KEY,
	SENDGRID_API_KEY,
	BASE_URL,
	CHANNEL_NAME,
	CHANNEL_ID,
	PREFIX,
	BOT_NAME,
	FROM_EMAIL_ADDRESS,
	TO_EMAIL_ADDRESS,
	MIN_SCORE,
	STAFF_LIST,
	CONTEXT_LENGTH,
	MAX_RETRIES,
	MODEL,
	EVENT_CONF
};
