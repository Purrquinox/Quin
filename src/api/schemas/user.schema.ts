import { z } from '@hono/zod-openapi';

export const userProfileSchema = z.object({
	userId: z.string(),
	username: z.string(),
	displayName: z.string().nullable(),
	facts: z.array(z.string()).openapi({ description: 'Learned facts about the user' }),
	personality: z.string().nullable(),
	lastInteraction: z.string().openapi({ description: 'ISO timestamp of last interaction' }),
	createdAt: z.string().openapi({ description: 'ISO timestamp of profile creation' })
});

export const userProfileResponseSchema = z.object({
	success: z.boolean(),
	profile: userProfileSchema.nullable(),
	error: z.string().optional()
});

export const addFactRequestSchema = z.object({
	fact: z
		.string()
		.min(1)
		.max(500)
		.openapi({ description: 'Fact to store about the user', example: 'Loves pizza' }),
	category: z
		.enum(['preference', 'interest', 'personal', 'professional', 'relationship', 'personality'])
		.openapi({ description: 'Category of the fact' })
});

export const addFactResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	fact: z.string(),
	category: z.string(),
	duplicate: z.boolean().openapi({ description: 'Whether this fact was already known' }),
	totalFacts: z.number().openapi({ description: 'Total number of facts stored' }),
	error: z.string().optional()
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
export type AddFactRequest = z.infer<typeof addFactRequestSchema>;
export type AddFactResponse = z.infer<typeof addFactResponseSchema>;
