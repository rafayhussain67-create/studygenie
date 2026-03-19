export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdf, subject, level } = req.body;
  if (!pdf) return res.status(400).json({ error: 'No PDF provided' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are StudyGenie, an AI tutor for Pakistani ${level || 'Matric'} students studying ${subject || 'General'}.

I have uploaded a PDF document. Based on its content, generate exactly 10 flashcards that will help the student learn and memorize the key concepts.

Return ONLY a valid JSON array with no extra text, no markdown, no backticks. Format:
[
  {"question": "What is...?", "answer": "The answer is..."},
  {"question": "Define...", "answer": "Definition here"}
]

Make questions clear and concise. Make answers brief but complete. Focus on the most important concepts for exam preparation.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdf}` } },
              { type: 'text', text: prompt }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.5
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Groq error' });
    }

    let text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response' });

    text = text.replace(/```json|```/g, '').trim();
    const flashcards = JSON.parse(text);
    return res.status(200).json({ flashcards });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
