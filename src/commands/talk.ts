import AIMascotService from '../ai.js';

const aiService = new AIMascotService({
	model: 'gpt-5-mini',
	maxTokens: 2048,
	temperature: 0.2,
	enableTwitter: true,
	twitterCooldown: 300000,
	maxTweetLength: 280
});

export const meta = {
	name: 'sendmessage',
	description: 'Send Message to Quin AI.',
	cooldown: 1200000
};

const command = async (message, args) => {
	const data = args.join(' ').split(/ +/);

	const response = await aiService.chat(data, {
		userId: message.author.id,
		username: message.author.username
	});

	message.reply({
		content: response.response || 'I have nothing to say right now.'
	});
};
export default command;
