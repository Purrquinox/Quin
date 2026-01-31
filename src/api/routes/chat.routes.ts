import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { chatRequestSchema, chatResponseSchema } from '../schemas/chat.schema.js';
import AIMascotService from '../../ai.js';

// Initialize AI service
const aiService = new AIMascotService({
	model: 'gpt-5-mini',
	temperature: 0.2,
	maxTokens: 2048,
	enableTwitter: false,
	maxHistoryMessages: 7
});

export const chatRoutes = new OpenAPIHono();

const chatRoute = createRoute({
	method: 'post',
	path: '/',
	tags: ['Chat'],
	summary: 'Send a message to the AI',
	description:
		'Send a message to Quin and receive an AI-generated response. The AI maintains conversation context and can use tools like internet search.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: chatRequestSchema
				}
			}
		}
	},
	responses: {
		200: {
			content: {
				'application/json': {
					schema: chatResponseSchema
				}
			},
			description: 'Successful response from the AI'
		},
		400: {
			description: 'Bad request - invalid input'
		},
		500: {
			description: 'Internal server error'
		}
	}
});

chatRoutes.openapi(chatRoute, async (c) => {
	try {
		const body = c.req.valid('json');

		const userInfo = {
			userId: body.userId,
			username: body.username,
			platform: body.platform || 'api',
			serverId: body.serverId,
			channelId: body.channelId,
			context: body.context
		};

		const result = await aiService.chat(body.message, userInfo);

		return c.json(result, result.success ? 200 : 500);
	} catch (error) {
		console.error('Chat API Error:', error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				response: 'Failed to process your message. Please try again.'
			},
			500
		);
	}
});
