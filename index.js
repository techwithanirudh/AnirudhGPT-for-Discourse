import express from 'express';
import { Configuration, OpenAIApi } from 'openai';
import {
	postMessage,
	getMessages,
	includesPrefix,
	isUserStaff,
} from './utils';
import {
	saveOldMessagesToFile,
	loadOldMessagesFromFile,
} from './utils';
import {
	addToQueue,
	getNextQuestion,
	questionQueue
} from './utils';
import { OPENAI_API_KEY, OPENAI_BASE_URL, SYSTEM_PROMPT, PREFIX, CONTEXT_LENGTH, MODEL } from './config';
import { event } from './utils';
import checkForCommand from './utils/commands';

console.event = event;

const app = express();
const port = 3000; // Change to the desired port number

app.use(express.json());

const configuration = new Configuration({
	apiKey: OPENAI_API_KEY,
	basePath: OPENAI_BASE_URL,
});
const openai = new OpenAIApi(configuration);

let messages = {};

async function processNewMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID) {
	const lastOldMessage = oldMessages.length > 0 ? oldMessages[oldMessages.length - 1] : { timestamp: 0 };
	console.event("NOTIF_LASTOLDMSG", JSON.stringify(lastOldMessage))
	const newMessages = messages[CHANNEL_ID].filter(
		(msg) => new Date(msg.timestamp) > new Date(lastOldMessage.timestamp)
	);

	if (messages[CHANNEL_ID].length > 0 && oldMessages.length > 0) {
		console.event("NOTIF_ALL_MSG", JSON.stringify(messages[CHANNEL_ID].slice(-2)));
		console.event("NOTIF_OLD_MSG", JSON.stringify(oldMessages.slice(-2)));
		console.event("NOTIF_NEW_MSG", JSON.stringify(newMessages));
	}

	for (const chatMessageObj of newMessages) {
		const chatMessage = chatMessageObj.text;

		if (includesPrefix(chatMessage)) {
			console.event('NEWMSG', `From: ${chatMessageObj.author}. Content: ${chatMessage}`);
			const question = chatMessage.replace(PREFIX, '').trim();

			if (question && !questionQueue.some(q => q.text === question)) {
				console.event("NOTIF_QUEUE", JSON.stringify(questionQueue))
				console.event('ADD_QUEUE', `Adding question to queue: ${question}`);

				addToQueue({
					id: chatMessageObj.id,
					author: chatMessageObj.author,
					text: question,
					CHANNEL_NAME: CHANNEL_NAME,
					CHANNEL_ID: CHANNEL_ID
				});
			}
		}
	}
}

async function answerQuestion(question) {
	console.event("PROCESS", `CHANNEL: ${question.CHANNEL_NAME}. Answering: ${question.text}`);
	let { CHANNEL_NAME, CHANNEL_ID } = question;
	
	const isCommand = await checkForCommand(question, CHANNEL_NAME, CHANNEL_ID);
	console.event('CHECK_CMD', isCommand)
	if (isCommand) return;

	const contextMemory = messages[CHANNEL_ID].slice(-CONTEXT_LENGTH);
	contextMemory.pop();

	const openAIMessages = [
		{
			role: 'system',
			content: SYSTEM_PROMPT,
		},
		...contextMemory.map((msg) => ({
			role: 'user',
			content: `${msg.author}: ${msg.text}`,
		})),
		{
			role: 'user',
			content: `${question.author}: ${question.text}`,
		},
	];
	let completion = { "data": { "choices": [{ "message": { "content": "Unknown Error" } }] } }

	try {
		completion = await openai.createChatCompletion({
			model: MODEL,
			messages: openAIMessages,
		});
	} catch (error) {
		console.event('OPENAI_ERR', error)
		completion.data.choices[0].message.content = `An error occurred:\n\`\`\`markdown\n${error}\n\`\`\``;
	}

	const completionText = completion.data.choices[0].message.content;

	// Handle bot pings
	const pingRegex = new RegExp(PREFIX, 'ig');

  // Handle messages prefixed with a username
  const usernameRegex = /^@?[a-z0-9]{3,21}: /i
    
	const filteredText = completionText
        .replace(pingRegex, '`[BOT PING]`')
        .replace(usernameRegex, '');
    
	await postMessage(filteredText, CHANNEL_NAME, CHANNEL_ID);

	console.event('ANSWERED', completionText);
}

async function checkForMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID) {
	console.event("Q_QUEUE", questionQueue)
	try {
		messages[CHANNEL_ID] = await getMessages(CHANNEL_NAME, CHANNEL_ID);
		if (JSON.stringify(messages[CHANNEL_ID]) !== JSON.stringify(oldMessages)) {
			processNewMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID);

			saveOldMessagesToFile(messages);
			oldMessages = messages[CHANNEL_ID];
		}

		if (questionQueue.length > 0) {
			const nextQuestion = getNextQuestion();
			await answerQuestion(nextQuestion);
			await checkForMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID);
		}
	} catch (error) {
		console.event('PARSE_ERR', error)
	}
}

// Main route
app.get('/', (req, res) => {
	// console.event('HOME', 'PING')
	res.status(200).send('Pong');
});

// Webhook route for receiving new messages
app.post('/webhook', async (req, res) => {
	try {
		console.event('WEBHOOK', 'Webhook triggered')

		const { chat_channel_slug, chat_channel_id } = req.body.notification.data;
		var CHANNEL_NAME = chat_channel_slug;
		var CHANNEL_ID = chat_channel_id.toString();
		console.event("NOTIF_CHANNEL_ID", CHANNEL_ID);
		let oldMessages = loadOldMessagesFromFile(CHANNEL_ID); // load
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