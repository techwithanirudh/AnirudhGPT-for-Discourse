// moderation.js

import { google } from 'googleapis';

const API_KEY = process.env.PERSPECTIVE_API_KEY;
const DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';

async function createModeration(params) {
	try {
		const client = await google.discoverAPI(DISCOVERY_URL);

		const analyzeRequest = {
			comment: {
				text: params.input,  // Accessing 'input' from the passed object
			},
			requestedAttributes: {
				[params.model]: {},  // Accessing 'model' from the passed object
			},
		};

		return new Promise((resolve, reject) => {
			client.comments.analyze(
				{
					key: API_KEY,
					resource: analyzeRequest,
				},
				(err, response) => {
					if (err) reject(err);
					if (response?.data) { resolve(response.data); }
					else {
						resolve({
							"attributeScores": {
								"TOXICITY": {
									"spanScores": [
										{
											"score": {
												"value": 0,
												"type": "PROBABILITY"
											}
										}
									],
									"summaryScore": {
										"value": 0,
										"type": "PROBABILITY"
									}
								}
							},
							"languages": [
								"en"
							]
						})
					}
				}
			);
		});
	} catch (err) {
		throw err;
	}
}

export {
	createModeration
};
