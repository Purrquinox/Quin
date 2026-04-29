import { Message, ThreadChannel } from 'discord.js';

export const meta = {
	name: 'newchat',
	description: 'Start a new threaded conversation with Quin.',
	cooldown: 10000
};

const command = async (message: Message) => {
	if (message.channel.isDMBased()) {
		await message.reply("Threads aren't available in DMs — just send messages here directly!");
		return;
	}

	let thread: ThreadChannel;
	try {
		thread = await message.startThread({
			name: `Chat with ${message.member?.displayName ?? message.author.username}`.slice(0, 100),
			autoArchiveDuration: 60
		});
	} catch {
		await message.reply(
			"I couldn't create a thread — make sure I have the **Create Public Threads** permission."
		);
		return;
	}

	await thread.send(
		`Hey ${message.author}! This is your private chat thread. Just send messages here and I'll respond. The conversation history is saved so I'll remember what we talked about.`
	);
};

export default command;
