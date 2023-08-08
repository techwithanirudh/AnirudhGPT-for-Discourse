import chalk from 'chalk';
import { EVENT_CONF } from '../config';

const event = (evtname, data) => {
  const style = EVENT_CONF[evtname] ? EVENT_CONF[evtname] : 'yellow';
  console.log(`${chalk[style](`[${evtname}]`)} ${data}`);
};

export { event };
