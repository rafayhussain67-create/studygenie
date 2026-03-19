export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, level, count, mode, seed } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const n = count || 3;

  // Rotating question angles — the real driver of variety
  const angles = [
    'Focus on definitions, terminology, and core vocabulary of the topic.',
    'Focus on real-world applications, examples, and practical scenarios.',
    'Focus on mathematical or numerical problem-solving aspects.',
    'Focus on cause-and-effect relationships and "why" questions.',
    'Focus on comparing and contrasting different concepts within the topic.',
    'Focus on historical context, discoveries, and how the concept was developed.',
    'Focus on edge cases, exceptions, and common misconceptions students have.',
    'Focus on diagrams, processes, and step-by-step mechanisms.',
    'Focus on exam-style tricky questions with very similar-looking options.',
    'Focus on the most commonly tested sub-topics in Pakistani board exams.',
  ];

  const diffSkews = [
    'Make questions progressively harder (easy then medium then hard).',
    'All questions medium difficulty — no very easy or very hard.',
    'Make the first 2 medium and the last one hard and tricky.',
    'Start with a hard question, then medium, then an easy recall question.',
    'All questions should be tricky with very close answer choices to test deep understanding.',
  ];

  const s = seed || Date.now();
  const angle = angles[Math.floor(s % angles.length)];
  const diffSkew = diffSkews[Math.floor((s / 7) % diffSkews.length)];

  const prompt = `You are a quiz generator for Pakistani ${level || 'Matric'} students.

Topic: ${topic}

YOUR SPECIFIC TASK FOR THIS QUIZ SESSION:
- ${angle}
- ${diffSkew}

Generate EXACTLY ${n} multiple choice questions. Each question MUST cover a DIFFERENT sub-concept within the topic. Avoid the most obvious first question anyone would think of — be creative and specific.

Return ONLY a valid JSON array, no markdown, no explanation, no backticks:
[
  {
    "question": "...",
    "options": ["option A", "option B", "option C", "option D"],
    "correct": 0,
    "difficulty": "easy"
  }
]

Rules:
- Exactly 4 options per question
- "correct" is the index (0-3) of the correct answer
- Wrong options must be plausible — not obviously wrong
- Questions must match Pakistani ${level || 'Matric'} curriculum
- Never start a question with "What is the definition of" — vary your phrasing
- Every question must test a DIFFERENT aspect of the topic`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 1.0,
        top_p: 0.95,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message });

    let text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response' });

    text = text.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(text);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed);

    return res.status(200).json({ questions });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
