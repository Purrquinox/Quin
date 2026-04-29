import AIMascotService from '../ai.js';

const aiService = new AIMascotService({
	model: 'gpt-4o-mini',
	temperature: 0.8,
	maxTokens: 2048,
	enableTwitter: false,
	maxHistoryMessages: 0
});

export const meta = {
	name: 'talk',
	description: 'Ask Quin a one-off question with no conversation history.',
	cooldown: 5000
};

const command = async (message, args) => {
	const text = args.join(' ').trim();

	if (!text) {
		await message.reply('Please include a message. Usage: `!talk <message>`');
		return;
	}

	await message.channel.sendTyping();

	// Use a unique channelId per message so no history is shared between calls
	const result = await aiService.chat(text, {
		userId: message.author.id,
		username: message.author.username,
		serverId: message.guildId || undefined,
		channelId: `oneshot-${Date.now()}`,
		platform: 'discord'
	});

	await message.reply(result.response || 'Sorry, something went wrong!');
};

export default command;
