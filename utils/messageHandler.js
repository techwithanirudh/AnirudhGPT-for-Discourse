import {
	BASE_URL,
	DISCOURSE_API_KEY,
	STAFF_LIST,
	CONTEXT_LENGTH,
	MAX_RETRIES
} from '../config';
import { event } from './logging';
import { censor } from '../utils';

console.event = event;
var retryCount = 0;

async function fetchWithRetry(...args) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const response = await fetch(...args);
            
            // Check if the response is ok
            if (!response.ok) {
                const responseBody = await response.json();
                
                if (responseBody.errors && responseBody.errors[0].includes("You’ve performed this action too many times")) {
                    retries++;
                    
                    // Extract wait time from the error message
                    const waitTimeMatch = responseBody.errors[0].match(/wait (\d+) seconds/);
                    const waitTime = waitTimeMatch ? parseInt(waitTimeMatch[1], 10) * 1000 : 5000; // Default to 5 seconds if no specific time is provided
                    
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    return response;
                }
            } else {
                return response;
            }
        } catch (error) {
            if (error.message.includes("You’ve performed this action too many times")) {
                retries++;
                
                // Extract wait time from the error message
                const waitTimeMatch = error.message.match(/wait (\d+) seconds/);
                const waitTime = waitTimeMatch ? parseInt(waitTimeMatch[1], 10) * 1000 : 5000; // Default to 5 seconds if no specific time is provided
                
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                throw error;
            }
        }
    }
    throw new Error("Max retries reached");
}

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

async function postMessage(text, CHANNEL_NAME, CHANNEL_ID) {
	const url = `${BASE_URL}/chat/${CHANNEL_ID}`;

	const cleanedText = censor(text);
	const body = `message=${encodeURIComponent(cleanedText)}`;
	const headers = {
		...getHeaders('POST', CHANNEL_NAME, CHANNEL_ID),
	};

	try {
		const response = await fetchWithRetry(url, {
			method: 'POST',
			headers,
			body,
		});

		return await response.json();
	} catch (error) {
		console.error('Error posting message:', error);
	}
}

async function postMessageWithRetries(message, channelName, channelId) {
	var response;
	while (true) {
		response = await postMessage(message, channelName, channelId);

		if (!response.errors) {
			break; // Message sent successfully without errors, exit loop
		} else if (response.errors.includes('You posted an identical message too recently.')) {
			retryCount++;
			const spaces = Array(5).fill('\u2063').join('');
			const retryMessage = `${message}${spaces}`;

			await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
			message = retryMessage;
		} else {
			console.error('Error sending message:', response.errors);
			break;
		}
	}

	return response;
}

async function editMessage(thinkingMsg, text, CHANNEL_NAME, CHANNEL_ID) {
	const url = `${BASE_URL}/chat/${CHANNEL_ID}/edit/${thinkingMsg.message_id}`;

	const cleanedText = censor(text);
	const body = `new_message=${encodeURIComponent(cleanedText)}`;
	const headers = {
		...getHeaders('PUT', CHANNEL_NAME, CHANNEL_ID),
	};

	try {
		const response = await fetchWithRetry(url, {
			method: 'PUT',
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
		const response = await fetchWithRetry(url, {
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
	return true;
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
		const response = await fetchWithRetry(url, {
			method: 'GET',
			headers,
		});

		const data = await response.json();
		return data.user.admin || data.user.moderator;
	} catch (error) {
		console.event('CHECK_ADMIN_ERROR', error);
		return false;
	}
}

export { getHeaders, postMessage, postMessageWithRetries, editMessage, getMessages, includesPrefix, isUserStaff };
