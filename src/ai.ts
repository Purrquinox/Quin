import { generateText, streamText, tool, gateway, type ModelMessage, ToolSet } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwitterApi } from 'twitter-api-v2';
import { data, secrets } from './helpers/data.js';
import { prisma } from './lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AIMascotConfig {
	model: string;
	maxTokens: number;
	temperature: number;
	enableTwitter: boolean;
	twitterCooldown: number;
	maxTweetLength: number;
	maxHistoryMessages: number;
}

export interface UserInfo {
	userId: string;
	username: string;
	context?: Record<string, any>;
	discordServerId?: string;
	discordChannelId?: string;
}

const template = fs.readFileSync(path.join(__dirname, '../dist/prompt.txt'), 'utf-8');
const renderTemplate = new Function('data', `return \`${template}\`;`);
const personality = renderTemplate(data);

export class AIMascotService {
	private twitterClient?: TwitterApi;
	private config: AIMascotConfig;
	private lastTweetTime: number;
	private systemPrompt: string;

	constructor(config: Partial<AIMascotConfig> = {}) {
		// Enhanced configuration with defaults
		this.config = {
			model: config.model || 'gpt-4o-mini',
			maxTokens: config.maxTokens || 2048,
			temperature: config.temperature || 0.8,
			enableTwitter: config.enableTwitter || false,
			twitterCooldown: config.twitterCooldown || 300000, // 5 minutes
			maxTweetLength: config.maxTweetLength || 280,
			maxHistoryMessages: config.maxHistoryMessages || 7
		};

		// Initialize Twitter client if enabled and credentials are available
		if (this.config.enableTwitter && secrets.x) {
			try {
				this.twitterClient = new TwitterApi({
					appKey: secrets.x.app_key,
					appSecret: secrets.x.app_secret,
					accessToken: secrets.x.access_token,
					accessSecret: secrets.x.access_secret
				});
			} catch (error) {
				console.warn('Failed to initialize Twitter client:', error);
				this.config.enableTwitter = false;
			}
		}

		// Rate limiting timestamps
		this.lastTweetTime = 0;

		// System prompt for the AI mascot
		this.systemPrompt = personality;
	}

	// Get model with gateway wrapper
	private getModel() {
		return gateway(this.config.model);
	}

	// Define available tools using Vercel AI SDK format
	private getTools = (userInfo?: UserInfo): ToolSet => {
		let tools: ToolSet = {};

		// User learning tool - ALWAYS available
		if (userInfo) {
			tools['learn_user_fact'] = tool({
				description:
					'Store NEW factual information about the user. CRITICAL RULES: 1) NEVER use this for facts already shown in "[ALREADY KNOWN]" section - those are already stored! 2) ONLY use when user shares something brand new about themselves 3) DO NOT use for: casual responses, questions, information already in context, or things just discussed. This tool should be rare - maybe 1 in 20 messages.',
				inputSchema: z.object({
					fact: z
						.string()
						.describe(
							'A specific, memorable fact about the user. Be concise and clear. Examples: "Loves pizza", "Works as a software engineer", "Has a cat named Mittens"'
						),
					category: z
						.enum([
							'preference',
							'interest',
							'personal',
							'professional',
							'relationship',
							'personality'
						])
						.describe('The category of this fact')
				}),
				execute: async ({ fact, category }: { fact: string; category: string }) => {
					return this.learnUserFact(userInfo.userId, userInfo.username, fact, category);
				}
			});
		}

		// Twitter tool
		if (this.config.enableTwitter) {
			tools['post_tweet'] = tool({
				description:
					'Post a tweet to Twitter/X. Use this when you want to share something funny, roast someone (playfully), post daily affirmations, or when someone asks you to tweet something. Keep tweets engaging and true to your personality!',
				inputSchema: z.object({
					content: z
						.string()
						.describe(
							'The tweet content. Must be engaging, witty, and under 280 characters. Can include emojis and hashtags.'
						),
					tweet_type: z
						.enum(['roast', 'affirmation', 'funny', 'requested', 'general'])
						.describe('The type of tweet being posted'),
					context: z
						.string()
						.optional()
						.describe("Optional context about why you're tweeting this (for logging purposes)")
				}),
				execute: async ({
					content,
					tweet_type,
					context
				}: {
					content: string;
					tweet_type: string;
					context?: string;
				}) => {
					return this.postTweet({ content, tweet_type, context });
				}
			});
		}

		return tools;
	};

