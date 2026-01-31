import { generateText, gateway, type ModelMessage } from 'ai';
import { prisma } from '../lib/prisma.js';
import type { UserInfo } from '../ai.js';

export class ConversationService {
	private maxHistoryMessages: number;

	constructor(maxHistoryMessages: number = 7) {
		this.maxHistoryMessages = maxHistoryMessages;
	}

	async getOrCreateConversation(userInfo: UserInfo) {
		const existing = await prisma.quinConversation.findFirst({
			where: {
				userId: userInfo.userId,
				platform: userInfo.platform || 'discord',
				serverId: userInfo.serverId || null,
				channelId: userInfo.channelId || null
			},
			include: {
				QuinConversationMessage: {
					orderBy: { createdAt: 'desc' },
					take: this.maxHistoryMessages
				}
			}
		});

		if (existing) {
			existing.QuinConversationMessage.reverse();
			return existing;
		}

		return await prisma.quinConversation.create({
			data: {
				userId: userInfo.userId,
				username: userInfo.username,
				platform: userInfo.platform || 'discord',
				serverId: userInfo.serverId,
				channelId: userInfo.channelId
			},
			include: {
				QuinConversationMessage: true
			}
		});
	}

	saveMessage(
		conversationId: number,
		role: string,
		content: string,
		metadata?: any,
		toolCallId?: string,
		toolName?: string
	) {
		return prisma.quinConversationMessage.create({
			data: {
				conversationId,
				role,
				content,
				toolCallId,
				toolName,
				metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null
			}
		});
	}

	async clearConversationHistory(
		userId: string,
		platform: string = 'discord',
		serverId?: string,
		channelId?: string
	) {
		const conversation = await prisma.quinConversation.findFirst({
			where: { userId, platform, serverId: serverId || null, channelId: channelId || null }
		});
		if (conversation)
			await prisma.quinConversationMessage.deleteMany({
				where: { conversationId: conversation.id }
			});
	}

	async getConversationHistory(
		userId: string,
		platform: string = 'discord',
		serverId?: string,
		channelId?: string
	) {
		const conversation = await prisma.quinConversation.findFirst({
			where: { userId, platform, serverId: serverId || null, channelId: channelId || null },
			include: { QuinConversationMessage: { orderBy: { createdAt: 'asc' } } }
		});
		return conversation?.QuinConversationMessage || [];
	}

	async summarizeConversation(model: string, conversationId: number) {
		try {
			const conv = await prisma.quinConversation.findUnique({
				where: { id: conversationId },
				include: { QuinConversationMessage: { orderBy: { createdAt: 'asc' } } }
			});

			if (!conv || conv.QuinConversationMessage.length < 10)
				return { success: false, message: 'Not enough messages' };

			const text = conv.QuinConversationMessage.filter((m) => m.role !== 'tool')
				.map((m) => `${m.role}: ${m.content}`)
				.join('\n');

			const summary = (
				await generateText({
					model: gateway(model),
					messages: [
						{
							role: 'system',
							content:
								'Summarize conversation. Extract: 1) Key topics, 2) User facts, 3) Sentiment. Be concise.'
						},
						{ role: 'user', content: `Summarize:\n\n${text}` }
					],
					temperature: 0.3
				})
			).text;

			const extract = (regex: RegExp) =>
				regex.test(summary)
					? summary
							.match(regex)![1]
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean)
					: [];
			const keyTopics = extract(/topics?:([^.]*)/i);
			const learnedFacts = extract(/facts?:([^.]*)/i);

			await prisma.quinConversationSummary.upsert({
				where: { conversationId },
				update: { summary, keyTopics, learnedFacts, lastSummaryAt: new Date() },
				create: { conversationId, summary, keyTopics, learnedFacts }
			});

			const keep = conv.QuinConversationMessage.slice(-7).map((m) => m.id);
			await prisma.quinConversationMessage.deleteMany({
				where: { conversationId, id: { notIn: keep } }
			});

			return {
				success: true,
				summary,
				keyTopics,
				learnedFacts,
				messagesDeleted: conv.QuinConversationMessage.length - 7
			};
		} catch (error) {
			console.error('Error summarizing conversation:', error);
			return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
		}
	}

	convertToAIMessages(dbMessages: any[]): ModelMessage[] {
		return dbMessages
			.filter((msg) => msg.role !== 'tool')
			.map((msg) => ({
				role: msg.role as 'user' | 'assistant' | 'system',
				content: msg.content
			}));
	}
}
