import {
	Client,
	GatewayIntentBits,
	Collection,
	OmitPartialGroupDMChannel,
	Message,
	Interaction,
	CacheType
} from 'discord.js';
import { DatabaseManager } from './database.js';
import { secrets } from '../helpers/data.js';

export interface Command {
	name: string;
	description: string;
	execute: (
		message: OmitPartialGroupDMChannel<Message<boolean>> | Interaction<CacheType>,
		args: string[]
	) => Promise<void>;
	cooldown?: number;
}

export interface Trigger {
	name: string;
	pattern: RegExp | string;
	execute: (message: any) => Promise<void>;
}

export class DiscordClient extends Client {
	public readonly logo: string;
	public readonly footer: string;
	public readonly colors: {
		primary: string;
		secondary: string;
		tertiary: string;
		success: string;
		error: string;
		warning: string;
	};
	public readonly database: DatabaseManager;

	// Use Discord.js Collection for better performance and built-in methods
	public commands = new Collection<string, Command>();
	public cooldowns = new Collection<string, Collection<string, number>>();
	public triggers = new Collection<string, Trigger>();

	constructor() {
		super({
			intents: [
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildPresences
			],
			partials: [],
			allowedMentions: {
				parse: ['users', 'roles', 'everyone'],
				repliedUser: true
			}
		});

		this.logo = 'https://purrquinox.com/logo.png';
		this.footer = `© ${new Date().getFullYear()} - Purrquinox`;
		this.colors = {
			primary: '#ffb6c1',
			secondary: '#ffc0cb',
			tertiary: '#ff69b4',
			success: '#32cd32',
			error: '#ff4500',
			warning: '#ffa500'
		} as const;

		this.database = new DatabaseManager();
	}

	/**
	 * Check if a user is on cooldown for a specific command
	 */
	public isOnCooldown(userId: string, commandName: string, cooldownAmount: number = 3000): boolean {
		if (!this.cooldowns.has(commandName)) {
			this.cooldowns.set(commandName, new Collection());
		}

		const now = Date.now();
		const timestamps = this.cooldowns.get(commandName)!;

		if (timestamps.has(userId)) {
			const expirationTime = timestamps.get(userId)! + cooldownAmount;

			if (now < expirationTime) {
				return true;
			}
		}

		timestamps.set(userId, now);
		setTimeout(() => timestamps.delete(userId), cooldownAmount);
		return false;
	}

	/**
	 * Get remaining cooldown time in milliseconds
	 */
	public getCooldownTime(
		userId: string,
		commandName: string,
		cooldownAmount: number = 3000
	): number {
		const timestamps = this.cooldowns.get(commandName);
		if (!timestamps || !timestamps.has(userId)) return 0;

		const expirationTime = timestamps.get(userId)! + cooldownAmount;
		return Math.max(0, expirationTime - Date.now());
	}

	/**
	 * Register a command
	 */
	public registerCommand(command: Command): void {
		this.commands.set(command.name, command);
	}

	/**
	 * Register a trigger
	 */
	public registerTrigger(trigger: Trigger): void {
		this.triggers.set(trigger.name, trigger);
	}

	/**
	 * Start the bot with better error handling and initialization
	 */
	public async start(): Promise<DiscordClient> {
		try {
			// Initialize database connection
			await this.database.connect?.();
			console.log('📊 Database connection established');

			// Login to Discord (events will be loaded separately)
			await this.login(secrets.discord.bot_token);

			return this;
		} catch (error) {
			console.error('❌ Failed to start Discord client:', error);

			// Graceful shutdown on startup failure
			if (this.isReady()) {
				await this.destroy();
			}

			throw error;
		}
	}

	/**
	 * Graceful shutdown
	 */
	public async shutdown(): Promise<void> {
		console.log('🔄 Shutting down Discord client...');

		try {
			// Close database connection
			await this.database.disconnect?.();
			console.log('📊 Database connection closed');

			// Destroy Discord client
			this.destroy();
			console.log('✅ Discord client shutdown complete');
		} catch (error) {
			console.error('❌ Error during shutdown:', error);
		}
	}

	/**
	 * Get bot statistics
	 */
	public getStats() {
		return {
			guilds: this.guilds.cache.size,
			users: this.users.cache.size,
			channels: this.channels.cache.size,
			commands: this.commands.size,
			triggers: this.triggers.size,
			uptime: this.uptime,
			ping: this.ws.ping
		};
	}
}

export const discordClient = new DiscordClient();

// Graceful shutdown handling
process.on('SIGINT', async () => {
	console.log('🛑 Received SIGINT, shutting down gracefully...');
	await discordClient.shutdown();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('🛑 Received SIGTERM, shutting down gracefully...');
	await discordClient.shutdown();
	process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	process.exit(1);
});
