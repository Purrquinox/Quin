import { tavily } from '@tavily/core';
import { secrets } from '../../helpers/data.js';

export class SearchTool {
	async search(query: string, searchDepth: string = 'basic', maxResults: number = 5) {
		try {
			if (!secrets.tavily?.api_key) throw new Error('Tavily API key not configured');

			const response = await tavily({ apiKey: secrets.tavily.api_key }).search(query, {
				searchDepth: searchDepth as 'basic' | 'advanced',
				maxResults: Math.min(maxResults, 10),
				includeAnswer: true,
				includeRawContent: false
			});

			if (!response?.results?.length)
				return { success: false, message: 'No results. Try rephrasing.', query };

			const results = response.results.map((r: any, i: number) => ({
				position: i + 1,
				title: r.title,
				url: r.url,
				content: r.content,
				score: r.score
			}));

			return {
				success: true,
				query,
				answer: response.answer || 'No direct answer',
				results,
				sources: response.results.map((r: any) => r.url),
				message: `Found ${results.length} results`
			};
		} catch (error) {
			console.error('[Search] Error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown',
				message: 'Search failed',
				query
			};
		}
	}
}
