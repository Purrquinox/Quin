import { z } from '@hono/zod-openapi';

export const conversationMessageSchema = z.object({
	id: z.number(),
	role: z.string().openapi({ description: 'Message role (user, assistant, system, tool)' }),
	content: z.string(),
	toolCallId: z.string().nullable(),
	toolName: z.string().nullable(),
	metadata: z.any().nullable(),
	createdAt: z.string().openapi({ description: 'ISO timestamp' })
});

export const conversationHistoryResponseSchema = z.object({
	success: z.boolean(),
	messages: z.array(conversationMessageSchema),
	count: z.number().openapi({ description: 'Total number of messages' })
});

export const clearHistoryResponseSchema = z.object({
	success: z.boolean(),
	message: z.string()
});

export const conversationSummaryResponseSchema = z.object({
	success: z.boolean(),
	summary: z.string().optional(),
	keyTopics: z.array(z.string()).optional(),
	learnedFacts: z.array(z.string()).optional(),
	messagesDeleted: z.number().optional(),
	error: z.string().optional()
});

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationHistoryResponse = z.infer<typeof conversationHistoryResponseSchema>;
export type ClearHistoryResponse = z.infer<typeof clearHistoryResponseSchema>;
export type ConversationSummaryResponse = z.infer<typeof conversationSummaryResponseSchema>;
