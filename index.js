import express from 'express';
import { postMessageWithRetries, getMessages, includesPrefix, createModeration, sendEmail, getChatChannel, reactToMessage } from './utils';
import { saveOldMessages, loadOldMessages } from './utils';
import { addToQueue, questionQueue } from './utils';
import {
	MIN_SCORE,
	MODEL,
	BOT_NAME
} from './config';
import { event } from './utils';

console.event = event;

const app = express();
const port = 3000; // Change to the desired port number

app.use(express.json());

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
			const question = chatMessage.trim();

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
	// Mark the question as answered
	question.answered = true;

	// If the author is the bot, exit the function
	if (question.author === BOT_NAME) return;

	// Log the processing event
	console.event('PROCESSING', `CHANNEL: ${question.CHANNEL_NAME}. Message: ${question.text}`);

	// Destructure relevant properties from the question
	const { CHANNEL_NAME, CHANNEL_ID } = question;

	// Get the moderation results for the question text
	const moderation = await createModeration({
		input: question.text,
		model: MODEL
	});

	// Check if the message exceeds the toxicity threshold
	if (moderation.attributeScores?.TOXICITY?.summaryScore?.value >= MIN_SCORE) {
		const flaggedCategories = Object.entries(moderation.attributeScores)
			.filter(([_, attributeData]) => attributeData.summaryScore?.value >= MIN_SCORE)
			.map(([key]) => key);

		const CHNL_DATA = await getChatChannel(question.author);

		const RESPONSE_MSG = `
@${question.author}, 

Your message was flagged for potential violations of our community guidelines. Please review our guidelines and ensure future messages adhere to them.

[spoiler]\n\`\`\`msgquot\n${question.text.replace("`", "`⁣")}\n\`\`\`\n[/spoiler]
`;

		const EMAIL_SUBJECT = `Flagged Message Alert in ${CHANNEL_NAME}`;
		const EMAIL_BODY = `
Dear Staff,

A message from ${question.author} in ${CHANNEL_NAME} has been flagged for potential violations of our community guidelines.

Reasons for flagging: ${flaggedCategories.join(', ')}.

Message content:
"${question.text}"

Please review the message and take appropriate action if necessary. We aim to maintain a positive and respectful environment in our community, and your assistance in this matter is greatly appreciated.

Best regards,
[Automated Moderation System]
`;

		await sendEmail(EMAIL_BODY, EMAIL_SUBJECT);

		console.event('SCORES', JSON.stringify(moderation.attributeScores));
		console.event('ACTION_TAKEN', question.text);

		await reactToMessage(question, '-1', CHANNEL_NAME, CHANNEL_ID)
		await postMessageWithRetries(RESPONSE_MSG, CHNL_DATA.username, CHNL_DATA.id);
	}

	console.event('PROCESSED', question.text);
}

async function checkForMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID) {
	console.event('Q_QUEUE', questionQueue);
	try {
		messages[CHANNEL_ID] = await getMessages(CHANNEL_NAME, CHANNEL_ID);
		if (JSON.stringify(messages[CHANNEL_ID]) !== JSON.stringify(oldMessages)) {
			processNewMessages(oldMessages, CHANNEL_NAME, CHANNEL_ID);

			saveOldMessages(CHANNEL_ID, messages[CHANNEL_ID]);
			oldMessages = messages[CHANNEL_ID];
		}

		// Filter out questions that have been answered
		const unansweredQuestions = questionQueue.filter(q => !q.answered);

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
	res.status(200).send('AutoMod is An AI Comment Bot, created by Anirudh Sriram.');
});

// Webhook route for receiving new messages
app.all('/webhook', async (req, res) => {
	try {
		var { chat_channel_slug, chat_channel_id } = { chat_channel_slug: '', chat_channel_id: '' };

		if (req.method === 'GET') {
			var { chat_channel_slug, chat_channel_id } = req.query;
		} else if (req.method === 'POST') {
			var { chat_channel_slug, chat_channel_id } = req.body.notification.data;
		} else {
			return res.sendStatus(405)
		}

		if (chat_channel_slug === '' && chat_channel_id === '') return res.sendStatus(400)

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

setInterval(async () => {
	await fetch('https://automod-for-discourse.techwithanirudh.repl.co/webhook?chat_channel_slug=general&chat_channel_id=2')
	await fetch('https://automod-for-discourse.techwithanirudh.repl.co/webhook?chat_channel_slug=automod-testing&chat_channel_id=236')
	await fetch('https://automod-for-discourse.techwithanirudh.repl.co/webhook?chat_channel_slug=anirudhgpt&chat_channel_id=154')
}, 15000)

// Start the Express server
app.listen(port, () => {
	console.event('SRV_START', `Server is listening on port ${port}`);
});
