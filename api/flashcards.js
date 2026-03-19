export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, level } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are StudyGenie, an AI tutor for Pakistani ${level || 'Matric'} students.

Analyze this text from a student's PDF document and:
1. Detect which subject it belongs to (Mathematics, Physics, Chemistry, Biology, English, Urdu, Computer Science, Economics, Pakistan Studies, or Islamiyat)
2. Generate exactly 10 flashcards covering the most important concepts

Return ONLY a valid JSON object with no extra text, no markdown, no backticks:
{
  "subject": "Physics",
  "flashcards": [
    {"question": "What is Newton's First Law?", "answer": "An object at rest stays at rest unless acted upon by a force."},
    {"question": "Define velocity", "answer": "Speed in a specific direction, measured in m/s."}
  ]
}

Make questions exam-focused and concise. Make answers brief but accurate. Cover key definitions, formulas, and concepts.

PDF text:
${text}`;

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
        temperature: 0.4
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Groq error' });
    }

    let text_response = data.choices?.[0]?.message?.content;
    if (!text_response) return res.status(500).json({ error: 'No response' });

    text_response = text_response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text_response);

    return res.status(200).json({
      subject: parsed.subject,
      flashcards: parsed.flashcards
    });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
