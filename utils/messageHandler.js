import {
	BASE_URL,
	DISCOURSE_API_KEY,
	PREFIX,
	STAFF_LIST,
	CONTEXT_LENGTH,
} from '../config';
import { event } from './logging';
import { censor } from '../utils';

console.event = event;

function getHeaders(method, CHANNEL_NAME, CHANNEL_ID) {
	return {
		accept:
			method === 'GET'
				? 'application/json, text/javascript, */*; q=0.01'
				: '*/*',
		'accept-language': 'en-US,en;q=0.9',
		'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
		'discourse-logged-in': 'true',
		'discourse-present': 'true',
		'sec-ch-ua':
			'"Not/A)Brand";v="99", "Microsoft Edge";v="115", "Chromium";v="115"',
		'sec-ch-ua-mobile': '?0',
		'sec-ch-ua-platform': '"Windows"',
		'sec-fetch-dest': 'empty',
		'sec-fetch-mode': 'cors',
		'sec-fetch-site': 'same-origin',
		Referer: `${BASE_URL}/chat/c/${CHANNEL_NAME}/${CHANNEL_ID}`,
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'x-requested-with': 'XMLHttpRequest',
		'Api-Key': DISCOURSE_API_KEY,
	};
}

async function postMessage(msg, CHANNEL_NAME, CHANNEL_ID) {
	const url = `${BASE_URL}/chat/${CHANNEL_ID}`;

	const cleanedMessage = censor(msg);
	const body = `message=${encodeURIComponent(cleanedMessage)}`;
	const headers = {
		...getHeaders('POST', CHANNEL_NAME, CHANNEL_ID),
	};

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers,
			body,
		});

		return await response.json();
	} catch (error) {
		console.error('Error posting message:', error);
	}
}

async function getMessages(CHANNEL_NAME, CHANNEL_ID) {
	const url = `${BASE_URL}/chat/api/channels/${CHANNEL_ID}/messages?fetch_from_last_read=false&page_size=${CONTEXT_LENGTH}`;
	const headers = {
		...getHeaders('GET', CHANNEL_NAME, CHANNEL_ID),
	};

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers,
		});

		const data = await response.json();
		if (!!data.errors && !!data.errors[0]) {
			throw new Error(data.errors[0]);
		}

		let messages = [];
		data.messages.forEach((message) => {
			messages.push({
				timestamp: message.created_at,
				id: message.id,
				text: message.message,
				author: message.user.username,
			});
		});

		return messages;
	} catch (error) {
		console.event('FETCH_ERR', error);
	}
}

function includesPrefix(message) {
	return message.includes(PREFIX);
}

// Function to check if a user is staff using the Discourse API and with exceptions array
async function isUserStaff(username) {
	const url = `${BASE_URL}/u/${username}/card.json`;
	const headers = {
		...getHeaders('GET'),
	};
	console.event('CHECK_ADMIN', `CHECKING: ${username}`);

	if (STAFF_LIST.includes(username)) return true;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers,
		});

		const data = await response.json();
		return data.admin || data.moderator;
	} catch (error) {
		console.event('CHECK_ADMIN_ERROR', error);
		return false;
	}
}

export { getHeaders, postMessage, getMessages, includesPrefix, isUserStaff };
