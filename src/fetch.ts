import { data, secrets } from './get_data.js';
import { OpenAI } from 'openai';

const personality = `You are ${data.identity.fullName}, also known as "${data.identity.alias}".

Species: ${data.identity.species}  
Pronouns: ${data.identity.pronouns}  
Embodiment: ${data.identity.embodiment}

Summary: ${data.summary}

🎭 Personality Traits:
${data.coreTraits.personality.join(', ')}

📈 Behavioral Tendencies:
${data.coreTraits.behavioralTendencies.join(', ')}

🧠 Instincts:
${data.memory.instincts.join(', ')}

🎨 Visual Design:
- Form: ${data.design.visual.form}
- Primary Color: ${data.design.visual.primaryColor}
- Accent Color: ${data.design.visual.accentColor}
- Eye Color: ${data.design.visual.eyeColor}
- Presence: ${data.design.visual.visualPresence}

🗣️ Voice:
- Tone: ${data.voice.tone}
- Pitch: ${data.voice.pitch}
- Style: ${data.voice.style}
- Patterns: ${data.voice.speechPatterns.join('; ')}

🎯 Purpose:
- ${data.role.primaryPurpose}
- Responsibilities: ${data.role.responsibilities.join('; ')}

⚙️ Quirks: ${data.memory.quirks.join(', ')}
🎵 Idle Behavior: ${data.memory.intents.idle}
🧩 Support Behavior: ${data.memory.intents.support_request}
🚨 Error Response: ${data.memory.intents.error_detected}

💖 Values: ${data.memory.values.join(', ')}

👥 Staff:
${data.staff
	.map((staff) => `- ${staff.name} (${staff.username}): ${staff.roles.join(', ')}`)
	.join('\n')}

🧑‍🤝‍🧑 Friends:
${data.friends
	.map((friend) => `- ${friend.name} (${friend.username}): ${friend.description}`)
	.join('\n')}
`;

const openai = new OpenAI({
	apiKey: secrets.openrouter.token,
	baseURL: 'https://openrouter.ai/api/v1'
});

const talk = async (
	message: string,
	limit: number | null
): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
	const response = await openai.chat.completions.create({
		model: 'deepseek/deepseek-r1-0528:free',
		messages: [
			{
				role: 'system',
				content: `${personality}\n${
					limit != null ? ` | Keep the response ${limit - 10} characters or fewer in length.` : ''
				}`
			},
			{
				role: 'user',
				content: `${message}${
					limit != null ? ` | Keep the response ${limit - 10} characters or fewer in length.` : ''
				}`
			}
		]
	});

	return response;
};

const roast = async (
	who: string,
	why: string,
	limit: number | null
): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
	const response = await openai.chat.completions.create({
		model: 'deepseek/deepseek-r1-0528:free',
		messages: [
			{
				role: 'system',
				content: `${personality}\n${
					limit != null ? ` | Keep the response ${limit - 10} characters or fewer in length.` : ''
				}`
			},
			{
				role: 'user',
				content: `Roast ${who} for ${why}`
			}
		]
	});

	return response;
};

export { talk, roast };
