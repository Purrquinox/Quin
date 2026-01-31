import { discordClient } from './discord.js';
import LoadDiscordEvents from './events/index.js';
import LoadDiscordCommands from './commands/index.js';
import './api/server.js';

LoadDiscordEvents();
LoadDiscordCommands();

discordClient.start();
