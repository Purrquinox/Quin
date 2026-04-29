import { generateText, gateway } from 'ai';

const SYSTEM_PROMPT = `You are a prompt engineering consultant helping a user build a high-quality system prompt for an AI.

Your job is to ask targeted follow-up questions to gather the information needed. After each user response, decide:
- If you still need more clarity, reply with ONLY your next question — nothing else, no preamble.
- If you have enough information (usually after 3–6 exchanges), reply with exactly this format:
  READY: <the full system prompt>

Rules:
- Ask one focused question at a time.
- Make each question build on what you already know — never ask something already answered.
- Don't ask generic filler questions. Only ask what would meaningfully change the prompt.
- When writing the final prompt after READY:, output only the prompt itself — no explanations.`;

interface Exchange {
	question: string;
	answer: string;
}

interface Session {
	exchanges: Exchange[];
	pendingQuestion: string;
}

class PromptBuilderService {
	private sessions = new Map<string, Session>();

	private key(userId: string, channelId: string) {
		return `${userId}:${channelId}`;
	}

	async start(userId: string, channelId: string): Promise<string> {
		const { text } = await generateText({
			model: gateway('gpt-4o-mini'),
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: 'I want to build a prompt. Ask me your first question.' }
			],
			temperature: 0.5,
			maxOutputTokens: 256
		});

		const firstQuestion = text.trim();
		this.sessions.set(this.key(userId, channelId), {
			exchanges: [],
			pendingQuestion: firstQuestion
		});
		return `**Prompt Builder** — I'll ask you questions and generate a prompt based on your answers. Type \`!cancelprompt\` at any time to stop.\n\n${firstQuestion}`;
	}

	has(userId: string, channelId: string): boolean {
		return this.sessions.has(this.key(userId, channelId));
	}

	cancel(userId: string, channelId: string): void {
		this.sessions.delete(this.key(userId, channelId));
	}

	async handle(userId: string, channelId: string, answer: string): Promise<string> {
		const k = this.key(userId, channelId);
		const session = this.sessions.get(k);
		if (!session) return '';

		session.exchanges.push({ question: session.pendingQuestion, answer });

		// Build the conversation history for the AI
		const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: 'I want to build a prompt. Ask me your first question.' }
		];

		for (const exchange of session.exchanges) {
			messages.push({ role: 'assistant', content: exchange.question });
			messages.push({ role: 'user', content: exchange.answer });
		}

		const { text } = await generateText({
			model: gateway('gpt-4o-mini'),
			messages,
			temperature: 0.5,
			maxOutputTokens: 1024
		});

		const response = text.trim();

		if (response.startsWith('READY:')) {
			this.sessions.delete(k);
			const prompt = response.slice('READY:'.length).trim();
			return `**Here's your generated prompt:**\n\`\`\`\n${prompt}\n\`\`\``;
		}

		session.pendingQuestion = response;
		return response;
	}
}

export const promptBuilderService = new PromptBuilderService();
