import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { discordClient } from '../discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LoadDiscordCommands = async () => {
	const eventFiles = readdirSync(__dirname).filter(
		(file) => file.endsWith('.js') && file !== 'index.js'
	);

	for (const file of eventFiles) {
		const eventName = file.replace('.js', '');
		const filePath = join(__dirname, file);
		const eventModule = await import(pathToFileURL(filePath).href);
		const eventHandler = eventModule.default || eventModule[eventName];

		if (typeof eventHandler === 'function') {
			discordClient.registerCommand({
				name: eventModule.meta.name,
				description: eventModule.meta.description,
				execute: eventHandler,
				cooldown: eventModule.meta.cooldown
			});
			console.log(`📡 Loaded Discord command: ${eventName}`);
		}
	}
};

export default LoadDiscordCommands;
