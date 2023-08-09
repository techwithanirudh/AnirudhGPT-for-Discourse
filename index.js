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

console.event = event;

const app = express();
const port = 3000; // Change to the desired port number

app.use(express.json());

const configuration = new Configuration({
	apiKey: OPENAI_API_KEY,
	basePath: OPENAI_BASE_URL,
});
const openai = new OpenAIApi(configuration);

let messages = [];
let oldMessages = [];

async function processNewMessages() {
	const newMessages = messages.filter(
		(msg) => !oldMessages.some((oldMsg) => oldMsg.id === msg.id)
	);

	console.event("NOTIF_ALL_MSG", JSON.stringify(messages.slice(-2)));
	console.event("NOTIF_OLD_MSG", JSON.stringify(oldMessages.slice(-2)));
	console.event("NOTIF_NEW_MSG", JSON.stringify(newMessages));

	for (const chatMessageObj of newMessages) {
		const chatMessage = chatMessageObj.text;

		if (includesPrefix(chatMessage)) {
			console.event('NEWMSG', `From: ${chatMessageObj.author}. Content: ${chatMessage}`);
			const question = chatMessage.replace(PREFIX, '').trim();

			if (question.includes("/suspend")) {
				if (isUserStaff(chatMessageObj.author)) {
					// Then check if is staff
					console.event('KILLCMD', 'Killing process...');
					await postMessage('[SUSPEND] Killing process...')
					process.exit();
				} else {
					console.event('KILLCMD_ERR', 'Failed because message is not from an admin / moderator...')
					await postMessage('[ERROR] Failed because message is not from an admin / moderator...')
				}
			}

			else if (question && !questionQueue.includes(question)) {
				console.event('ADD_QUEUE', `Adding question to queue: ${question}`);
				addToQueue({
					author: chatMessageObj.author,
					text: question
				});
			}
		}
	}
}

async function answerQuestion(question) {
	console.event("PROCESS", `Answering: ${question.text}`);

	const contextMemory = messages.slice(-CONTEXT_LENGTH);
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
	const regex = new RegExp(PREFIX, 'ig');

	const modifiedText = completionText.replace(regex, '[BOT PING]');
	await postMessage(modifiedText);

	console.event('ANSWERED', completionText);
}

async function checkForMessages() {
	try {
		messages = await getMessages();
		if (JSON.stringify(messages) !== JSON.stringify(oldMessages)) {
			await processNewMessages();

			saveOldMessagesToFile(messages);
			oldMessages = messages;
		}

		if (questionQueue.length > 0) {
			const nextQuestion = getNextQuestion();
			await answerQuestion(nextQuestion);
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
		//console.log(req)
		// console.event("NOTIF_FULL", JSON.stringify(req))
		console.event("NOTIF_BODY", JSON.stringify(req.body))

		oldMessages = loadOldMessagesFromFile();
		await checkForMessages();

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