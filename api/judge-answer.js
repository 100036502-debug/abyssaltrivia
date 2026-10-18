import { GoogleGenAI } from '@google/genai';

const TIER_MAP = {
  'Plankton': { points: 10, meters: 100, emoji: '🫧' },
  'Too Clever': { points: 15, meters: 150, emoji: '🤡' },
  'Schooler': { points: 30, meters: 300, emoji: '🐟' },
  'Rare': { points: 60, meters: 600, emoji: '🦑' },
  'Deep Cut': { points: 85, meters: 850, emoji: '🏮' },
  'One in a Krillion': { points: 100, meters: 1000, emoji: '🌟' },
  'Invalid': { points: 0, meters: 0, emoji: '⬛' }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, prompt, answer } = req.body;

  if (password !== process.env.GAME_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing.' });
  }

  if (!answer || !answer.trim()) {
    return res.status(200).json({
      valid: false,
      tier: 'Invalid',
      points: 0,
      meters: 0,
      emoji: '⬛',
      wittyComment: 'Oxygen expired before a valid answer was locked in!'
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `Evaluate player answer for Abyssal Trivia (Krillion scale). Prompt: "${prompt}" | Answer: "${answer.trim()}"
If incorrect, nonsensical, or off-topic, set "valid": false and tier "Invalid".
If valid, classify into ONE tier: "Plankton" (obvious), "Too Clever" (overthinker trap), "Schooler" (solid), "Rare" (uncommon), "Deep Cut" (obscure), "One in a Krillion" (legendary rarity).
Also provide a witty comment explaining the tier placement.`,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            valid: { type: 'BOOLEAN' },
            normalizedAnswer: { type: 'STRING' },
            tier: {
              type: 'STRING',
              enum: [
                'Plankton',
                'Too Clever',
                'Schooler',
                'Rare',
                'Deep Cut',
                'One in a Krillion',
                'Invalid'
              ]
            },
            wittyComment: { type: 'STRING' }
          },
          required: ['valid', 'normalizedAnswer', 'tier', 'wittyComment']
        }
      }
    });

    const result = JSON.parse(response.text);
    const tierStats = TIER_MAP[result.tier] || TIER_MAP['Invalid'];

    return res.status(200).json({
      ...result,
      points: tierStats.points,
      meters: tierStats.meters,
      emoji: tierStats.emoji
    });
  } catch (error) {
    return res.status(500).json({ error: `AI Judgment Error: ${error.message}` });
  }
}
