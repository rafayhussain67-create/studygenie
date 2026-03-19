export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { subject, topic, level } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: `Generate a complete formula sheet for Pakistani ${level} students studying ${subject} - topic: ${topic}. Return ONLY a valid JSON array, no markdown, no backticks: [{"name": "Formula name", "formula": "F = ma", "description": "Where F is force, m is mass, a is acceleration"}]. Include all important formulas, equations, and definitions for this topic. Make formulas clear and exam-ready.` }],
        max_tokens: 2000, temperature: 0.3
      })
    });
    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '[]';
    text = text.replace(/```json|```/g, '').trim();
    const formulas = JSON.parse(text);
    return res.status(200).json({ formulas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
