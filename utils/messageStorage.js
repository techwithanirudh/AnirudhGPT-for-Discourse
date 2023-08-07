import { writeFile, readFileSync } from 'fs';

// Function to save oldMessages to a JSON file for persistence
function saveOldMessagesToFile(messages) {
	writeFile("data/oldMessages.json", JSON.stringify(messages), (err) => {
		if (err) {
			console.error("Error saving old messages:", err);
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
			console.log("oldMessages.json not found. Creating a new file.");
			saveOldMessagesToFile([]);
			return [];
		} else {
			console.error("[ERROR] Error loading old messages:", err);
			return [];
		}
	}
}

export { saveOldMessagesToFile, loadOldMessagesFromFile };
