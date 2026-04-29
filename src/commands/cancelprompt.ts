import { Message } from 'discord.js';
import { promptBuilderService } from '../services/prompt-builder.service.js';

export const meta = {
	name: 'cancelprompt',
	description: 'Cancel an in-progress prompt building session.',
	cooldown: 0
};

const command = async (message: Message) => {
	if (!promptBuilderService.has(message.author.id, message.channelId)) {
		await message.reply("You don't have an active prompt session here.");
		return;
	}

	promptBuilderService.cancel(message.author.id, message.channelId);
	await message.reply('Prompt session cancelled.');
};

export default command;
