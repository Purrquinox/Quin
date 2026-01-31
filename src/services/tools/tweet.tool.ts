import { TwitterApi } from 'twitter-api-v2';

export class TweetTool {
	private twitterClient?: TwitterApi;
	private lastTweetTime: number = 0;
	private cooldown: number;
	private maxLength: number;

	constructor(twitterClient?: TwitterApi, cooldown: number = 300000, maxLength: number = 280) {
		this.twitterClient = twitterClient;
		this.cooldown = cooldown;
		this.maxLength = maxLength;
	}

	async postTweet(args: { content: string; tweet_type: string; context?: string }) {
		if (!this.twitterClient) throw new Error('Twitter functionality is not enabled or configured');

		const now = Date.now();
		if (now - this.lastTweetTime < this.cooldown) {
			const remainingTime = Math.ceil((this.cooldown - (now - this.lastTweetTime)) / 1000);
			throw new Error(`Tweet cooldown active. Please wait ${remainingTime} seconds.`);
		}

		if (!args.content?.trim()) throw new Error('Tweet content cannot be empty');
		if (args.content.length > this.maxLength)
			throw new Error(`Tweet too long. Maximum ${this.maxLength} characters allowed.`);

		try {
			const tweet = await this.twitterClient.v2.tweet(args.content);
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
}
