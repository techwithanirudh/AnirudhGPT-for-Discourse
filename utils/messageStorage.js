import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { event } from './logging';

console.event = event;

let db;

async function initializeDatabase() {
	db = await open({
		filename: './data/messages.sqlite3',
		driver: sqlite3.Database,
	});
}

async function ensureTableExists(CHANNEL_ID) {
	await db.run(`CREATE TABLE IF NOT EXISTS channel_${CHANNEL_ID} (
        id INTEGER PRIMARY KEY,
        author TEXT,
        text TEXT,
        timestamp TEXT
    )`);
}

async function saveOldMessages(CHANNEL_ID, messages) {
	try {
		await ensureTableExists(CHANNEL_ID);
		for (const message of messages) {
			await db.run(
				`INSERT OR REPLACE INTO channel_${CHANNEL_ID} (id, author, text, timestamp) VALUES (?, ?, ?, ?)`,
				[message.id, message.author, message.text, message.timestamp]
			);
		}
	} catch (err) {
		console.event('MSG_SAVE_ERR', err);
	}
}

async function loadOldMessages(CHANNEL_ID) {
	try {
		await ensureTableExists(CHANNEL_ID);
		const rows = await db.all(`SELECT * FROM channel_${CHANNEL_ID}`);
		return rows;
	} catch (err) {
		console.event('MSG_LOAD_ERR', err);
		return [];
	}
}

// Initialize the database when this module is imported
initializeDatabase();

export { saveOldMessages, loadOldMessages };
