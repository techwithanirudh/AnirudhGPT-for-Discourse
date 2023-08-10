import { writeFile, readFileSync } from 'fs';
import { event } from './logging';

console.event = event;

// Function to save oldMessages to a JSON file for persistence
function saveOldMessagesToFile(messages) {
	writeFile('data/oldMessages.json', JSON.stringify(messages), (err) => {
		if (err) {
			console.event('MSG_SAVE_ERR', err);
		}
	});
}

// Function to load oldMessages from the JSON file
function loadOldMessagesFromFile(CHANNEL_ID) {
	try {
		const data = readFileSync('data/oldMessages.json');
		if (!data) {
			console.event(
				'MSG_LOAD_ERR',
				'oldMessage.json has no content. Rewriting.'
			);
			saveOldMessagesToFile({});
			return [];
		}
		let retdata = JSON.parse(data)[CHANNEL_ID];
		return retdata ? retdata : [];
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.event(
				'MSG_LOAD_ERR',
				'oldMessages.json not found. Creating a new file.'
			);
			saveOldMessagesToFile({});
			return [];
		} else {
			console.event('MSG_LOAD_ERR', err);
			return [];
		}
	}
}

export { saveOldMessagesToFile, loadOldMessagesFromFile };
