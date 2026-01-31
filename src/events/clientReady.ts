import { ActivityType } from 'discord.js';
import { DiscordClient } from '../discord.js';

export const once = true;

const clientReady = (client: DiscordClient) => {
	console.log(
		`⚡ ${client.user.tag} is online. Chaos protocol initiated. Let's burn some logs and debug some dreams.`
	);
	console.log(
		`🏠 Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`
	);

	// Set bot activity/status
	client.user.setActivity({
		name: 'powered by caffeine and violations',
		type: ActivityType.Custom
	});

	// Set status (online, idle, dnd, invisible)
	client.user.setStatus('dnd');
	console.log('✅ Bot is fully ready and operational!');
};
export default clientReady;
