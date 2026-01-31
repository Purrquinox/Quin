import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
	userProfileResponseSchema,
	addFactRequestSchema,
	addFactResponseSchema
} from '../schemas/user.schema.js';
import { UserProfileService } from '../../services/user-profile.service.js';

const userProfileService = new UserProfileService();

export const userRoutes = new OpenAPIHono();

// Get user profile
const getProfileRoute = createRoute({
	method: 'get',
	path: '/{userId}/profile',
	tags: ['Users'],
	summary: 'Get user profile',
	description: 'Retrieve stored profile information and learned facts about a user',
	request: {
		params: z.object({
			userId: z.string().openapi({ param: { name: 'userId', in: 'path' }, example: 'user123' })
		})
	},
	responses: {
		200: {
			content: {
				'application/json': {
					schema: userProfileResponseSchema
				}
			},
			description: 'User profile retrieved successfully'
		}
	}
});

userRoutes.openapi(getProfileRoute, (async (c) => {
	const { userId } = c.req.valid('param');
	const profile = await userProfileService.getProfile(userId);

	if (!profile) {
		return c.json({
			success: true,
			profile: null
		});
	}

	return c.json({
		success: true,
		profile: {
			userId: profile.userId,
			username: profile.username,
			displayName: profile.displayName,
			facts: profile.facts,
			personality: profile.personality,
			lastInteraction: profile.lastInteraction.toISOString(),
			createdAt: profile.createdAt.toISOString()
		}
	});
}) as any);

// Add fact to user profile
const addFactRoute = createRoute({
	method: 'post',
	path: '/{userId}/facts',
	tags: ['Users'],
	summary: 'Add a fact about the user',
	description: 'Store a new fact about the user. The system automatically checks for duplicates.',
	request: {
		params: z.object({
			userId: z.string().openapi({ param: { name: 'userId', in: 'path' } })
		}),
		body: {
			content: {
				'application/json': {
					schema: addFactRequestSchema.extend({
						username: z
							.string()
							.openapi({ description: 'Username for the profile', example: 'john_doe' })
					})
				}
			}
		}
	},
	responses: {
		200: {
			content: {
				'application/json': {
					schema: addFactResponseSchema
				}
			},
			description: 'Fact added successfully'
		}
	}
});

userRoutes.openapi(addFactRoute, (async (c) => {
	const { userId } = c.req.valid('param');
	const { fact, category, username } = c.req.valid('json');

	const result = await userProfileService.learnFact(userId, username, fact, category);

	return c.json(result);
}) as any);
