// temp note
const apiUrl = 'https://anirudhgpt-api.techwithanirudh.repl.co/ask';  // Update with your actual server URL
const conversation = {
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Who won the world series in 2022?' },
  ],
};

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(conversation),
})
  .then((response) => response.text())
  .then((completionText) => {
    console.log('Completion:', completionText);
  })
  .catch((error) => {
    console.error('Error:', error);
  });

// What is this for?