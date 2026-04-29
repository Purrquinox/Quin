import { Message } from 'discord.js';
import { promptBuilderService } from '../services/prompt-builder.service.js';

export const meta = {
	name: 'buildprompt',
	description: 'Interactively build an LLM prompt through guided questions.',
	cooldown: 5000
};

const command = async (message: Message) => {
	if (promptBuilderService.has(message.author.id, message.channelId)) {
		await message.reply(
			'You already have a prompt session in progress here. Finish it or type `!cancelprompt` to start over.'
		);
		return;
	}

	if ('sendTyping' in message.channel) await message.channel.sendTyping();
	const opening = await promptBuilderService.start(message.author.id, message.channelId);
	await message.reply(opening);
};

export default command;
