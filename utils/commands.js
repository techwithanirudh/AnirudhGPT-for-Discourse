import { event } from './logging';
import { editMessage, getMessages, isUserStaff } from './messageHandler';
import { saveOldMessages } from './messageStorage';
import OpenAI from 'openai';
import {
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	PROMPTS,
	PREFIX,
	MODEL,
	CONTEXT_LENGTH,
	COMMAND_PREFIXES,
} from '../config';

console.event = event;


const openai = new OpenAI({
	apiKey: OPENAI_API_KEY,
	baseURL: OPENAI_BASE_URL
});

// Define command map
const commands = {
	say: { handler: handleSay, staffOnly: true },
	help: { handler: handleHelp, staffOnly: false },
	suspend: { handler: handleSuspend, staffOnly: true },
	image: { handler: handleImage, staffOnly: false },
	// Prompt aliases
	prompt: { handler: handlePrompt, staffOnly: false },
	prompts: { handler: handlePrompt, staffOnly: false },
	p: { handler: handlePrompt, staffOnly: false },
	list: { handler: handleListMessages, staffOnly: false }
};

// Define command functions
async function handleSay(thinkingMsg, question, CHANNEL_NAME, CHANNEL_ID) {
	await editMessage(thinkingMsg, question, CHANNEL_NAME, CHANNEL_ID);

	console.event('ANSWERED', 'Said: ' + question);
}

async function handleHelp(thinkingMsg, _question, CHANNEL_NAME, CHANNEL_ID) {
	// Implement the help functionality
	const helpMessage = `
  **Available commands:**
  \`/say <message>\` - Make the bot say something
  \`/help\` - Show this help message
  \`/suspend\` - Suspend the bot
  \`/image <prompt>\` - Generate an image
  \`/prompt <prompt> <message>\` - Talk to a different prompt (Pre-defined)
  `;

	await editMessage(thinkingMsg, helpMessage, CHANNEL_NAME, CHANNEL_ID); // no, name before id.

	console.event('ANSWERED', helpMessage);
}

async function handleSuspend(thinkingMsg, _question, CHANNEL_NAME, CHANNEL_ID) {
	console.event('KILLCMD', 'Saving oldMessages...');

	// Load current messages from the channel
	const currentMessages = await getMessages(CHANNEL_NAME, CHANNEL_ID);

	// Save the current messages
	await saveOldMessages(CHANNEL_ID, currentMessages);

	console.event('KILLCMD', 'Killing process...');
	await editMessage(thinkingMsg, '[SUSPEND] Killing process...', CHANNEL_NAME, CHANNEL_ID);
	process.exit();
}

async function handleImage(thinkingMsg, question, CHANNEL_NAME, CHANNEL_ID) {
	const response = await openai.images.generate({
		prompt: question,
		n: 1,
		size: '1024x1024',
	});
	const image_url = response.data.data[0].url;

	const markdown = `![${question}](${image_url})`;
	await editMessage(thinkingMsg, markdown, CHANNEL_NAME, CHANNEL_ID);
	console.event('ANSWERED', markdown);
}

async function handleListMessages(thinkingMsg, question, CHANNEL_NAME, CHANNEL_ID) {
	const args = question.split(' ');

	const limit = args[1] || 35; // Default to 35 if not provided
	const user = args[0] || null; // Default to null if not provided

	// Fetch messages from the database
	const messages = await getMessages(CHANNEL_NAME, CHANNEL_ID);
	let filteredMessages = messages;

	// If a user is provided, filter messages by that user
	if (user) {
		filteredMessages = messages.filter(msg => msg.author === user);
	}

	// Limit the number of messages
	filteredMessages = filteredMessages.slice(0, limit);

	// Handle bot pings
	const pingRegex = new RegExp(PREFIX, 'ig');

	// Handle messages prefixed with a username
	const usernameRegex = /^@?[a-z0-9]{3,21}: /i;

	// Format the messages for display
	const formattedMessages = filteredMessages.map(msg => {
		let messageText = msg.text
			.replace(pingRegex, '`[BOT PING]`')
			.replace(usernameRegex, '');
		return `${msg.author}: ${messageText}`;
	}).join('\n');

	await editMessage(thinkingMsg, formattedMessages, CHANNEL_NAME, CHANNEL_ID);
	console.event('LISTED_MESSAGES', `Listed messages for ${user || 'all users'}`);
}


var questionAuthor;
// Function to check for commands
async function checkForCommand(thinkingMsg, question, CHANNEL_NAME, CHANNEL_ID) {
	for (const prefix of COMMAND_PREFIXES) {
		if (question.text.startsWith(prefix)) {
			const command = question.text.slice(1).split(' ')[0]; // Extract the command name
			const commandInfo = commands[command]; // Get the corresponding command info
			const parsedQuestion = question.text.slice(1 + command.length + 1); // Extract the question
			questionAuthor = question.author;

			if (commandInfo) {
				if (commandInfo.staffOnly && !(await isUserStaff(question.author))) {
					console.event(
						'PERMISSION_ERR',
						'User does not have permission to execute this command.'
					);
					await editMessage(
						thinkingMsg,
						'[ERROR] User does not have permission to execute this command.',
						CHANNEL_NAME,
						CHANNEL_ID
					);
					return true;
				} else {
					await commandInfo.handler(thinkingMsg, parsedQuestion, CHANNEL_NAME, CHANNEL_ID);
					return true;
				}
			} else {
				console.event('UNKNOWN_CMD', 'Unknown command.');
				await editMessage(thinkingMsg, '[ERROR] Unknown command.', CHANNEL_NAME, CHANNEL_ID);
				return true;
			}

			break; // Exit the loop after handling the command
		}
	}

	return false;
}

async function handlePrompt(thinkingMsg, question, CHANNEL_NAME, CHANNEL_ID) {
	const prompt = question.split(' ')[0];
	const actualQuestion = question.split(' ').slice(1).join(' ');

	const messages = await getMessages(CHANNEL_NAME, CHANNEL_ID);
	const contextMemory = messages.slice(-CONTEXT_LENGTH);
	contextMemory.pop();

	if (PROMPTS[prompt] && actualQuestion) {
		const openAIMessages = [
			...contextMemory.map((msg) => ({
				role: 'user',
				content: `${msg.author}: ${msg.text}`,
			})),
			{
				role: 'system',
				content: PROMPTS[prompt],
			},
			{
				role: 'user',
				content: `${questionAuthor}: ${actualQuestion}`,
			},
		];
		let completion = {
			data: { choices: [{ message: { content: 'Unknown Error' } }] },
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

			completion.data.choices[0].message.content = messageContent;
		}

		const completionText = completion.data.choices[0].message.content;

		// Handle bot pings
		const pingRegex = new RegExp(PREFIX, 'ig');

		// Handle messages prefixed with a username
		const usernameRegex = /^@?[a-z0-9]{3,21}: /i;

		const filteredText = completionText
			.replace(pingRegex, '`[BOT PING]`')
			.replace(usernameRegex, '');

		await editMessage(thinkingMsg, filteredText, CHANNEL_NAME, CHANNEL_ID);

		console.event('ANSWERED', completionText);
	} else {
		await editMessage(
			thinkingMsg,
			`[ERROR] Format incomplete or unknown prompt.

[HELP] /prompt <model> <question>
prompt - One of ${Object.keys(PROMPTS).join(', ')}
question - A question`,
			CHANNEL_NAME,
			CHANNEL_ID
		);
		console.event(
			'UNKNOWN_PROMPT',
			`[ERROR] Format incomplete or unknown prompt.`
		);
	}
}

export default checkForCommand;
