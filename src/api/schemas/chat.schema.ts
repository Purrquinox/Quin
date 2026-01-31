import { z } from '@hono/zod-openapi';

export const chatRequestSchema = z.object({
	message: z.string().min(1).max(4000).openapi({
		description: 'User message to send to the AI',
		example: 'Hello! Tell me about yourself.'
	}),
	userId: z.string().openapi({ description: 'Unique user identifier', example: 'user123' }),
	username: z.string().openapi({ description: 'Username for context', example: 'john_doe' }),
	platform: z
		.string()
		.optional()
		.default('api')
		.openapi({ description: 'Platform identifier (discord, slack, api, etc.)', example: 'api' }),
	serverId: z.string().optional().openapi({
		description: 'Optional server/workspace ID for conversation context',
		example: 'server456'
	}),
	channelId: z.string().optional().openapi({
		description: 'Optional channel/room ID for conversation context',
		example: 'channel789'
	}),
	context: z
		.record(z.string(), z.any())
		.optional()
		.openapi({ description: 'Additional context metadata' })
});

export const chatResponseSchema = z.object({
	success: z.boolean().openapi({ description: 'Whether the request was successful' }),
	response: z.string().optional().openapi({ description: 'AI generated response' }),
	conversationId: z.number().optional().openapi({ description: 'Database conversation ID' }),
	toolCalls: z
		.array(z.any())
		.optional()
		.openapi({ description: 'Tools that were called during response generation' }),
	toolResults: z.array(z.any()).optional().openapi({ description: 'Results from tool executions' }),
	usage: z.any().optional().openapi({ description: 'Token usage statistics' }),
	error: z.string().optional().openapi({ description: 'Error message if request failed' })
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
