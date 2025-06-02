import { Client, GatewayIntentBits } from 'discord.js';
import { secrets } from '../../get_data.js';
import { talk, roast } from '../../fetch.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user?.tag}`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!talk')) {
        const userMessage = message.content.slice(6).trim();
        if (!userMessage) {
            message.reply('Please provide a message to talk about.');
            return;
        }

        talk(userMessage).then(response => message.reply(response.choices[0].message.content));
    } else if (message.content.startsWith('!roast')) {
        const [_, who, ...whyParts] = message.content.split(' ');
        const why = whyParts.join(' ');
        if (!who || !why) {
            message.reply('Please provide a person to roast and the reason.');
            return;
        }

        roast(who, why).then(response => message.reply(response.choices[0].message.content));
    }
});

export const login = () => client.login(secrets.discord.bot_token);
