import { Client, GatewayIntentBits, Partials } from 'discord.js';
import Database, { Database as SqliteDatabase } from 'better-sqlite3';
import { secrets } from '@/helpers/data.js';

export class DiscordClient extends Client {
	logo: string;
	footer: string;
	colors: {
		primary: string;
		secondary: string;
		tertiary: string;
		success: string;
		error: string;
		warning: string;
	};
	database: SqliteDatabase;

	commands = new Map<string, any>();
	cooldowns = new Map<string, number>();
	triggers = new Map<string, any>();

	constructor() {
		super({
			intents: [
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildPresences
			],
			partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User],
			allowedMentions: {
				parse: ['users', 'roles', 'everyone'],
				repliedUser: true
			}
		});

		this.logo = 'https://purrquinox.com/logo.png';
		this.footer = '© 2025 - Purrquinox';
		this.colors = {
			primary: '#ffb6c1',
			secondary: '#ffc0cb',
			tertiary: '#ff69b4',
			success: '#32cd32',
			error: '#ff4500',
			warning: '#ffa500'
		};
		this.database = new Database('db.sqlite');
	}

	async start() {
		this.login(secrets.discord.bot_token)
			.then(() => {
				console.log(
					`⚡ Quin's online. Chaos protocol initiated. Let's burn some logs and debug some dreams.`
				);
			})
			.catch((error) => {
				console.error('Failed to log in to Discord:', error);
			});

		return this;
	}
}
