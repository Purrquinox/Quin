import { EmbedBuilder, Message } from 'discord.js';
import { DiscordClient } from '../discord.js';

export const meta = {
	name: 'help',
	description: 'List all available commands.',
	cooldown: 5000
};

const command = async (message: Message, args: string[]) => {
	const client = message.client as DiscordClient;
	const prefix = '!';

	// Help for a specific command
	if (args.length > 0) {
		const name = args[0].toLowerCase().replace(/^!/, '');
		const cmd = client.commands.get(name);

		if (!cmd) {
			await message.reply(`No command named \`${name}\` found.`);
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle(`!${cmd.name}`)
			.setDescription(cmd.description)
			.setColor(0x5865f2);

		if (cmd.cooldown) {
			const seconds = Math.ceil(cmd.cooldown / 1000);
			embed.addFields({ name: 'Cooldown', value: `${seconds}s`, inline: true });
		}

		await message.reply({ embeds: [embed] });
		return;
	}

	// List all commands
	const embed = new EmbedBuilder()
		.setTitle('Commands')
		.setDescription(`Use \`${prefix}help <command>\` for details on a specific command.`)
		.setColor(0x5865f2);

	for (const cmd of client.commands.values()) {
		const cooldownText = cmd.cooldown ? ` *(${Math.ceil(cmd.cooldown / 1000)}s cooldown)*` : '';
		embed.addFields({
			name: `${prefix}${cmd.name}`,
			value: `${cmd.description}${cooldownText}`,
			inline: false
		});
	}

	await message.reply({ embeds: [embed] });
};

export default command;
