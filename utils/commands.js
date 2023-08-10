import { event } from "./logging";
import { isUserStaff, postMessage } from "./messageHandler";
import { Configuration, OpenAIApi } from 'openai';
import { OPENAI_API_KEY, OPENAI_BASE_URL } from '../config';

console.event = event;

const configuration = new Configuration({
    apiKey: OPENAI_API_KEY,
    basePath: OPENAI_BASE_URL,
});
const openai = new OpenAIApi(configuration);

// Define command map
const commands = {
    "say": { handler: handleSay, staffOnly: true },
    "help": { handler: handleHelp, staffOnly: false },
    "suspend": { handler: handleSuspend, staffOnly: true },
    "image": { handler: handleImage, staffOnly: false }
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
    \`/image\` - Generate an image
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
        size: "1024x1024",
    });
    const image_url = response.data.data[0].url;

    const markdown = `![Generated image](${image_url})`;
    await postMessage(markdown, CHANNEL_NAME, CHANNEL_ID);
}

// Function to check for commands
async function checkForCommand(question, CHANNEL_NAME, CHANNEL_ID) {
    const commandPrefixes = ["@", "/"]; // Define the prefixes for commands

    for (const prefix of commandPrefixes) {
        if (question.text.startsWith(prefix)) {
            const command = question.text.slice(1).split(' ')[0]; // Extract the command name
            const commandInfo = commands[command]; // Get the corresponding command info
            const parsedQuestion = question.text.slice(1 + command.length + 1); // Extract the question

            if (commandInfo) {
                if (commandInfo.staffOnly && !(await isUserStaff(question.author))) {
                    console.event('PERMISSION_ERR', 'User does not have permission to execute this command.');
                    await postMessage('[ERROR] User does not have permission to execute this command.', CHANNEL_NAME, CHANNEL_ID);
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

export default checkForCommand;