import fs from 'fs';
import { event } from '../utils';
import pkg from 'bad-words';
const Filter = pkg;

console.event = event;

function readWordsFromFile(filePath) {
	try {
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		return fileContent.split('\n').filter((word) => word.trim().length > 0);
	} catch (error) {
		console.error('Error reading file:', error.message);
		return [];
	}
}

function addSpecialChars(word) {
	const specialChar = '\u2063'; // Unicode character for "INVISIBLE SEPARATOR"
	return [...word].join(specialChar);
}

function censorText(inputText, customFilter) {
	const words = inputText.split(' ');
	const censoredWords = words.map((word) => {
		if (customFilter.isProfane(word)) {
			return addSpecialChars(word); // False positive words with special characters
		}
		return word;
	});
	return censoredWords.join(' ');
}

function censor(inputText, filePath) {
	var filePath = filePath || 'data/badWords.txt';

	const customFilterWords = readWordsFromFile(filePath);
	const customFilter = new Filter({ list: customFilterWords });
	const defaultFilter = new Filter();

	// Process false positive words with no special characters
	const cleanedText = inputText
		.split(' ')
		.map((word) => {
			if (customFilter.isProfane(word)) {
				return defaultFilter.clean(word); // Clean real profane words
			}
			return word;
		})
		.join(' ');

	// Then, process false positive words with special characters
	const censoredText = censorText(cleanedText, customFilter);

	return censoredText;
}

export { censor };
