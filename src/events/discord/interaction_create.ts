import { CacheType, Interaction } from 'discord.js';
import { DiscordClient } from 'src/classes/discord.js';

const interactionCreate = async (client: DiscordClient, interaction: Interaction<CacheType>) => {
	try {
		// Handle slash commands
		if (interaction.isChatInputCommand()) {
			const command = client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			// Check cooldown
			if (client.isOnCooldown(interaction.user.id, interaction.commandName, command.cooldown)) {
				const timeLeft = client.getCooldownTime(
					interaction.user.id,
					interaction.commandName,
					command.cooldown
				);
				return interaction.reply({
					content: `⏰ Please wait ${Math.ceil(
						timeLeft / 1000
					)} seconds before using this command again.`,
					ephemeral: true
				});
			}

			// Execute command
			await command.execute(interaction, []);
		}

		// Handle button interactions
		else if (interaction.isButton()) {
			// You can handle button interactions here
			console.log(`Button interaction: ${interaction.customId}`);
		}

		// Handle select menu interactions
		else if (interaction.isStringSelectMenu()) {
			// You can handle select menu interactions here
			console.log(`Select menu interaction: ${interaction.customId}`);
		}

		// Handle modal submissions
		else if (interaction.isModalSubmit()) {
			// You can handle modal submissions here
			console.log(`Modal submission: ${interaction.customId}`);
		}

		// Handle context menu commands
		else if (interaction.isContextMenuCommand()) {
			// You can handle context menu commands here
			console.log(`Context menu command: ${interaction.commandName}`);
		}
	} catch (error) {
		console.error('Error in interactionCreate event:', error);

		const errorMessage = {
			content: '❌ There was an error while executing this command!',
			ephemeral: true
		};

		// Send error response
		try {
			// Only reply/followUp if interaction supports these properties
			if (
				('replied' in interaction && 'deferred' in interaction && (interaction as any).replied) ||
				(interaction as any).deferred
			) {
				if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
					await (interaction as any).followUp(errorMessage);
				}
			} else {
				if (
					interaction.isChatInputCommand() ||
					interaction.isContextMenuCommand() ||
					interaction.isButton() ||
					interaction.isStringSelectMenu() ||
					interaction.isModalSubmit()
				) {
					await (interaction as any).reply(errorMessage);
				}
			}
		} catch (replyError) {
			console.error('Failed to send error response:', replyError);
		}
	}
};

export default interactionCreate;
