import OpenAI from 'openai';
import fs from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import { data, secrets } from '../helpers/data.js';
import { ChatModel } from 'openai/resources';

interface AIMascotConfig {
	model: ChatModel;
	maxTokens: number;
	temperature: number;
	enableTwitter: boolean;
	twitterCooldown: number;
	maxTweetLength: number;
}

interface UserInfo {
	userId?: string;
	username?: string;
	context?: Record<string, any>;
	discordServerId?: string;
	discordChannelId?: string;
}

const template = fs.readFileSync('./dist/prompt.txt', 'utf-8');
const renderTemplate = new Function('data', `return \`${template}\`;`);
const personality = renderTemplate(data);

export class AIMascotService {
	private openai: OpenAI;
	private twitterClient?: TwitterApi;
	private config: AIMascotConfig;
	private lastTweetTime: number;
	private systemPrompt: string;
	private conversationHistory: Map<string, OpenAI.Chat.Completions.ChatCompletionMessageParam[]>;

	constructor(config: AIMascotConfig) {
		this.openai = new OpenAI({
			apiKey: secrets.openai.token
		});

		// Enhanced configuration with defaults
		this.config = {
			model: config.model || 'gpt-4o-mini',
			maxTokens: config.maxTokens || 2048,
			temperature: config.temperature || 0.8,
			enableTwitter: config.enableTwitter || false,
			twitterCooldown: config.twitterCooldown || 300000, // 5 minutes
			maxTweetLength: config.maxTweetLength || 280
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
				console.warn('Failed to initialize Twitter client:', error.message);
				this.config.enableTwitter = false;
			}
		}

		// Rate limiting timestamps
		this.lastTweetTime = 0;

		// System prompt for the AI mascot
		this.systemPrompt = personality;

