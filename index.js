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
import { OPENAI_API_KEY, OPENAI_BASE_URL, SYSTEM_PROMPT, PREFIX } from './config';

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
  basePath: OPENAI_BASE_URL,
});
const openai = new OpenAIApi(configuration);

let messages = [];
let oldMessages = [];

async function processNewMessages() {
  const newMessages = messages.filter(
    (msg) => !oldMessages.some((oldMsg) => oldMsg.msg === msg.msg)
  );

  for (const chatMessageObj of newMessages) {
    const chatMessage = chatMessageObj.msg;

    if (includesPrefix(chatMessage)) {
      console.log(
        '[NEW MSG] From:',
        chatMessageObj.user,
        'with content:',
        chatMessage
      );
      const question = chatMessage.replace(PREFIX, '').trim();

			if (question.includes("/suspend")) {
				if (isUserStaff(chatMessageObj.user)) {
	 				// Then check if is staff
	        console.log('[KILLCMD] Killing process...');
					await postMessage('[KILLCMD] Killing process...')
	        process.exit();      
				} else {
					console.log('[KILLCMD] Failed due to message is not from admin / moderator...')
					await postMessage('[KILLCMD] Failed due to message is not from admin / moderator...')
				}
			}
			
      if (question && !questionQueue.includes(question)) {
        console.log('[ADD QUEUE] Adding question to queue:', question);
        addToQueue(question);
      }
    }
  }
}

async function answerQuestion(question) {
  console.log(`[PROCESS] Answering: ${question}`);

  const openAIMessages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
		// TODO: Add context memory
    {
      role: 'user',
      content: question,
    },
  ];

  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
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
  setInterval(mainLoop, 5000);
}

main();
