import { GoogleGenAI } from '@google/genai';

const TIER_MAP = {
  'Plankton': { points: 10, meters: 100, emoji: '🫧' },
  'Too Clever': { points: 15, meters: 150, emoji: '🤡' },
  'Schooler': { points: 30, meters: 300, emoji: '🐟' },
  'Rare': { points: 60, meters: 600, emoji: '🦑' },
  'Deep Cut': { points: 85, meters: 850, emoji: '🏮' },
  'One in a Krillian': { points: 100, meters: 1000, emoji: '🌟' },
  'Invalid': { points: 0, meters: 0, emoji: '⬛' }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, prompt, answer } = req.body;

  if (password !== process.env.GAME_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Invalid password.' });
  }

  if (!answer || !answer.trim()) {
    return res.status(200).json({
      valid: false,
      tier: 'Invalid',
      points: 0,
      meters: 0,
      emoji: '⬛',
      wittyComment: 'You ran out of oxygen before typing an answer! You stay at your current depth.',
      exampleOneInAKrillian: 'N/A'
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const judgePrompt = `You are the official judge for "Krillian Unlimited".
Evaluate the player's answer for the given prompt and rank it on the Krillian rarity scale.

Prompt: "${prompt}"
Player's Answer: "${answer.trim()}"

First, verify if the answer is factually correct and fits the prompt. If incorrect or nonsensical, classify as "Invalid".
If valid, classify into EXACTLY ONE of these 6 tiers:
1. "Plankton" (10 pts / 100m): Obvious first-thought (>35% players).
2. "Too Clever" (15 pts / 150m): Overthinker collision trap.
3. "Schooler" (30 pts / 300m): Solid mid-tier pick (15-35%).
4. "Rare" (60 pts / 600m): Uncommon pick (5-15%).
5. "Deep Cut" (85 pts / 850m): Genuinely obscure (1-5%).
6. "One in a Krillian" (100 pts / 1000m): Legendary rarity (<1%).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: judgePrompt,
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
                'One in a Krillian',
                'Invalid'
              ]
            },
            wittyComment: { type: 'STRING' },
            exampleOneInAKrillian: { type: 'STRING' }
          },
          required: ['valid', 'normalizedAnswer', 'tier', 'wittyComment', 'exampleOneInAKrillian']
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
    console.error('Gemini judge-answer error:', error);
    return res.status(500).json({ error: 'Failed to judge answer.' });
  }
}
