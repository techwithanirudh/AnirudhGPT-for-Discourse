import { BASE_URL, CHANNEL_NAME, CHANNEL_ID, DISCOURSE_API_KEY, PREFIX, STAFF_LIST } from '../config';

function getHeaders(method) {
	return {
		accept:
			method === "GET"
				? "application/json, text/javascript, */*; q=0.01"
				: "*/*",
		"accept-language": "en-US,en;q=0.9",
		"content-type": "application/x-www-form-urlencoded; charset=UTF-8",
		"discourse-logged-in": "true",
		"discourse-present": "true",
		"sec-ch-ua": '"Not/A)Brand";v="99", "Microsoft Edge";v="115", "Chromium";v="115"',
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": '"Windows"',
		"sec-fetch-dest": "empty",
		"sec-fetch-mode": "cors",
		"sec-fetch-site": "same-origin",
		Referer: `${BASE_URL}/chat/c/${CHANNEL_NAME}/${CHANNEL_ID}`,
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"x-requested-with": "XMLHttpRequest",
		"Api-Key": DISCOURSE_API_KEY,
	};
}

async function postMessage(msg) {
	const url = `${BASE_URL}/chat/${CHANNEL_ID}`;
	const body = `message=${msg}&staged_id=39278572-0717-4499-a578-c0dad1d999f9`;
	const headers = {
		...getHeaders("POST")
	};

	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body,
		});

		return await response.json();
	} catch (error) {
		console.error("Error posting message:", error);
	}
}

async function getMessages() {
	const url = `${BASE_URL}/chat/api/channels/${CHANNEL_ID}/messages?fetch_from_last_read=false&page_size=10`;
	const headers = {
		...getHeaders("GET"),
	};

	try {
		const response = await fetch(url, {
			method: "GET",
			headers,
		});

		const data = await response.json();
		let messages = [];
		data.messages.forEach((message) => {
			messages.push({ msg: message.message, user: message.user.username });
		});

		return messages;
	} catch (error) {
		console.error("Error getting messages:", error);
	}
}


function includesPrefix(message) {
	return message.startsWith(PREFIX)
}

// Function to check if a user is staff using the Discourse API and with exceptions array
async function isUserStaff(username) {
	const url = `${BASE_URL}/u/${username}/card.json`;
	const headers = {
		...getHeaders("GET"),
	};
	console.log("[ISADMIN] CHECKING:", username)

	if (STAFF_LIST.includes(username)) return true;
	
	try {
		const response = await fetch(url, {
			method: "GET",
			headers,
		});

		const data = await response.json();
		return data.admin || data.moderator;
	} catch (error) {
		console.error("Error checking user staff status:", error);
		return false;
	}
}

export { getHeaders, postMessage, getMessages, includesPrefix, isUserStaff };
