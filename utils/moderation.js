// moderation.js

import { google } from 'googleapis';

const API_KEY = process.env.PERSPECTIVE_API_KEY;
const DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';

async function createModeration(params) {
    try {
        const client = await google.discoverAPI(DISCOVERY_URL);

        const analyzeRequest = {
            comment: {
                text: params.input,
            },
            requestedAttributes: {
                [params.model]: {},
            },
            languages: ['en'],  // Default to English
        };

        const analyzeComment = () => {
            return new Promise((resolve, reject) => {
                client.comments.analyze(
                    {
                        key: API_KEY,
                        resource: analyzeRequest,
                    },
                    (err, response) => {
                        if (err) {
                            if (err.message.includes("Attribute TOXICITY does not support request languages")) {
                                analyzeRequest.languages = ['en'];  // Hardcode to English and retry
                                return analyzeComment().then(resolve).catch(reject);
                            }
                            reject(err);
                        } else {
                            resolve(response.data);
                        }
                    }
                );
            });
        };

        return await analyzeComment();
    } catch (err) {
        throw err;
    }
}

export {
    createModeration
};
