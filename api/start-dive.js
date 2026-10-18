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

    const systemPrompt = `You are the game designer for "Krillian Unlimited", a reverse-Pointless style deep-sea word game.
Generate 7 creative, open-ended category prompts for a new dive.
Rules for prompts:
1. Each prompt must have at least 30+ possible factual or universally verifiable answers.
2. Vary the topics across geography, science, animals, food, language, pop culture, and history.
3. Keep prompts concise and punchy (under 12 words).
4. Avoid repeating any of these recent prompts: ${previousPrompts.slice(-21).join('; ')}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        temperature: 1.0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            prompts: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of exactly 7 category prompts for the dive.'
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
    return res.status(200).json(data);
  } catch (error) {
    console.error('Gemini start-dive critical error:', error);
    return res.status(500).json({ error: `AI Studio Error: ${error.message}` });
  }
}
