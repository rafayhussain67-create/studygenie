export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, level, count, mode } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const n = count || 3;

  const prompt = `Generate exactly ${n} multiple choice questions for a Pakistani ${level || 'Matric'} student.

Topic/Subject: ${topic || 'General Science'}
Mode: ${mode || 'topic'}

IMPORTANT - Difficulty progression (required):
- Question 1: Very easy (basic definition or recall)
- Question 2: Easy (simple application)  
- Question 3: Medium (understanding concept)
- Question 4-7: Medium-Hard (applying knowledge)
- Last questions: Hard (exam-style, tricky options)

Return ONLY a valid JSON array, no markdown, no backticks:
[
  {
    "question": "What is the definition of velocity?",
    "options": ["Speed in a specific direction", "Distance divided by time", "Rate of change of acceleration", "Force per unit mass"],
    "correct": 0,
    "difficulty": "easy"
  }
]

Rules:
- Exactly 4 options per question
- "correct" is the index (0-3) of the correct answer
- Questions must match Pakistani ${level} curriculum
- Wrong answers must be plausible but clearly incorrect to someone who knows the topic
- If topic includes PDF content, base questions strictly on that content
- Progress from easy to hard across all ${n} questions`;

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
        temperature: 0.5
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
