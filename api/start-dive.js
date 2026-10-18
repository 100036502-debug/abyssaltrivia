import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, previousPrompts = [] } = req.body;

  if (password !== process.env.GAME_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Invalid password.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `You are the game designer for "Abyssal Trivia", a deep-sea rarity word game. Generate 7 open-ended category prompts (each with 30+ factual answers) across science, geography, pop-culture, and nature. Avoid: ${previousPrompts.slice(-21).join('; ')}`,
      config: {
        temperature: 1.0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            prompts: { type: 'ARRAY', items: { type: 'STRING' } }
          },
          required: ['prompts']
        }
      }
    });

    return res.status(200).json(JSON.parse(response.text));
  } catch (error) {
    return res.status(500).json({ error: `AI Studio Error: ${error.message}` });
  }
}
