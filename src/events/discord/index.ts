import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { discordClient } from '../../classes/discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LoadDiscordEvents = async () => {
	const eventFiles = readdirSync(__dirname).filter(
		(file) => file.endsWith('.js') && file !== 'index.js'
	);

	for (const file of eventFiles) {
		const eventName = file.replace('.js', '');
		const eventModule = await import(join(__dirname, file));
		const eventHandler = eventModule.default || eventModule[eventName];

		if (typeof eventHandler === 'function') {
			if (eventModule.once) discordClient.once(eventName, eventHandler);
			else discordClient.on(eventName, eventHandler);

			console.log(`📡 Loaded Discord event: ${eventName}`);
		}
	}
};


export default LoadDiscordEvents;
