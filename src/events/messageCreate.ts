import { Message, OmitPartialGroupDMChannel } from 'discord.js';
import { DiscordClient } from '../discord.js';
import AIMascotService from '../ai.js';

// Initialize AI service (you can also do this in your main bot setup)
const aiService = new AIMascotService({
	model: 'gpt-4o-mini',
	temperature: 0.8,
	maxTokens: 2048,
	enableTwitter: true, // Enable Twitter integration
	maxHistoryMessages: 7 // Reduced for token efficiency
});

const messageCreate = async (message: OmitPartialGroupDMChannel<Message<boolean>>) => {
	const client = message.client as DiscordClient;

	// Ignore messages from bots
	if (message.author.bot) return;

	// Ignore messages without content (embeds, attachments only)
	if (!message.content) return;

	try {
		// Check if bot is mentioned or message is in DM
		const isMentioned = message.mentions.has(client.user!);
		const isDM = message.channel.isDMBased();
		const hasPrefix = message.content.startsWith('!');

		// Handle AI conversations when mentioned or in DMs
		if (isMentioned || isDM) {
			// Remove mention from message if present
			const cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();

			if (!cleanMessage) {
				await message.reply('Yes? How can I help you? 😊');
				return;
			}

			// Show typing indicator
			await message.channel.sendTyping();

			// Prepare user info for AI context
			const userInfo = {
				userId: message.author.id,
				username: message.author.username,
				discordServerId: message.guildId || undefined,
				discordChannelId: message.channelId,
				context: {
					displayName: message.member?.displayName || message.author.displayName,
					isAdmin: message.member?.permissions.has('Administrator') || false,
					roles: message.member?.roles.cache.map((r) => r.name) || []
				}
			};

			// Get AI response with conversation history from database
			const result = await aiService.chat(cleanMessage, userInfo);

			if (result.success && result.response) {
				// Split long responses if needed (Discord has 2000 char limit)
				const responses = splitMessage(result.response, 2000);

				for (const response of responses) {
					await message.reply(response);
				}

				// Log tool calls if any
				if (result.toolCalls && result.toolCalls.length > 0) {
					console.log('Tool calls executed:', result.toolCalls);
				}
			} else {
				await message.reply(result.response || 'Sorry, something went wrong! 😅');
			}

			return;
		}

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
		if (hasPrefix) {
			const prefix = '!';
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

// Helper function to split long messages
function splitMessage(text: string, maxLength: number = 2000): string[] {
	if (text.length <= maxLength) return [text];

	const messages: string[] = [];
	let currentMessage = '';

	const lines = text.split('\n');

	for (const line of lines) {
		if ((currentMessage + line + '\n').length > maxLength) {
			if (currentMessage) {
				messages.push(currentMessage.trim());
				currentMessage = '';
			}

			// If a single line is too long, split it by words
			if (line.length > maxLength) {
				const words = line.split(' ');
				for (const word of words) {
					if ((currentMessage + word + ' ').length > maxLength) {
						messages.push(currentMessage.trim());
						currentMessage = word + ' ';
					} else {
						currentMessage += word + ' ';
					}
				}
			} else {
				currentMessage = line + '\n';
			}
		} else {
			currentMessage += line + '\n';
		}
	}

	if (currentMessage) {
		messages.push(currentMessage.trim());
	}

	return messages;
}

export default messageCreate;
