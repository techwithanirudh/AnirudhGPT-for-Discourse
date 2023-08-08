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
import { OPENAI_API_KEY, OPENAI_BASE_URL, SYSTEM_PROMPT, PREFIX, CONTEXT_LENGTH, MODEL, REFRESH_TIME } from './config';

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
			console.log(
				'[NEW MSG] From:',
				chatMessageObj.author,
				'with content:',
				chatMessage
			);
			const question = chatMessage.replace(PREFIX, '').trim();

			if (question.includes("/suspend")) {
				if (isUserStaff(chatMessageObj.author)) {
					// Then check if is staff
					console.log('[KILLCMD] Killing process...');
					await postMessage('[KILLCMD] Killing process...')
					process.exit();
				} else {
					console.log('[KILLCMD] Failed due to message is not from admin / moderator...')
					await postMessage('[KILLCMD] Failed due to message is not from admin / moderator...')
				}
			}

			else if (question && !questionQueue.includes(question)) {
				console.log('[ADD QUEUE] Adding question to queue:', question);
				addToQueue({ 
					author: chatMessageObj.author,
					text: question
				});
			}
		}
	}
}

async function answerQuestion(question) {
	console.log(`[PROCESS] Answering: ${question.text}`);
	const contextMemory = messages.slice(-CONTEXT_LENGTH);
	contextMemory.pop();
  // console.log(`[PROCESS LOG] Context memory:`, contextMemory);
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
	await postMessage(completionText);
	console.log(`[ANSWERED] ${completionText}`);
}

async function mainLoop() {
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
		console.error('Error:', error);
	}
}

async function main() {
	console.log('Starting Chatbot...');

	oldMessages = loadOldMessagesFromFile();

	mainLoop();
	setInterval(mainLoop, REFRESH_TIME * 1000);
}

main();
