import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, previousPrompts = [] } = req.body;

  if (password !== process.env.GAME_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Invalid password.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemPrompt = `You are the game designer for "Krillian Unlimited", a reverse-Pointless style deep-sea word game.
Generate 7 creative, open-ended category prompts for a new dive.
Rules for prompts:
1. Each prompt must have at least 30+ possible factual or universally verifiable answers (e.g., "Name a country with red on its flag", "Name a mammal that lives in the ocean", "Name an element on the periodic table that starts with C", "Name a movie directed by Steven Spielberg", "Name a culinary herb").
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
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of exactly 7 category prompts for the dive.'
            }
          },
          required: ['prompts']
        }
      }
    });

    const data = JSON.parse(response.text);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Gemini start-dive error:', error);
    return res.status(500).json({ error: 'Failed to generate dive prompts from Google AI Studio.' });
  }
}