	// Get or create conversation in database
	private async getOrCreateConversation(userInfo: UserInfo) {
		const existing = await prisma.quinConversation.findFirst({
			where: {
				userId: userInfo.userId,
				discordServerId: userInfo.discordServerId || null,
				discordChannelId: userInfo.discordChannelId || null
			},
			include: {
				QuinConversationMessage: {
					orderBy: { createdAt: 'desc' },
					take: this.config.maxHistoryMessages
				}
			}
		});

		if (existing) {
			// Reverse to get chronological order after taking the most recent
			existing.QuinConversationMessage.reverse();
			return existing;
		}

		return await prisma.quinConversation.create({
			data: {
				userId: userInfo.userId,
				username: userInfo.username,
				discordServerId: userInfo.discordServerId,
				discordChannelId: userInfo.discordChannelId
			},
			include: {
				QuinConversationMessage: true
			}
		});
	}

	// Learn and store a fact about a user
	private async learnUserFact(userId: string, username: string, fact: string, category: string) {
		try {
			// Get existing profile
			const existingProfile = await prisma.quinUserProfile.findUnique({
				where: { userId }
			});

			// Check if fact already exists (case-insensitive comparison)
			const factLower = fact.toLowerCase().trim();
			if (
				existingProfile &&
				existingProfile.facts.some((f) => f.toLowerCase().trim() === factLower)
			) {
				return {
					success: true,
					message: `I already know that about you! 😊`,
					fact,
					category,
					duplicate: true,
					totalFacts: existingProfile.facts.length
				};
			}

			// Add new fact
			const profile = await prisma.quinUserProfile.upsert({
				where: { userId },
				update: {
					facts: { push: fact },
					username: username,
					lastInteraction: new Date()
				},
				create: {
					userId,
					username,
					facts: [fact],
					lastInteraction: new Date()
				}
			});

			return {
				success: true,
				message: `Got it! I'll remember that about you. 💭`,
				fact,
				category,
				duplicate: false,
				totalFacts: profile.facts.length
			};
		} catch (error) {
			console.error('Error learning user fact:', error);
			return {
				success: false,
				message: 'I tried to remember that, but had a little hiccup. 😅',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	// Get user profile with learned facts
	private async getUserProfile(userId: string) {
		return await prisma.quinUserProfile.findUnique({
			where: { userId }
		});
	}

	// Build rich user context from profile and conversation summary
	private async getUserContext(userId: string, conversationId?: number) {
		const profile = await this.getUserProfile(userId);

		let summary = null;
		if (conversationId) {
			summary = await prisma.quinConversationSummary.findUnique({
				where: { conversationId }
			});
		}

		// Build a compact context string (token-efficient)
		const parts: string[] = [];

		if (profile && profile.facts.length > 0) {
			// Only include most recent 5 facts
			const recentFacts = profile.facts.slice(-5);
			parts.push(`What I know: ${recentFacts.join('; ')}`);
		}

		if (summary && summary.keyTopics.length > 0) {
			parts.push(`Recent topics: ${summary.keyTopics.slice(-3).join(', ')}`);
		}

		return parts.length > 0 ? parts.join(' | ') : 'First time chatting';
	}

	// Convert database messages to Vercel AI SDK format
	private convertToAIMessages(dbMessages: any[]): ModelMessage[] {
		return dbMessages
			.filter((msg) => msg.role !== 'tool') // Exclude tool messages to prevent re-execution
			.map((msg) => {
				const message: ModelMessage = {
					role: msg.role as 'user' | 'assistant' | 'system',
					content: msg.content
				};

				return message;
			});
	}

	// Save message to database
	private async saveMessage(
		conversationId: number,
		role: string,
		content: string,
		metadata?: any,
		toolCallId?: string,
		toolName?: string
	) {
		return await prisma.quinConversationMessage.create({
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

	// Main chat method with Vercel AI SDK and database persistence
	async chat(message: string, userInfo: UserInfo) {
		try {
			// Get or create conversation first
			const conversation = await this.getOrCreateConversation(userInfo);

			// Get smart user context (token-efficient)
			const learnedContext = await this.getUserContext(userInfo.userId, conversation.id);

			// Build the user context for personalization (for THIS message only)
			let userContext: string;
			try {
				const contextData = { userInfo, message, learnedContext };
				const template = fs.readFileSync(path.join(__dirname, '../dist/user_context.txt'), 'utf-8');
				const renderTemplate = new Function('data', `return \`${template}\`;`);
				userContext = renderTemplate(contextData);
			} catch (error) {
				console.warn('Failed to load user context template:', error);
				userContext = `User: ${userInfo.username}
${learnedContext}
Message: ${message}`;
			}

			// Get conversation history from database (already limited to maxHistoryMessages)
			const historyMessages = this.convertToAIMessages(conversation.QuinConversationMessage);

			// Build messages array
			const messages: ModelMessage[] = [
				{
					role: 'system',
					content: this.systemPrompt
				},
				...historyMessages,
				{
					role: 'user',
					content: userContext
				}
			];

			// Get tools with userInfo for learning
			const tools = this.getTools(userInfo);

			// Generate response using Vercel AI SDK with Gateway
			const result = await generateText({
				model: this.getModel(),
				messages,
				temperature: this.config.temperature,
				tools: tools
			});

			let finalResponse = result.text;

			// If no text response but tools were called, provide tool-specific fallback
			if (
				(!finalResponse || finalResponse.trim().length === 0) &&
				result.toolCalls &&
				result.toolCalls.length > 0
			) {
				const toolName = result.toolCalls[0].toolName;
				if (toolName === 'learn_user_fact') {
					finalResponse = "Got it! I've made a note of that. 💭";
				} else if (toolName === 'post_tweet') {
					finalResponse = 'Tweet posted! 🐦✨';
				} else {
					finalResponse = 'Done! ✅';
				}
			}

			// If still no response, throw error
			if (!finalResponse || finalResponse.trim().length === 0) {
				throw new Error('No response generated from AI');
			}

			// Save CLEAN user message to database (without the context wrapper)
			await this.saveMessage(conversation.id, 'user', message, {
				userInfo,
				originalMessage: message
			});

			// Save assistant response to database
			await this.saveMessage(conversation.id, 'assistant', finalResponse);

			// Note: We intentionally DON'T save tool calls to prevent re-execution
			// Tool calls are ephemeral - they execute once and their results are incorporated
			// into the assistant's final response

			// Auto-summarize if conversation gets too long (every 15 messages)
			if (conversation.QuinConversationMessage.length >= 15) {
				// Run summarization in background (don't await)
				this.summarizeConversation(conversation.id).catch((err) =>
					console.error('Background summarization failed:', err)
				);
			}

			return {
				success: true,
				response: finalResponse,
				conversationId: conversation.id,
				toolCalls: result.toolCalls || [],
				toolResults: result.toolResults || [],
				usage: result.usage,
				finishReason: result.finishReason
			};
		} catch (error) {
			console.error('AI Service Error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				response: this.getRandomErrorMessage()
			};
		}
	}

	// Enhanced streaming method with Vercel AI SDK and database persistence
	async chatStream(message: string, userInfo: UserInfo) {
		try {
			// Get or create conversation first
			const conversation = await this.getOrCreateConversation(userInfo);

			// Get smart user context (token-efficient)
			const learnedContext = await this.getUserContext(userInfo.userId, conversation.id);

			let userContext: string;
			try {
				const contextData = { userInfo, message, learnedContext };
				const template = fs.readFileSync(path.join(__dirname, '../dist/user_context.txt'), 'utf-8');
				const renderTemplate = new Function('data', `return \`${template}\`;`);
				userContext = renderTemplate(contextData);
			} catch (error) {
				console.warn('Failed to load user context template:', error.message);
				userContext = `User: ${userInfo.username || 'Anonymous'}
${learnedContext}
Message: ${message}`;
			}

			// Get conversation history from database (already limited to maxHistoryMessages)
			const historyMessages = this.convertToAIMessages(conversation.QuinConversationMessage);

			const messages: ModelMessage[] = [
				{
					role: 'system',
					content: this.systemPrompt
				},
				...historyMessages,
				{
					role: 'user',
					content: userContext
				}
			];

			const tools = this.getTools(userInfo);

			// Generate streaming response using Vercel AI SDK with Gateway
			const result = streamText({
				model: this.getModel(),
				messages,
				temperature: this.config.temperature,
				tools: Object.keys(tools).length > 0 ? tools : undefined
			});

			// Save user message to database
			await this.saveMessage(conversation.id, 'user', userContext, {
				userInfo,
				originalMessage: message
			});

			// Return stream and conversation info
			return {
				success: true,
				stream: result,
				conversationId: conversation.id
			};
		} catch (error) {
			console.error('AI Service Error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				stream: null
			};
		}
	}

	// Twitter posting functionality
	private async postTweet(args: { content: string; tweet_type: string; context?: string }) {
		if (!this.config.enableTwitter || !this.twitterClient) {
			throw new Error('Twitter functionality is not enabled or configured');
		}

		// Rate limiting check
		const now = Date.now();
		if (now - this.lastTweetTime < this.config.twitterCooldown) {
			const remainingTime = Math.ceil(
				(this.config.twitterCooldown - (now - this.lastTweetTime)) / 1000
			);
			throw new Error(`Tweet cooldown active. Please wait ${remainingTime} seconds.`);
		}

		// Validate tweet content
		if (!args.content || args.content.trim().length === 0) {
			throw new Error('Tweet content cannot be empty');
		}

		if (args.content.length > this.config.maxTweetLength) {
			throw new Error(`Tweet too long. Maximum ${this.config.maxTweetLength} characters allowed.`);
		}

		try {
			// Post the tweet
			const tweet = await this.twitterClient.v2.tweet(args.content);

			// Update last tweet time
			this.lastTweetTime = now;

			return {
				success: true,
				tweet_id: `heypurrquinox/${tweet.data.id}`,
				tweet_type: args.tweet_type,
				content: args.content,
				posted_at: new Date().toISOString(),
				message: 'Tweet posted successfully! 🐦✨'
			};
		} catch (error) {
			console.error('Twitter API Error:', error);
			throw new Error(
				`Failed to post tweet: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Clear conversation history for a user (database-based)
	async clearConversationHistory(
		userId: string,
		discordServerId?: string,
		discordChannelId?: string
	) {
		const conversation = await prisma.quinConversation.findFirst({
			where: {
				userId,
				discordServerId: discordServerId || null,
				discordChannelId: discordChannelId || null
			}
		});

		if (conversation) {
			await prisma.quinConversationMessage.deleteMany({
				where: { conversationId: conversation.id }
			});
		}
	}

	// Get conversation history from database
	async getConversationHistory(
		userId: string,
		discordServerId?: string,
		discordChannelId?: string
	) {
		const conversation = await prisma.quinConversation.findFirst({
			where: {
				userId,
				discordServerId: discordServerId || null,
				discordChannelId: discordChannelId || null
			},
			include: {
				QuinConversationMessage: {
					orderBy: { createdAt: 'asc' }
				}
			}
		});

		return conversation?.QuinConversationMessage || [];
	}

	// Summarize a conversation to save tokens (call periodically)
	async summarizeConversation(conversationId: number) {
		try {
			const conversation = await prisma.quinConversation.findUnique({
				where: { id: conversationId },
				include: {
					QuinConversationMessage: {
						orderBy: { createdAt: 'asc' }
					}
				}
			});

			if (!conversation || conversation.QuinConversationMessage.length < 10) {
				return { success: false, message: 'Not enough messages to summarize' };
			}

			// Build conversation text for summarization
			const conversationText = conversation.QuinConversationMessage.filter(
				(msg) => msg.role !== 'tool'
			)
				.map((msg) => `${msg.role}: ${msg.content}`)
				.join('\n');

			// Ask AI to summarize
			const summaryResult = await generateText({
				model: this.getModel(),
				messages: [
					{
						role: 'system',
						content:
							'You are a conversation summarizer. Extract: 1) Key topics discussed, 2) Important facts learned about the user, 3) Overall sentiment. Be concise.'
					},
					{
						role: 'user',
						content: `Summarize this conversation:\n\n${conversationText}`
					}
				],
				temperature: 0.3
			});

			const summary = summaryResult.text;

			// Parse out key topics and facts (simple extraction)
			const topicMatches = summary.match(/topics?:([^.]*)/i);
			const factMatches = summary.match(/facts?:([^.]*)/i);

			const keyTopics = topicMatches
				? topicMatches[1]
						.split(',')
						.map((t) => t.trim())
						.filter(Boolean)
				: [];
			const learnedFacts = factMatches
				? factMatches[1]
						.split(',')
						.map((f) => f.trim())
						.filter(Boolean)
				: [];

			// Save summary
			await prisma.quinConversationSummary.upsert({
				where: { conversationId },
				update: {
					summary,
					keyTopics,
					learnedFacts,
					lastSummaryAt: new Date()
				},
				create: {
					conversationId,
					summary,
					keyTopics,
					learnedFacts
				}
			});

			// Delete old messages (keep only recent 7)
			const messagesToKeep = conversation.QuinConversationMessage.slice(-7).map((m) => m.id);
			await prisma.quinConversationMessage.deleteMany({
				where: {
					conversationId,
					id: { notIn: messagesToKeep }
				}
			});

			return {
				success: true,
				summary,
				keyTopics,
				learnedFacts,
				messagesDeleted: conversation.QuinConversationMessage.length - 7
			};
		} catch (error) {
			console.error('Error summarizing conversation:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	// Get random error message for personality
	private getRandomErrorMessages(): string[] {
		return [
			'Oops! My circuits got a bit tangled there. Even AI mascots have their off days! 🤖💥',
			"*System overload detected* Just kidding! Something went wrong, but I'm still fabulous! ✨",
			"Error 404: Sass not found... wait, that can't be right! Let me try that again! 💅",
			'Beep boop! Even digital beings need a coffee break sometimes! ☕🤖',
			'My bad! Looks like I tried to be too clever and broke something. Classic me! 😅'
		];
	}

	private getRandomErrorMessage(): string {
		const messages = this.getRandomErrorMessages();
		return messages[Math.floor(Math.random() * messages.length)];
	}

	// Enhanced utility method to get service status
	async getStatus() {
		const conversationCount = await prisma.quinConversation.count();
		return {
			model: this.config.model,
			twitterEnabled: this.config.enableTwitter,
			lastTweetTime: this.lastTweetTime,
			tweetCooldownRemaining: Math.max(
				0,
				this.config.twitterCooldown - (Date.now() - this.lastTweetTime)
			),
			activeConversations: conversationCount
		};
	}

	// Method to manually trigger a tweet (for admin use)
	async manualTweet(content: string, tweetType: string = 'general', context?: string) {
		return await this.postTweet({ content, tweet_type: tweetType, context });
	}

	// Get tweet suggestions based on recent conversations
	async getTweetSuggestions(limit: number = 3) {
		const suggestions = [];

		// This could analyze recent conversations and suggest tweets
		// For now, just return some example suggestions
		suggestions.push(
			{
				type: 'affirmation',
				content: "Remember: You're not just surviving, you're thriving! 🌟 #MondayMotivation"
			},
			{ type: 'funny', content: 'Me: *exists*\nBugs: "And I took that personally" 🐛💻 #DevLife' },
			{
				type: 'roast',
				content:
					"Just witnessed someone try to center a div for 3 hours. I can't even... 🤦‍♀️ #CSSStruggles"
			}
		);

		return suggestions.slice(0, limit);
	}
}

export default AIMascotService;
