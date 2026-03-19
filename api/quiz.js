export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subject, level, count } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `Generate exactly ${count || 3} multiple choice questions for a Pakistani ${level} student studying ${subject}.

Return ONLY a valid JSON array with no markdown or backticks:
[
  {
    "question": "What is Newton's First Law of Motion?",
    "options": ["An object stays at rest unless acted upon by force", "Force equals mass times acceleration", "Every action has an equal reaction", "Objects fall at the same speed"],
    "correct": 0
  }
]

Rules:
- Each question must have exactly 4 options
- "correct" is the index (0-3) of the correct answer
- Questions must be relevant to ${level} ${subject} Pakistani curriculum
- Mix easy and medium difficulty
- Make wrong answers plausible but clearly incorrect`;

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
        max_tokens: 1500,
        temperature: 0.6
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message });

    let text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response' });

    text = text.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(text);
    return res.status(200).json({ questions });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
