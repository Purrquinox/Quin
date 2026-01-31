import { ActivityType } from 'discord.js';
import { DiscordClient } from '../discord.js';

export const once = true;

const ready = (client: DiscordClient) => {
	console.log(
		`⚡ ${client.user.tag} is online. Chaos protocol initiated. Let's burn some logs and debug some dreams.`
	);
	console.log(
		`🏠 Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`
	);

	// Set bot activity/status
	client.user.setActivity({
		name: 'with quantum mechanics',
		type: ActivityType.Playing
	});

	// Set status (online, idle, dnd, invisible)
	client.user.setStatus('online');
	console.log('✅ Bot is fully ready and operational!');
};
export default ready;
