import { discordClient } from './classes/discord.js';
import LoadDiscordEvents from './events/discord/index.js';
import LoadDiscordCommands from './commands/index.js';

LoadDiscordEvents();
LoadDiscordCommands();

discordClient.start();