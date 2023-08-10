import chalk from 'chalk';
import { EVENT_CONF } from '../config';

const event = (evtname, data) => {
	if (EVENT_CONF?.hidden?.includes(evtname)) {
		return;
	}

	const style = EVENT_CONF[evtname] ? EVENT_CONF[evtname] : 'yellow';
	console.log(`${chalk[style](`[${evtname}]`)} ${data}`);
};

export { event };
