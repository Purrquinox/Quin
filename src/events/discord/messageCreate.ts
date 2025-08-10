import { Message, OmitPartialGroupDMChannel } from 'discord.js';
import { DiscordClient } from 'src/classes/discord.js';

const messageCreate = async (message: OmitPartialGroupDMChannel<Message<boolean>>) => {
	const client = message.client as DiscordClient;

	// Ignore messages from bots
	if (message.author.bot) return;

	// Ignore messages without content (embeds, attachments only)
	if (!message.content) return;

	try {
		// Check for triggers (non-command message handlers)
		for (const [name, trigger] of client.triggers) {
			try {
				let shouldExecute = false;

				if (trigger.pattern instanceof RegExp) {
					shouldExecute = trigger.pattern.test(message.content);
				} else if (typeof trigger.pattern === 'string') {
					shouldExecute = message.content.toLowerCase().includes(trigger.pattern.toLowerCase());
				}

				if (shouldExecute) {
					await trigger.execute(message);
					break; // Only execute first matching trigger
				}
			} catch (error) {
				console.error(`Error executing trigger ${name}:`, error);
			}
		}

		// Handle prefix commands (if you use them alongside slash commands)
		const prefix = '!'; // You can make this configurable
		if (message.content.startsWith(prefix)) {
			const args = message.content.slice(prefix.length).trim().split(/ +/);
			const commandName = args.shift()?.toLowerCase();

			if (!commandName) return;

			const command = client.commands.get(commandName);
			if (!command) return;

			// Check cooldown
			if (client.isOnCooldown(message.author.id, commandName, command.cooldown)) {
				const timeLeft = client.getCooldownTime(message.author.id, commandName, command.cooldown);
				return message.reply(
					`⏰ Please wait ${Math.ceil(timeLeft / 1000)} seconds before using this command again.`
				);
			}

			// Execute command
			await command.execute(message, args);
		}
	} catch (error) {
		console.error('Error in messageCreate event:', error);

		// Try to send error message to user
		try {
			await message.reply('❌ An error occurred while processing your message.');
		} catch (replyError) {
			console.error('Failed to send error message:', replyError);
		}
	}
};

export default messageCreate;
