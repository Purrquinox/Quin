import { discordClient } from './discord.js';
import LoadDiscordEvents from './events/index.js';
import LoadDiscordCommands from './commands/index.js';

LoadDiscordEvents();
LoadDiscordCommands();

discordClient.start();
