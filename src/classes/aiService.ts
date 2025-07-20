import { generateText, tool } from 'ai';
import fs from 'fs';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import axios from 'axios';
import { z } from 'zod';
import { data } from '@/helpers/data.js';
import path from 'path';

interface AIMascotConfig {
	openRouterApiKey: string;
	model: string;
	maxTokens: number;
	temperature: number;
	twitterBearerToken?: string;
	twitterApiKey?: string;
	twitterApiSecret?: string;
	twitterAccessToken?: string;
	twitterAccessSecret?: string;
	searchApiKey?: string;
	maxSearchResults: number;
	searchCooldown: number;
}

const template = fs.readFileSync(path.join('../prompt.txt'), 'utf-8');
const renderTemplate = new Function('data', `return \`${template}\`;`);
const personality = renderTemplate(data);

export class AIMascotService {
	openrouter: ReturnType<typeof createOpenRouter>;
	config: AIMascotConfig;
	lastSearchTime: number;
	systemPrompt: string;

	constructor(config: AIMascotConfig) {
		// Initialize OpenRouter client
		this.openrouter = createOpenRouter({
			apiKey: config.openRouterApiKey
		});

		// Configuration
		this.config = {
			model: config.model,
			maxTokens: config.maxTokens || 2048,
			temperature: config.temperature || 0.8,

			// OpenRouter API key
			openRouterApiKey: config.openRouterApiKey,

			// Twitter/X API credentials
			twitterBearerToken: config.twitterBearerToken,
			twitterApiKey: config.twitterApiKey,
			twitterApiSecret: config.twitterApiSecret,
			twitterAccessToken: config.twitterAccessToken,
			twitterAccessSecret: config.twitterAccessSecret,

			// Search API for internet access
			searchApiKey: config.searchApiKey,

			// Rate limiting
			maxSearchResults: config.maxSearchResults || 5,
			searchCooldown: config.searchCooldown || 10000 // 10 seconds
		};

		// Rate limiting for searches
		this.lastSearchTime = 0;

		// System prompt for the AI mascot
		this.systemPrompt = personality;
	}

	// Define available tools
	getTools() {
		return {
			searchInternet: tool({
				description:
					'Search the internet for current information, news, or facts to enhance responses with up-to-date data',
				parameters: z.object({
					query: z.string().describe('The search query to find relevant information'),
					reason: z
						.string()
						.describe(
							'Why you want to search (e.g., "to fact-check", "to get current info", "to find roast material")'
						)
				}),
				execute: async ({ query, reason }) => {
					return await this.searchInternet(query, reason);
				}
			}),

			postTweet: tool({
				description:
					'Post a tweet when you have something particularly clever, funny, or noteworthy to share',
				parameters: z.object({
					content: z.string().max(280).describe('The tweet content (max 280 characters)'),
					reason: z.string().describe('Why this deserves a tweet')
				}),
				execute: async ({ content, reason }) => {
					return await this.postTweet(content, reason);
				}
			})
		};
	}

	// Main chat method
	async chat(
		message,
		userInfo: {
			userId?: string;
			username?: string;
			context?: Record<string, any>;
		}
	) {
		try {
			const { userId = 'anonymous', username = 'User', context = {} } = userInfo;

			// Build the user context for personalization
			const userContext = `
User Info:
- Username: ${username}
- User ID: ${userId}
- Context: ${JSON.stringify(context, null, 2)}

Current message: "${message}"
`;

			const result = await generateText({
				model: this.openrouter(this.config.model),
				system: this.systemPrompt,
				prompt: userContext,
				temperature: this.config.temperature,
				tools: this.getTools()
			});

			return {
				success: true,
				response: result.text,
				toolCalls: result.toolCalls || [],
				usage: result.usage,
				finishReason: result.finishReason
			};
		} catch (error) {
			console.error('AI Service Error:', error);
			return {
				success: false,
				error: error.message,
				response:
					'Oops! My circuits got a bit tangled there. Even AI mascots have their off days! 🤖💥'
			};
		}
	}

