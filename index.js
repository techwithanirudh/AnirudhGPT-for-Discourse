import express from 'express';
import OpenAI from 'openai';
import {
	postMessageWithRetries,
	editMessage,
	getMessages,
	includesPrefix,
} from './utils';
import { saveOldMessages, loadOldMessages } from './utils';
import { addToQueue, questionQueue } from './utils';
import {
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	SYSTEM_PROMPT,
	PREFIX,
	CONTEXT_LENGTH,
	MODEL,
} from './config';
import { event } from './utils';
import checkForCommand from './utils/commands';

console.event = event;

const app = express();
const port = 3000; // Change to the desired port number

app.use(express.json());

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY,
	baseURL: OPENAI_BASE_URL,
});

let messages = {};

async function processNewMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID) {
	const lastOldMessage =
		oldMessages.length > 0
			? oldMessages[oldMessages.length - 1]
			: { timestamp: 0 };
	console.event('NOTIF_LASTOLDMSG', JSON.stringify(lastOldMessage));
	const newMessages = messages[CHANNEL_ID].filter(
		(msg) => new Date(msg.timestamp) > new Date(lastOldMessage.timestamp)
	);

	if (messages[CHANNEL_ID].length > 0 && oldMessages.length > 0) {
		console.event(
			'NOTIF_ALL_MSG',
			JSON.stringify(messages[CHANNEL_ID].slice(-2))
		);
		console.event('NOTIF_OLD_MSG', JSON.stringify(oldMessages.slice(-2)));
		console.event('NOTIF_NEW_MSG', JSON.stringify(newMessages));
	}

	for (const chatMessageObj of newMessages) {
		const chatMessage = chatMessageObj.text;

		if (includesPrefix(chatMessage)) {
			console.event(
				'NEWMSG',
				`From: ${chatMessageObj.author}. Content: ${chatMessage}`
			);
			const question = chatMessage.replace(PREFIX, '').trim();

			if (question && !questionQueue.some((q) => q.id === chatMessageObj.id)) {
				console.event('NOTIF_QUEUE', JSON.stringify(questionQueue));
				console.event('ADD_QUEUE', `Adding question to queue: ${question}`);

				addToQueue({
					id: chatMessageObj.id,
					author: chatMessageObj.author,
					text: question,
					CHANNEL_NAME: CHANNEL_NAME,
					CHANNEL_ID: CHANNEL_ID,
					answered: false,
				});
			}
		}
	}
}

async function answerQuestion(question) {
	question.answered = true;

	console.event(
		'PROCESS',
		`CHANNEL: ${question.CHANNEL_NAME}. Answering: ${question.text}`
	);
	let { CHANNEL_NAME, CHANNEL_ID } = question;

	const THINKING_MSG = `Hmm... :thinking:`;

	const message = await postMessageWithRetries(
		THINKING_MSG,
		CHANNEL_NAME,
		CHANNEL_ID
	);

	const isCommand = await checkForCommand(
		message,
		question,
		CHANNEL_NAME,
		CHANNEL_ID
	);
	console.event('CHECK_CMD', isCommand);
	if (isCommand) return;

	const contextMemory = messages[CHANNEL_ID].slice(-CONTEXT_LENGTH);
	contextMemory.pop();

	const openAIMessages = [
		...contextMemory.map((msg) => ({
			role: 'user',
			content: `${msg.author}: ${msg.text}`,
		})),
		{
			role: 'system',
			content: SYSTEM_PROMPT,
		},
		{
			role: 'user',
			content: `${question.author}: ${question.text}`,
		},
	];
	let completion = {
		choices: [{ message: { content: 'Unknown Error' } }],
	};

	try {
		completion = await openai.chat.completions.create({
			model: MODEL,
			messages: openAIMessages,
		});
	} catch (error) {
		console.event('OPENAI_ERR', error);
		const messageContent = error.response
			? `An error occurred:\n\`\`\`markdown\n${error.response.status}: ${error.response.data.detail}\n\`\`\``
			: `An error occurred:\n\`\`\`markdown\n${error}\n\`\`\``;

		completion.choices[0].message.content = messageContent;
	}

	const completionText = completion.choices[0].message.content;

	// Handle bot pings
	const pingRegex = new RegExp(PREFIX, 'ig');

	// Handle messages prefixed with a username
	const usernameRegex = /^@?[a-z0-9]{3,21}: /i;

	const filteredText = completionText
		.replace(pingRegex, '`[BOT PING]`')
		.replace(usernameRegex, '');

	await editMessage(message, filteredText, CHANNEL_NAME, CHANNEL_ID);

	console.event('ANSWERED', completionText);
}

async function checkForMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID) {
	console.event('Q_QUEUE', questionQueue);
	try {
		messages[CHANNEL_ID] = await getMessages(CHANNEL_NAME, CHANNEL_ID);
		if (JSON.stringify(messages[CHANNEL_ID]) !== JSON.stringify(oldMessages)) {
			// console.log(oldMessages.slice(0, 5), messages[CHANNEL_ID].slice(0, 5))
			processNewMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID);

			saveOldMessages(CHANNEL_ID, messages[CHANNEL_ID]);
			oldMessages = messages[CHANNEL_ID];
		}

		// Filter out questions that have been answered
		const unansweredQuestions = questionQueue.filter((q) => !q.answered);

		if (unansweredQuestions.length > 0) {
			const nextQuestion = unansweredQuestions[0]; // Get the next unanswered question
			await answerQuestion(nextQuestion);
			await checkForMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID);
		}
	} catch (error) {
		console.event('PARSE_ERR', error);
	}
}

// Main route
app.get('/', (req, res) => {
	res
		.status(200)
		.send('AnirudhGPT is An AI Comment Bot, created by Anirudh Sriram.');
});

// Webhook route for receiving new messages
app.all('/webhook', async (req, res) => {
	try {
		var { chat_channel_slug, chat_channel_id } = {
			chat_channel_slug: '',
			chat_channel_id: '',
		};

		if (req.method === 'GET') {
			var { chat_channel_slug, chat_channel_id } = req.query;
		} else if (req.method === 'POST') {
			var { chat_channel_slug, chat_channel_id } = req.body.notification.data;
		} else {
			return res.sendStatus(405);
		}

		if (chat_channel_slug === '' && chat_channel_id === '')
			return res.sendStatus(400);

		console.event('WEBHOOK', 'Webhook triggered');

		var CHANNEL_NAME = chat_channel_slug;
		var CHANNEL_ID = chat_channel_id && chat_channel_id.toString();
		console.event('NOTIF_CHANNEL_ID', CHANNEL_ID);
		let oldMessages = await loadOldMessages(CHANNEL_ID); // load
		messages[CHANNEL_ID] = messages[CHANNEL_ID] ? messages[CHANNEL_ID] : [];

		await checkForMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID);

		res.status(200).send('[WEBHOOK] Message received and processed.');
	} catch (error) {
		console.event('WEBHOOK_ERR', error);
		res.status(500).send('[WEBHOOK_ERR] Error processing message.');
	}
});

// Start the Express server
app.listen(port, () => {
	console.event('SRV_START', `Server is listening on port ${port}`);
});
