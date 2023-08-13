import { event } from './logging';
import { getMessages, isUserStaff, postMessage } from './messageHandler';
import { Configuration, OpenAIApi } from 'openai';
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

const configuration = new Configuration({
	apiKey: OPENAI_API_KEY,
	basePath: OPENAI_BASE_URL,
});
const openai = new OpenAIApi(configuration);

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
};

// Define command functions
async function handleSay(question, CHANNEL_NAME, CHANNEL_ID) {
	await postMessage(question, CHANNEL_NAME, CHANNEL_ID);

	console.event('ANSWERED', 'Said: ' + question);
}

async function handleHelp(_question, CHANNEL_NAME, CHANNEL_ID) {
	// Implement the help functionality
	const helpMessage = `
  **Available commands:**
  \`/say <message>\` - Make the bot say something
  \`/help\` - Show this help message
  \`/suspend\` - Suspend the bot
  \`/image <prompt>\` - Generate an image
  \`/prompt <prompt> <message>\` - Talk to a different prompt (Pre-defined)
  `;

	await postMessage(helpMessage, CHANNEL_NAME, CHANNEL_ID); // no, name before id.

	console.event('ANSWERED', helpMessage);
}

async function handleSuspend(_question, CHANNEL_NAME, CHANNEL_ID) {
	console.event('KILLCMD', 'Killing process...');
	await postMessage('[SUSPEND] Killing process...', CHANNEL_NAME, CHANNEL_ID);
	process.exit();
}

async function handleImage(question, CHANNEL_NAME, CHANNEL_ID) {
	const response = await openai.createImage({
		prompt: question,
		n: 1,
		size: '1024x1024',
	});
	const image_url = response.data.data[0].url;

	const markdown = `![${question}](${image_url})`;
	await postMessage(markdown, CHANNEL_NAME, CHANNEL_ID);
	console.event('ANSWERED', markdown);
}

// Function to check for commands
async function checkForCommand(question, CHANNEL_NAME, CHANNEL_ID) {
	for (const prefix of COMMAND_PREFIXES) {
		if (question.text.startsWith(prefix)) {
			const command = question.text.slice(1).split(' ')[0]; // Extract the command name
			const commandInfo = commands[command]; // Get the corresponding command info
			const parsedQuestion = question.text.slice(1 + command.length + 1); // Extract the question

			if (commandInfo) {
				if (commandInfo.staffOnly && !(await isUserStaff(question.author))) {
					console.event(
						'PERMISSION_ERR',
						'User does not have permission to execute this command.'
					);
					await postMessage(
						'[ERROR] User does not have permission to execute this command.',
						CHANNEL_NAME,
						CHANNEL_ID
					);
					return true;
				} else {
					await commandInfo.handler(parsedQuestion, CHANNEL_NAME, CHANNEL_ID);
					return true;
				}
			} else {
				console.event('UNKNOWN_CMD', 'Unknown command.');
				await postMessage('[ERROR] Unknown command.', CHANNEL_NAME, CHANNEL_ID);
				return true;
			}

			break; // Exit the loop after handling the command
		}
	}

	return false;
}

async function handlePrompt(question, CHANNEL_NAME, CHANNEL_ID) {
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
				content: `${question.author}: ${actualQuestion}`,
			},
		];
		let completion = {
			data: { choices: [{ message: { content: 'Unknown Error' } }] },
		};

		try {
			completion = await openai.createChatCompletion({
				model: MODEL,
				messages: openAIMessages,
			});
		} catch (error) {
			console.event('OPENAI_ERR', error);
			const messageContent = error.response
				? `An error occurred:\n\`\`\`markdown\n${error.response.status}: ${error.response.statusText}\n\`\`\``
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

		await postMessage(filteredText, CHANNEL_NAME, CHANNEL_ID);

		console.event('ANSWERED', completionText);
	} else {
		await postMessage(
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
