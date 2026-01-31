import { generateText, gateway } from 'ai';
import { prisma } from '../lib/prisma.js';

export class UserProfileService {
	async learnUserFact(
		model: string,
		userId: string,
		username: string,
		fact: string,
		category: string
	) {
		try {
			const existingProfile = await prisma.quinUserProfile.findUnique({ where: { userId } });
			const factLower = fact.toLowerCase().trim();

			if (existingProfile?.facts.some((f) => f.toLowerCase().trim() === factLower)) {
				return {
					success: true,
					message: 'I already know that! 😊',
					fact,
					category,
					duplicate: true,
					totalFacts: existingProfile.facts.length
				};
			}

			if (existingProfile?.facts.length) {
				const check = await generateText({
					model: gateway(model),
					messages: [
						{
							role: 'system',
							content:
								'Compare new fact to existing. Reply ONLY "DUPLICATE" if same info (even if worded differently), or "UNIQUE" if new.'
						},
						{
							role: 'user',
							content: `New: "${fact}"\n\nExisting:\n${existingProfile.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nDuplicate?`
						}
					],
					temperature: 0.1
				});

				if (check.text.trim().toUpperCase().includes('DUPLICATE')) {
					return {
						success: true,
						message: 'I know something similar! 😊',
						fact,
						category,
						duplicate: true,
						totalFacts: existingProfile.facts.length
					};
				}
			}

			const profile = await prisma.quinUserProfile.upsert({
				where: { userId },
				update: { facts: { push: fact }, username, lastInteraction: new Date() },
				create: { userId, username, facts: [fact], lastInteraction: new Date() }
			});

			return {
				success: true,
				message: "Got it! I'll remember that. 💭",
				fact,
				category,
				duplicate: false,
				totalFacts: profile.facts.length
			};
		} catch (error) {
			console.error('Error learning user fact:', error);
			return {
				success: false,
				message: 'Had a hiccup remembering that. 😅',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	async getUserContext(userId: string, conversationId?: number) {
		const [profile, summary] = await Promise.all([
			prisma.quinUserProfile.findUnique({ where: { userId } }),
			conversationId
				? prisma.quinConversationSummary.findUnique({ where: { conversationId } })
				: null
		]);

		const parts: string[] = [];
		if (profile?.facts.length) parts.push(`What I know: ${profile.facts.slice(-5).join('; ')}`);
		if (summary?.keyTopics.length)
			parts.push(`Recent topics: ${summary.keyTopics.slice(-3).join(', ')}`);

		return parts.length ? parts.join(' | ') : 'First time chatting';
	}
}
