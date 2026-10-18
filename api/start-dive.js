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

    const seenSet = new Set(
      previousPrompts.map((p) => p.trim().toLowerCase())
    );
    const exclusionList = previousPrompts.slice(-300).join(' | ');

    const systemPrompt = `You generate prompts for a daily trivia game where players type ONE answer
per prompt and score more for rarer (but still valid) answers. The obvious
answer earns almost nothing; deep, obscure, correct answers earn the most.

MAKE A GOOD PROMPT
- Open-ended: it has a large pool of valid answers MUST BE 50-300, so
  there is a clear "everyone says this" answer AND a long tail of obscure
  ones.
- Objectively checkable: whether an answer is valid is a matter of fact,
  not opinion. A neutral person with a search engine could verify any
  answer in under a minute.
- Short and unambiguous: one sentence, usually in the form "Name a ___"
  or "Name something that ___". No tricks, no wordplay, no multi-part
  conditions.
- Timeless: avoid anything tied to current events, prices, rankings, or
  records that change.
- Answerable in about 20 seconds by a casual player who knows a little
  about the topic.
- Broad appeal and globally fair: don't assume knowledge of one country's
  culture unless the prompt says so.

GOOD EXAMPLES OF THE SHAPE (do not reuse these)
- "Name a country that is landlocked."
- "Name a chemical element named after a place."
- "Name a musical instrument that uses a reed."
- "Name an animal with stripes."

AVOID
- Prompts with only 5-15 valid answers (too small, no long tail).
- Prompts where one answer overwhelmingly dominates and nothing else
  plausible exists.
- Subjective prompts ("Name a good movie", "Name a scary animal").
- Prompts whose valid answers are mostly spelling or naming variants of
  the same thing.
- Trivia with a single correct answer ("What is the capital of France?").
- Offensive, sexual, or politically charged topics.
- Anything that could be answered by a proper noun with many aliases
  unless you list the aliases.

CATEGORIES
Rotate across: geography, science, nature, food, history, music, movies &
TV, sports, language, everyday objects, mythology, technology. Never
produce more than two prompts in a row from the same category.

OUTPUT FORMAT
Return ONLY valid JSON, no preamble and no markdown fences:
{
  "prompts": [
    {
      "prompt": "Name a ...",
      "category": "...",
      "estimated_valid_answers": <integer>,
      "common_answers": ["3-5 answers most players will give"],
      "mid_answers": ["3-5 answers a decent player might find"],
      "rare_answers": ["3-5 genuinely obscure but valid answers"],
      "accepted_variants_note": "spelling/alias/plural issues the answer matcher should handle",
      "difficulty": 1-5
    }
  ]
}

RULES FOR THE EXAMPLE ANSWERS
- Every listed answer must be definitely valid. If you are not sure an
  answer qualifies, leave it out.
- rare_answers must be real and verifiable, not invented.

You will be told how many prompts to generate, and may be given a list of
existing prompts. Never duplicate or closely paraphrase an existing prompt.
4. CRITICAL: NEVER repeat or closely rephrase ANY of these previously used prompts: [${exclusionList || 'None yet'}]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

    const uniquePrompts = [];
    for (const rawPrompt of data.prompts || []) {
      const normalized = rawPrompt.trim().toLowerCase();
      if (!seenSet.has(normalized) && !uniquePrompts.some((p) => p.toLowerCase() === normalized)) {
        uniquePrompts.push(rawPrompt.trim());
      }
      if (uniquePrompts.length === 7) break;
    }

    while (uniquePrompts.length < 7 && data.prompts?.length) {
      uniquePrompts.push(data.prompts.pop());
    }

    return res.status(200).json({ prompts: uniquePrompts.slice(0, 7) });
  } catch (error) {
    console.error('Gemini start-dive critical error:', error);
    return res.status(500).json({ error: `AI Studio Error: ${error.message}` });
  }
}