		// Conversation history for context (optional feature)
		this.conversationHistory = new Map();
	}

	// Define available tools (for function calling)
	private getTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
		const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];

		// Twitter tool
		if (this.config.enableTwitter) {
			tools.push({
				type: 'function',
				function: {
					name: 'post_tweet',
					description:
						'Post a tweet to Twitter/X. Use this when you want to share something funny, roast someone (playfully), post daily affirmations, or when someone asks you to tweet something. Keep tweets engaging and true to your personality!',
					parameters: {
						type: 'object',
						properties: {
							content: {
								type: 'string',
								description:
									'The tweet content. Must be engaging, witty, and under 280 characters. Can include emojis and hashtags.'
							},
							tweet_type: {
								type: 'string',
								enum: ['roast', 'affirmation', 'funny', 'requested', 'general'],
								description: 'The type of tweet being posted'
							},
							context: {
								type: 'string',
								description:
									"Optional context about why you're tweeting this (for logging purposes)"
							}
						},
						required: ['content', 'tweet_type']
					}
				}
			});
		}

		return tools;
	}

	// Main chat method with enhanced error handling
	async chat(message: string, userInfo: UserInfo) {
		try {
			const contextData = { userInfo: userInfo, message: message };

			// Build the user context for personalization
			let userContext: string;
			try {
				const template = fs.readFileSync('./dist/user_context.txt', 'utf-8');
				const renderTemplate = new Function('data', `return \`${template}\`;`);
				userContext = renderTemplate(contextData);
			} catch (error) {
				console.warn('Failed to load user context template:', error.message);
				userContext = `User: ${userInfo.username || 'Anonymous'}\nMessage: ${message}`;
			}

			const tools = this.getTools();

			// Get conversation history for better context (optional)
			const conversationId = userInfo.userId || 'default';
			const history = this.conversationHistory.get(conversationId) || [];

			// Build messages array
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
				{
					role: 'system',
					content: this.systemPrompt
				},
				...history.slice(-4), // Keep last 4 messages for context
				{
					role: 'user',
					content: userContext
				}
			];

			// Prepare the completion request
			const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: this.config.model,
				messages,
				temperature: this.config.temperature,
				max_tokens: this.config.maxTokens,
				tools: tools,
				tool_choice: 'auto'
			};

			const result = await this.openai.chat.completions.create(completionParams);
			const choice = result.choices[0];

			// Handle tool calls if present
			let finalResponse = choice.message.content || '';
			let toolResults = [];

			if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
				toolResults = await this.handleToolCalls(choice.message.tool_calls);

				// Get follow-up response after tool execution
				const followUpMessages = [...messages, choice.message, ...toolResults];

				const followUpResult = await this.openai.chat.completions.create({
					model: this.config.model,
					messages: followUpMessages,
					temperature: this.config.temperature,
					max_tokens: this.config.maxTokens
				});

				finalResponse = followUpResult.choices[0].message.content || finalResponse;
			}

			// Update conversation history
			this.updateConversationHistory(conversationId, [
				{ role: 'user', content: userContext },
				{ role: 'assistant', content: finalResponse }
			]);

			return {
				success: true,
				response: finalResponse,
				toolCalls: choice.message.tool_calls || [],
				toolResults,
				usage: result.usage,
				finishReason: choice.finish_reason,
				model: result.model,
				id: result.id
			};
		} catch (error) {
			console.error('AI Service Error:', error);
			return {
				success: false,
				error: error.message,
				response: this.getRandomErrorMessage()
			};
		}
	}

	// Enhanced streaming method
	async chatStream(message: string, userInfo: UserInfo) {
		try {
			const contextData = { userInfo, message };

			let userContext: string;
			try {
				const template = fs.readFileSync('./dist/user_context.txt', 'utf-8');
				const renderTemplate = new Function('data', `return \`${template}\`;`);
				userContext = renderTemplate(contextData);
			} catch (error) {
				console.warn('Failed to load user context template:', error.message);
				userContext = `User: ${userInfo.username || 'Anonymous'}\nMessage: ${message}`;
			}

			const tools = this.getTools();
			const conversationId = userInfo.userId || 'default';
			const history = this.conversationHistory.get(conversationId) || [];

			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
				{
					role: 'system',
					content: this.systemPrompt
				},
				...history.slice(-4),
				{
					role: 'user',
					content: userContext
				}
			];

			// Prepare the streaming completion request
			const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: this.config.model,
				messages,
				temperature: this.config.temperature,
				max_tokens: this.config.maxTokens,
				stream: true,
				tools: tools,
				tool_choice: 'auto'
			};

			const stream = await this.openai.chat.completions.create(completionParams);

			return {
				success: true,
				stream: stream
			};
		} catch (error) {
			console.error('AI Service Error:', error);
			return {
				success: false,
				error: error.message,
				stream: null
			};
		}
	}

	// Enhanced tool call handling
	async handleToolCalls(toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]) {
		const toolResponses: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

		for (const toolCall of toolCalls) {
			try {
				const result = await this.executeToolCall(toolCall);

				toolResponses.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: JSON.stringify(result)
				});
			} catch (error) {
				console.error(`Tool execution error for ${toolCall.id}:`, error);
				toolResponses.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: JSON.stringify({
						error: error.message,
						success: false
					})
				});
			}
		}

		return toolResponses;
	}

	// Tool execution with Twitter support
	async executeToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall) {
		if (toolCall.type !== 'function') {
			throw new Error(`Unsupported tool call type: ${toolCall.type}`);
		}

		// Narrow type to ChatCompletionMessageFunctionToolCall
		const funcCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
		const { name, arguments: args } = funcCall.function;

		const parsedArgs = JSON.parse(args);

		switch (name) {
			case 'post_tweet':
				return await this.postTweet(parsedArgs);
			default:
				throw new Error(`Tool ${name} not implemented`);
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

			// Log the tweet for monitoring
			console.log(`Tweet posted [${args.tweet_type}]:`, args.content);
			if (args.context) {
				console.log(`Context:`, args.context);
			}

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
			throw new Error(`Failed to post tweet: ${error.message}`);
		}
	}

	// Conversation history management
	private updateConversationHistory(
		conversationId: string,
		messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
	) {
		const current = this.conversationHistory.get(conversationId) || [];
		const updated = [...current, ...messages];

		// Keep only the last 10 messages to prevent memory issues
		const trimmed = updated.slice(-10);
		this.conversationHistory.set(conversationId, trimmed);
	}

	// Clear conversation history for a user
	clearConversationHistory(conversationId: string) {
		this.conversationHistory.delete(conversationId);
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
	getStatus() {
		return {
			model: this.config.model,
			twitterEnabled: this.config.enableTwitter,
			lastTweetTime: this.lastTweetTime,
			tweetCooldownRemaining: Math.max(
				0,
				this.config.twitterCooldown - (Date.now() - this.lastTweetTime)
			),
			activeConversations: this.conversationHistory.size
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
