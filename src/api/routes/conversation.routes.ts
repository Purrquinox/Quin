import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
	conversationHistoryResponseSchema,
	clearHistoryResponseSchema,
	conversationSummaryResponseSchema
} from '../schemas/conversation.schema.js';
import AIMascotService from '../../ai.js';

const aiService = new AIMascotService();

export const conversationRoutes = new OpenAPIHono();

// Get conversation history
const getHistoryRoute = createRoute({
	method: 'get',
	path: '/history',
	tags: ['Conversations'],
	summary: 'Get conversation history',
	description: 'Retrieve message history for a specific user and conversation context',
	request: {
		query: z.object({
			userId: z.string().openapi({ description: 'User ID', example: 'user123' }),
			platform: z
				.string()
				.optional()
				.default('api')
				.openapi({ description: 'Platform identifier' }),
			serverId: z.string().optional().openapi({ description: 'Server/workspace ID' }),
			channelId: z.string().optional().openapi({ description: 'Channel/room ID' })
		})
	},
	responses: {
		200: {
			content: {
				'application/json': {
					schema: conversationHistoryResponseSchema
				}
			},
			description: 'Conversation history retrieved successfully'
		}
	}
});

conversationRoutes.openapi(getHistoryRoute, (async (c) => {
	const { userId, platform, serverId, channelId } = c.req.valid('query');
	const messages = await aiService.getConversationHistory(
		userId,
		platform || 'api',
		serverId,
		channelId
	);

	return c.render({
		success: true,
		messages: messages.map((m) => ({
			id: m.id,
			role: m.role,
			content: m.content,
			toolCallId: m.toolCallId,
			toolName: m.toolName,
			metadata: m.metadata,
			createdAt: m.createdAt.toISOString()
		})),
		count: messages.length
	});
}) as any);

// Clear conversation history
const clearHistoryRoute = createRoute({
	method: 'delete',
	path: '/history',
	tags: ['Conversations'],
	summary: 'Clear conversation history',
	description: 'Delete all messages in a conversation context',
	request: {
		query: z.object({
			userId: z.string().openapi({ description: 'User ID' }),
			platform: z
				.string()
				.optional()
				.default('api')
				.openapi({ description: 'Platform identifier' }),
			serverId: z.string().optional().openapi({ description: 'Server/workspace ID' }),
			channelId: z.string().optional().openapi({ description: 'Channel/room ID' })
		})
	},
	responses: {
		200: {
			content: {
				'application/json': {
					schema: clearHistoryResponseSchema
				}
			},
			description: 'History cleared successfully'
		}
	}
});

conversationRoutes.openapi(clearHistoryRoute, (async (c) => {
	const { userId, platform, serverId, channelId } = c.req.valid('query');
	await aiService.clearConversationHistory(userId, platform || 'api', serverId, channelId);

	return c.render({
		success: true,
		message: 'Conversation history cleared successfully'
	});
}) as any);

// Summarize conversation
const summarizeRoute = createRoute({
	method: 'post',
	path: '/{conversationId}/summarize',
	tags: ['Conversations'],
	summary: 'Summarize a conversation',
	description: 'Generate an AI summary of a conversation and extract key topics and facts',
	request: {
		params: z.object({
			conversationId: z
				.string()
				.openapi({ param: { name: 'conversationId', in: 'path' }, example: '123' })
		})
	},
	responses: {
		200: {
			content: {
				'application/json': {
					schema: conversationSummaryResponseSchema
				}
			},
			description: 'Conversation summarized successfully'
		}
	}
});

conversationRoutes.openapi(summarizeRoute, (async (c) => {
	const { conversationId } = c.req.valid('param');
	const result = await aiService.summarizeConversation(parseInt(conversationId));

	return c.render(result);
}) as any);
