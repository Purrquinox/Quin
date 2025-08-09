import { AIMascotService } from './classes/aiService.js';
import { discordClient } from './classes/discord.js';

const aiService = new AIMascotService({
	model: 'gpt-4',
	maxTokens: 2048,
	temperature: 0.2,
	enableTwitter: true,
	twitterCooldown: 300000,
	maxTweetLength: 280
});

discordClient.start();

discordClient.on('messageCreate', async (message) => {
	if (message.author.bot) return;

	// Handle commands
	if (message.content.startsWith('!talk')) {
		// Remove the command prefix '!talk' and trim any whitespace
		const args = message.content.slice('!talk'.length).trim().split(/ +/);

		// Get the text to send to aiService by joining all args back to a string
		const text = args.join(' ');

		const response = await aiService.chat(text, {
			userId: message.author.id,
			username: message.author.username
		});

		message.reply({
			content: response.response || 'I have nothing to say right now.'
		});
	}

	// Handle triggers
	for (const [trigger, action] of discordClient.triggers.entries()) {
		if (message.content.includes(trigger)) {
			try {
				await action.execute(message);
			} catch (error) {
				console.error(`Error executing trigger ${trigger}:`, error);
			}
		}
	}
});
