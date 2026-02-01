import { generateText, tool, gateway, ToolSet } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwitterApi } from 'twitter-api-v2';
import { data, secrets } from './helpers/data.js';
import { ConversationService } from './services/conversation.service.js';
import { UserProfileService } from './services/user-profile.service.js';
import { SearchTool } from './services/tools/search.tool.js';
import { TweetTool } from './services/tools/tweet.tool.js';
import { PurrdexTool } from './services/tools/purrdex.tool.js';
import { getRandomErrorMessage } from './utils/message.utils.js';

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
	serverId?: string; // Platform-agnostic: could be Discord server, Slack workspace, etc.
	channelId?: string; // Platform-agnostic: could be Discord channel, Slack channel, etc.
	platform?: string; // Optional: 'discord', 'slack', 'web', etc.
}

const template = fs.readFileSync(path.join(__dirname, '../dist/prompt.txt'), 'utf-8');
const renderTemplate = new Function('data', `return \`${template}\`;`);
const personality = renderTemplate(data);

const userContextTemplate = fs.readFileSync(
	path.join(__dirname, '../dist/user_context.txt'),
	'utf-8'
);
const renderUserContext = new Function('data', `return \`${userContextTemplate}\`;`);

export class AIMascotService {
	private config: AIMascotConfig;
	private systemPrompt: string;
	private conversationService: ConversationService;
	private userProfileService: UserProfileService;
	private searchTool: SearchTool;
	private tweetTool: TweetTool;
	private purrdexTool: PurrdexTool;

