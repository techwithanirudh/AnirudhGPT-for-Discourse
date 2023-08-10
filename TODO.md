# TODO:

- Create README and say how to setup
- Create credits and include all the contributors me, py660, fp, 9pfs
- Reorganize extra commands like /say or /suspend to be in commands.js
- Have two options, webhook mode and interval mode
- Add moderation dashboard, like AnirudhGPT (replit-bot)
- Use redis for data storage, like AnirudhGPT (replit-bot)
- Create a landing page, like AnirudhGPT (replit-bot)
- Add support for posts on Discourse.

# URGENT:
- Suspend can be run by anyone
- When a command is already executed like '/suspend' and the message is still in the history it is triggered until the 15 messages are gone

# DONE:
- Fix the channel bug when oldMessages.json is deleted and first new message is sent and it doesn't respond
- Make it work in all channels
- When 3-4 commands are simeltainously run with no response, the AI responses twice or thrice to all of the questions

# OUT OF SCOPE:
- Create a library