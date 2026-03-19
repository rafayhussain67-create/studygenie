export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { question, subject, level } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: `A Pakistani ${level} student studying ${subject} just asked: "${question}". Suggest 3 related follow-up questions they might want to ask next. Return ONLY a JSON array of 3 short question strings, no markdown, no extra text: ["question1", "question2", "question3"]` }],
        max_tokens: 200, temperature: 0.7
      })
    });
    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '[]';
    text = text.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(text);
    return res.status(200).json({ questions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
