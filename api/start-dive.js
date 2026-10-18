import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, previousPrompts = [] } = req.body;

  if (password !== process.env.GAME_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Invalid password.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Normalize past prompts for strict duplicate checking
    const seenSet = new Set(
      previousPrompts.map((p) => p.trim().toLowerCase())
    );
    const exclusionList = previousPrompts.slice(-300).join(' | ');

    const systemPrompt = `You are the game designer for "Abyssal Trivia", a deep-sea rarity word game.
Generate 12 creative, open-ended category prompts for a new dive.
Rules for prompts:
1. Each prompt must have at least 30+ possible factual or universally verifiable answers.
2. Vary the topics across geography, science, animals, food, language, pop culture, sports, inventions, and history.
3. Keep prompts concise and punchy (under 12 words).
4. CRITICAL: NEVER repeat or closely rephrase ANY of these previously used prompts: [${exclusionList || 'None yet'}]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: systemPrompt,
      config: {
        temperature: 1.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            prompts: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of 12 unique category prompts.'
            }
          },
          required: ['prompts']
        }
      }
    });

    if (!response || !response.text) {
      throw new Error('Empty response received from Google AI Studio.');
    }

    const data = JSON.parse(response.text);

    // Strictly filter out any exact or case-insensitive duplicates
    const uniquePrompts = [];
    for (const rawPrompt of data.prompts || []) {
      const normalized = rawPrompt.trim().toLowerCase();
      if (!seenSet.has(normalized) && !uniquePrompts.some((p) => p.toLowerCase() === normalized)) {
        uniquePrompts.push(rawPrompt.trim());
      }
      if (uniquePrompts.length === 7) break;
    }

    // Fallback in the rare case filtering left fewer than 7
    while (uniquePrompts.length < 7 && data.prompts?.length) {
      uniquePrompts.push(data.prompts.pop());
    }

    return res.status(200).json({ prompts: uniquePrompts.slice(0, 7) });
  } catch (error) {
    console.error('Gemini start-dive critical error:', error);
    return res.status(500).json({ error: `AI Studio Error: ${error.message}` });
  }
}
