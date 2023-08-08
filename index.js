import express from 'express';
import ora from 'ora';
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
		(msg) => !oldMessages.some((oldMsg) => oldMsg.text === msg.text)
	);

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
					text: question ? question : 'Answer the above question.'
				});
			}
		}
	}
}

async function answerQuestion(question) {
	// flashy at times.
	// committed yet?
	const spinner = ora(`[PROCESS] Answering: ${question.text}`).start();
  console.log("")

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

	const completion = await openai.createChatCompletion({
		model: MODEL,
		messages: openAIMessages,
	});

	const completionText = completion.data.choices[0].message.content;

	// Handle bot pings
	const regex = new RegExp(PREFIX, 'ig');
	const modifiedText = completionText.replace(regex, '[BOT PING]');
	await postMessage(modifiedText);

	spinner.stop();
	console.event('ANSWERED', completionText);
}

async function checkForMessages() {
	try {
		messages = await getMessages();
		if (JSON.stringify(messages) !== JSON.stringify(oldMessages)) {
			processNewMessages();

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
		//console.log(req)
		// console.event("NOTIF_FULL", JSON.stringify(req))
		console.event("NOTIF_BODY", JSON.stringify(req.body))

		oldMessages = loadOldMessagesFromFile();
		checkForMessages();

		console.event('WEBHOOK', 'Webhook triggered')
		res.status(200).send('[WEBHOOK] Message received and processed.');
	} catch (error) {
		console.event('WEBHOOK_ERR', error);
		res.status(500).send('[WEBHOOK_ERR] Error processing message.');
	}
});

// Start the Express server
app.listen(port, () => {
	console.event('SRV_START', `Server is listening on port ${port}`);
  oldMessages = loadOldMessagesFromFile();
	checkForMessages();
  // Init check
});
//all done!