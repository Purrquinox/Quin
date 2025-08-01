// Generated by ts-to-zod
import { z } from 'zod';

export const staffSchema = z.object({
	name: z.string(),
	username: z.string(),
	discord_id: z.number(),
	roles: z.array(z.string()),
	context: z.array(z.string())
});

export const identitySchema = z.object({
	fullName: z.string(),
	alias: z.string(),
	pronouns: z.string(),
	species: z.string(),
	embodiment: z.string()
});

export const coreTraitsSchema = z.object({
	personality: z.array(z.string()),
	behavioralTendencies: z.array(z.string())
});

export const roleSchema = z.object({
	primaryPurpose: z.string(),
	responsibilities: z.array(z.string())
});

export const voiceSchema = z.object({
	tone: z.string(),
	pitch: z.string(),
	style: z.string(),
	speechPatterns: z.array(z.string())
});

export const memorySchema = z.object({
	intents: z.object({
		idle: z.string(),
		support_request: z.string(),
		error_detected: z.string()
	}),
	quirks: z.array(z.string()),
	instincts: z.array(z.string()),
	values: z.array(z.string())
});

export const friendSchema = z.object({
	name: z.string(),
	username: z.string(),
	description: z.string()
});

export const visualSchema = z.object({
	form: z.string(),
	primaryColor: z.string(),
	accentColor: z.string(),
	eyeColor: z.string(),
	visualPresence: z.string()
});

export const discordSecretSchema = z.object({
	client_id: z.number(),
	client_secret: z.string(),
	bot_token: z.string()
});

export const revoltSecretSchema = z.object({
	bot_token: z.string()
});

export const xSecretSchema = z.object({
	client_id: z.string(),
	client_secret: z.string()
});

export const openRouterSecretSchema = z.object({
	token: z.string()
});

export const designSchema = z.object({
	visual: visualSchema
});

export const secretsSchema = z.object({
	discord: discordSecretSchema,
	revolt: revoltSecretSchema,
	x: xSecretSchema,
	openrouter: openRouterSecretSchema
});

export const aIDataSchema = z.object({
	name: z.string(),
	version: z.number(),
	api_port: z.number(),
	staff: z.array(staffSchema),
	identity: identitySchema,
	summary: z.string(),
	coreTraits: coreTraitsSchema,
	role: roleSchema,
	design: designSchema,
	voice: voiceSchema,
	memory: memorySchema,
	friends: z.array(friendSchema)
});