	constructor(config: Partial<AIMascotConfig> = {}) {
		this.config = {
			model: config.model || 'gpt-4o-mini',
			maxTokens: config.maxTokens || 2048,
			temperature: config.temperature || 0.8,
			enableTwitter: config.enableTwitter || false,
			twitterCooldown: config.twitterCooldown || 300000,
			maxTweetLength: config.maxTweetLength || 280,
			maxHistoryMessages: config.maxHistoryMessages || 7
		};

		this.systemPrompt = personality;
		this.conversationService = new ConversationService(this.config.maxHistoryMessages);
		this.userProfileService = new UserProfileService();
		this.searchTool = new SearchTool();
		this.purrdexTool = new PurrdexTool();

		let twitterClient: TwitterApi | undefined;
		if (this.config.enableTwitter && secrets.x) {
			try {
				twitterClient = new TwitterApi({
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
		this.tweetTool = new TweetTool(
			twitterClient,
			this.config.twitterCooldown,
			this.config.maxTweetLength
		);
	}

	private getModel() {
		return gateway(this.config.model);
	}

	private getTools = (userInfo?: UserInfo): ToolSet => {
		let tools: ToolSet = {};

		if (secrets.tavily?.api_key) {
			tools['search_internet'] = tool({
				description:
					'Search internet for current info, news, facts. Use for up-to-date data, verification, current events.',
				inputSchema: z.object({
					query: z.string().describe('Clear search query'),
					search_depth: z
						.enum(['basic', 'advanced'])
						.default('basic')
						.describe('basic=quick, advanced=deep'),
					max_results: z.number().min(1).max(10).default(5).describe('Results count (1-10)')
				}),
				execute: async ({ query, search_depth, max_results }) =>
					this.searchTool.search(query, search_depth || 'basic', max_results || 5)
			});
		}

		if (userInfo) {
			tools['learn_user_fact'] = tool({
				description:
					'Store NEW facts about user. Check [Already saved facts] first. Use freely when user shares life details, interests, work, personality.',
				inputSchema: z.object({
					fact: z.string().describe('Concise fact. Ex: "Loves pizza", "Software engineer"'),
					category: z
						.enum([
							'preference',
							'interest',
							'personal',
							'professional',
							'relationship',
							'personality'
						])
						.describe('Fact category')
				}),
				execute: async ({ fact, category }) =>
					this.userProfileService.learnUserFact(
						this.config.model,
						userInfo.userId,
						userInfo.username,
						fact,
						category
					)
			});
		}

		if (this.config.enableTwitter) {
			tools['post_tweet'] = tool({
				description:
					'Post tweet. ONLY when user EXPLICITLY ASKS to tweet. NOT for search results, info sharing, or routine responses.',
				inputSchema: z.object({
					content: z.string().describe('Tweet <280 chars, engaging, can use emojis/hashtags'),
					tweet_type: z
						.enum(['roast', 'affirmation', 'funny', 'requested', 'general'])
						.describe('Tweet type'),
					context: z.string().optional().describe('Why tweeting (for logs)')
				}),
				execute: async ({ content, tweet_type, context }) =>
					this.tweetTool.postTweet({ content, tweet_type, context })
			});
		}

		// Purrdex tools
		tools['purrdex_search'] = tool({
			description:
				'Search Purrdex knowledge base for entries about cats, cat care, cat behavior, cat health, etc. Returns matching entries with summaries.',
			inputSchema: z.object({
				query: z.string().describe('Search query for Purrdex entries'),
				category: z.string().optional().describe('Filter by category name'),
				tags: z.array(z.string()).optional().describe('Filter by tags'),
				limit: z.number().min(1).max(20).default(10).describe('Maximum results to return'),
				status: z
					.enum(['Draft', 'Published', 'Archived'])
					.default('Published')
					.describe('Entry status filter')
			}),
			execute: async ({ query, category, tags, limit, status }) =>
				this.purrdexTool.searchEntries({ query, category, tags, limit, status })
		});

		tools['purrdex_get_entry'] = tool({
			description:
				'Get full details of a specific Purrdex entry by ID or slug. Use this to read the complete content of an entry.',
			inputSchema: z.object({
				identifier: z.string().describe('Entry ID (number) or slug (text)'),
				incrementView: z
					.boolean()
					.default(true)
					.describe('Whether to increment view count (default true)')
			}),
			execute: async ({ identifier, incrementView }) =>
				this.purrdexTool.getEntry({ identifier, incrementView })
		});

		tools['purrdex_list_entries'] = tool({
			description:
				"List recent or popular Purrdex entries. Use this to browse entries or see what's available.",
			inputSchema: z.object({
				category: z.string().optional().describe('Filter by category'),
				orderBy: z
					.enum(['recent', 'popular', 'views'])
					.default('recent')
					.describe('Sort order: recent, popular, or views'),
				limit: z.number().min(1).max(20).default(10).describe('Maximum results'),
				status: z.enum(['Draft', 'Published', 'Archived']).default('Published')
			}),
			execute: async ({ category, orderBy, limit, status }) =>
				this.purrdexTool.listEntries({ category, orderBy, limit, status })
		});

		tools['purrdex_list_categories'] = tool({
			description: 'List all available Purrdex categories with entry counts. Useful for browsing.',
			inputSchema: z.object({}),
			execute: async () => this.purrdexTool.listCategories()
		});

		tools['purrdex_create_entry'] = tool({
			description:
				'Create a new Purrdex entry. Use this to add knowledge to the Purrdex database. Entries are automatically authored by Quin.',
			inputSchema: z.object({
				title: z.string().describe('Entry title'),
				summary: z.string().describe('Brief summary (2-3 sentences)'),
				content: z.string().describe('Full content in markdown format'),
				category: z.string().describe('Category name (must exist)'),
				tags: z.array(z.string()).optional().describe('Tags for categorization'),
				images: z.array(z.string()).optional().describe('Image URLs'),
				relatedEntries: z.array(z.string()).optional().describe('Related entry slugs'),
				status: z.enum(['Draft', 'Published', 'Archived']).default('Draft').describe('Entry status')
			}),
			execute: async ({
				title,
				summary,
				content,
				category,
				tags,
				images,
				relatedEntries,
				status
			}) =>
				this.purrdexTool.createEntry({
					title,
					summary,
					content,
					category,
					tags,
					images,
					relatedEntries,
					status
				})
		});

		return tools;
	};

	async chat(message: string, userInfo: UserInfo) {
		try {
			const conversation = await this.conversationService.getOrCreateConversation(userInfo);
			const learnedContext = await this.userProfileService.getUserContext(
				userInfo.userId,
				conversation.id
			);
			const historyMessages = this.conversationService.convertToAIMessages(
				conversation.QuinConversationMessage
			);

			const userContextInfo = renderUserContext({ userInfo, learnedContext });
			const enrichedSystemPrompt = `${this.systemPrompt}\n\n---\nCURRENT USER CONTEXT:\n${userContextInfo}`;

			const result = await generateText({
				model: this.getModel(),
				messages: [
					{ role: 'system', content: enrichedSystemPrompt },
					...historyMessages,
					{ role: 'user', content: message }
				],
				temperature: this.config.temperature,
				tools: this.getTools(userInfo)
			});

			let finalResponse = result.text?.trim();

			if (!finalResponse && result.toolResults?.length) {
				const hasSearchResults = result.toolResults.some((tr: any) => (tr.output || tr)?.results);

				if (hasSearchResults) {
					let enhanced = message;
					for (const tr of result.toolResults) {
						const data = tr.output || tr;
						if (data?.success && data?.results) {
							enhanced += `\n\n[Search: "${data.query}"]\n${data.answer}\n\nSources:\n${data.results.map((r: any, i: number) => `${i + 1}. ${r.title} - ${r.url}`).join('\n')}`;
						}
					}
					finalResponse = (
						await generateText({
							model: this.getModel(),
							messages: [
								{ role: 'system', content: enrichedSystemPrompt },
								...historyMessages,
								{ role: 'user', content: enhanced }
							],
							temperature: this.config.temperature
						})
					).text?.trim();
				} else {
					const toolMessages = result.toolResults
						.map((tr: any) => (tr.output || tr)?.message)
						.filter(Boolean);
					finalResponse = toolMessages.length ? toolMessages.join(' ') : undefined;
				}
			}

			if (!finalResponse) throw new Error('No response generated from AI');

			await Promise.all([
				this.conversationService.saveMessage(conversation.id, 'user', message, {
					userInfo,
					originalMessage: message
				}),
				this.conversationService.saveMessage(conversation.id, 'assistant', finalResponse)
			]);

			if (conversation.QuinConversationMessage.length >= 15) {
				this.conversationService
					.summarizeConversation(this.config.model, conversation.id)
					.catch((err) => console.error('Background summarization failed:', err));
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
				response: getRandomErrorMessage()
			};
		}
	}

	async clearConversationHistory(
		userId: string,
		platform: string = 'discord',
		serverId?: string,
		channelId?: string
	) {
		return this.conversationService.clearConversationHistory(userId, platform, serverId, channelId);
	}

	async getConversationHistory(
		userId: string,
		platform: string = 'discord',
		serverId?: string,
		channelId?: string
	) {
		return this.conversationService.getConversationHistory(userId, platform, serverId, channelId);
	}

	async summarizeConversation(conversationId: number) {
		return this.conversationService.summarizeConversation(this.config.model, conversationId);
	}
}

export default AIMascotService;
