import AIMascotService from '../classes/aiService.js';

const aiService = new AIMascotService({
	model: 'gpt-3.5-turbo',
	maxTokens: 2048,
	temperature: 0.2,
	enableTwitter: true,
	twitterCooldown: 300000,
	maxTweetLength: 280
});

export const meta = {
	name: 'talk',
    description: "Talk to Quin AI.",
    cooldown: 1200000
};

const command = async (message, args) => {
	const data = args.join(" ").split(/ +/);

	const response = await aiService.chat(data, {
		userId: message.author.id,
		username: message.author.username
	});

	message.reply({
		content: response.response || 'I have nothing to say right now.'
	});
};
export default command;
