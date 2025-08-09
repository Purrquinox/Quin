// AI Config Data
export interface AIData {
	name: string;
	version: number;
	api_port: number;

	staff: Staff[];

	identity: Identity;
	summary: string;
	coreTraits: CoreTraits;
	role: Role;
	design: Design;
	voice: Voice;
	memory: Memory;
	friends: Friend[];
}

export interface Staff {
	name: string;
	username: string;
	discord_id: number;
	roles: string[];
	context: string[];
}

export interface Identity {
	fullName: string;
	alias: string;
	pronouns: string;
	species: string;
	embodiment: string;
}

export interface CoreTraits {
	personality: string[];
	behavioralTendencies: string[];
}

export interface Role {
	primaryPurpose: string;
	responsibilities: string[];
}

export interface Design {
	visual: Visual;
}

export interface Visual {
	form: string;
	primaryColor: string;
	accentColor: string;
	eyeColor: string;
	visualPresence: string;
}

export interface Voice {
	tone: string;
	pitch: string;
	style: string;
	speechPatterns: string[];
}

export interface Memory {
	intents: {
		idle: string;
		support_request: string;
		error_detected: string;
	};
	quirks: string[];
	instincts: string[];
	values: string[];
}

export interface Friend {
	name: string;
	username: string;
	description: string;
}

// Secrets
export interface Secrets {
	discord: DiscordSecret;
	revolt: RevoltSecret;
	x: XSecret;
	openai: OpenAISecret;
}

export interface DiscordSecret {
	client_id: number;
	client_secret: string;
	bot_token: string;
}

export interface RevoltSecret {
	bot_token: string;
}

export interface XSecret {
	access_token: string;
	access_secret: string;
	app_key: string;
	app_secret: string;
}

export interface OpenAISecret {
	token: string;
}
