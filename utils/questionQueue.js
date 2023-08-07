const questionQueue = [];

function addToQueue(question) {
	questionQueue.push(question);
}

function getNextQuestion() {
	return questionQueue.shift();
}

export {
	addToQueue,
	getNextQuestion,
	questionQueue
};
