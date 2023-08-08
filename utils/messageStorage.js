import { writeFile, readFileSync } from 'fs';
import { event } from './logging';

console.event = event;

// Function to save oldMessages to a JSON file for persistence
function saveOldMessagesToFile(messages) {
	writeFile("data/oldMessages.json", JSON.stringify(messages), (err) => {
		if (err) {
			console.event("MSG_SAVE_ERR", err);
		}
	});
}

// Function to load oldMessages from the JSON file
function loadOldMessagesFromFile() {
	try {
		const data = readFileSync("data/oldMessages.json");
		return JSON.parse(data);
	} catch (err) {
		if (err.code === "ENOENT") {
			console.event("MSG_LOAD_ERR", "oldMessages.json not found. Creating a new file.");
			saveOldMessagesToFile([]);
			return [];
		} else {
			console.event('MSG_LOAD_ERR', err);
			return [];
		}
	}
}

export { saveOldMessagesToFile, loadOldMessagesFromFile };
