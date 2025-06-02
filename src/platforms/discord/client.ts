import { Client, GatewayIntentBits } from 'discord.js';
import { secrets } from '../../get_data.js';
import { talk, roast } from '../../fetch.js';
import { channel } from 'diagnostics_channel';
import { start } from 'repl';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

client.once('ready', () => {
	console.log(`🤖 Logged in as ${client.user?.tag}`);
});

const startTypingIndicator = (channel) => {
	let active = true;

	const typingInterval = setInterval(() => {
		if (active) {
			channel.sendTyping().catch(() => {});
		} else {
			clearInterval(typingInterval);
		}
	}, 5000);

	// Start typing immediately
	channel.sendTyping().catch(() => {});

	return {
		stop: () => {
			active = false;
			clearInterval(typingInterval);
		}
	};
};

client.on('messageCreate', (message) => {
	if (message.author.bot) return;

	if (message.content.startsWith('!talk')) {
		const userMessage = message.content.slice(6).trim();
		if (!userMessage) {
			message.reply('Please provide a message to talk about.');
			return;
		}

		const d = startTypingIndicator(message.channel);
		talk(userMessage, 2000)
			.then((response) => message.reply(response.choices[0].message.content))
			.finally(() => {
				d.stop();
			});
	} else if (message.content.startsWith('!roast')) {
		const [_, who, ...whyParts] = message.content.split(' ');
		const why = whyParts.join(' ');
		if (!who || !why) {
			message.reply('Please provide a person to roast and the reason.');
			return;
		}

		const d = startTypingIndicator(message.channel);
		roast(who, why, 2000)
			.then((response) => message.reply(response.choices[0].message.content))
			.finally(() => {
				d.stop();
			});
	}
});

export const login = () => client.login(secrets.discord.bot_token);
