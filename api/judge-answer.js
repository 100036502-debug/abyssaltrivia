import { GoogleGenAI, Type } from '@google/genai';

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

First, verify if the answer is factually correct and fits the prompt (forgive minor spelling typos if the intended answer is unmistakable).
If it is factually incorrect, nonsensical, or does not fit the category, classify it as "Invalid".

If valid, classify it into EXACTLY ONE of the 6 Krillian Rarity Scales based on how many people would think of this answer:
1. "Plankton" (10 pts / 100m): The most obvious, immediate first-thought answers (>35% of players say this).
2. "Too Clever" (15 pts / 150m): The classic overthinker collision trap! An answer that sounds smart, ironic, or like a textbook trivia fact that thousands of players reach for when trying to be clever (e.g., saying "Tomato" for a fruit, "Axolotl" for an X animal, or "Nepal" for a unique flag).
3. "Schooler" (30 pts / 300m): Solid, respectable mid-tier pick (15-35% of players). Not the #1 obvious answer, but well-known.
4. "Rare" (60 pts / 600m): Uncommon, strong pick (5-15% of players). Requires genuine thought.
5. "Deep Cut" (85 pts / 850m): Genuinely obscure (1-5% of players). Deep knowledge that few people pull under time pressure.
6. "One in a Krillian" (100 pts / 1000m): Legendary rarity (<1% of players). A factually correct answer that almost nobody else would ever think to type!`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: judgePrompt,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            valid: { type: Type.BOOLEAN },
            normalizedAnswer: {
              type: Type.STRING,
              description: 'Properly capitalized and spelled version of the player answer'
            },
            tier: {
              type: Type.STRING,
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
            wittyComment: {
              type: Type.STRING,
              description: '1-2 witty ocean/diving themed sentences explaining why this answer landed in this specific tier.'
            },
            exampleOneInAKrillian: {
              type: Type.STRING,
              description: 'One example of what a true "One in a Krillian" answer for this prompt would have been.'
            }
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