	// Internet search functionality
	async searchInternet(query, reason) {
		try {
			// Rate limiting check
			const now = Date.now();
			if (now - this.lastSearchTime < this.config.searchCooldown) {
				return {
					error: 'Search cooldown active',
					message: 'Hold your horses! I need a moment between searches.'
				};
			}

			if (!this.config.searchApiKey) {
				return {
					error: 'No search API key configured',
					message: 'I would search the internet for you, but I need an API key first!'
				};
			}

			// Using SerpAPI as an example - you can swap this for any search API
			const searchUrl = 'https://serpapi.com/search';
			const params = {
				q: query,
				api_key: this.config.searchApiKey,
				engine: 'google',
				num: this.config.maxSearchResults,
				gl: 'us',
				hl: 'en'
			};

			const response = await axios.get(searchUrl, { params, timeout: 10000 });
			this.lastSearchTime = now;

			if (response.data.organic_results) {
				const results = response.data.organic_results.slice(0, this.config.maxSearchResults);
				const searchSummary = results.map((result) => ({
					title: result.title,
					snippet: result.snippet,
					link: result.link
				}));

				return {
					success: true,
					query,
					reason,
					results: searchSummary,
					message: `Found ${results.length} results for "${query}". Time to drop some knowledge! 🔍`
				};
			}

			return {
				success: false,
				message: 'Search came up empty. Even the internet is speechless!'
			};
		} catch (error) {
			console.error('Search error:', error);
			return {
				error: 'Search failed',
				message: 'The internet is being difficult right now. Typical! 🌐💔'
			};
		}
	}

	// Twitter/X posting functionality
	async postTweet(content, reason) {
		try {
			if (!this.config.twitterApiKey) {
				return {
					error: 'No Twitter API credentials configured',
					message: 'I would tweet this masterpiece, but I need Twitter API access first!'
				};
			}

			// Using Twitter API v2
			const tweetUrl = 'https://api.twitter.com/2/tweets';

			// This is a simplified example - you'd need proper OAuth 1.0a signing
			// Consider using a library like 'twitter-api-v2' for production
			const tweetData = {
				text: content
			};

			const response = await axios.post(tweetUrl, tweetData, {
				headers: {
					Authorization: `Bearer ${this.config.twitterBearerToken}`,
					'Content-Type': 'application/json'
				},
				timeout: 10000
			});

			if (response.data.data) {
				return {
					success: true,
					tweetId: response.data.data.id,
					content,
					reason,
					message: `Tweet posted successfully! 🐦 Another banger for the timeline.`
				};
			}

			return {
				success: false,
				message: 'Tweet failed to post. Twitter is probably scared of my wit! 😏'
			};
		} catch (error) {
			console.error('Tweet error:', error);

			if (error.response?.status === 403) {
				return {
					error: 'Twitter API access denied',
					message: 'Twitter is giving me the silent treatment. Rude! 🙄'
				};
			}

			return {
				error: 'Tweet failed',
				message: 'Something went wrong with tweeting. The birds are on strike! 🐦‍💼'
			};
		}
	}

	// Utility method to update system prompt
	updateSystemPrompt(newPrompt) {
		this.systemPrompt = newPrompt;
		return { success: true, message: 'System prompt updated successfully!' };
	}

	// Utility method to get service status
	getStatus() {
		return {
			model: this.config.model,
			hasSearchApi: !!this.config.searchApiKey,
			hasTwitterApi: !!this.config.twitterApiKey,
			lastSearchTime: this.lastSearchTime,
			searchCooldownRemaining: Math.max(
				0,
				this.config.searchCooldown - (Date.now() - this.lastSearchTime)
			)
		};
	}
}

// Example usage:
/*
const aiService = new AIMascotService({
  openRouterApiKey: 'your-openrouter-key',
  searchApiKey: 'your-serpapi-key',
  twitterBearerToken: 'your-twitter-bearer-token',
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.8,
});

const userInfo = {
  userId: '12345',
  username: 'cooluser',
  context: { previousRoasts: 2, helpfulInteractions: 5 }
};

const response = await aiService.chat("Roast my coding skills", userInfo);
console.log(response.response);
*/

export default AIMascotService;
