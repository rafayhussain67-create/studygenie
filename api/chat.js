export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, subject, level, image } = req.body;
  if (!question && !image) return res.status(400).json({ error: 'No question provided' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are StudyGenie, an AI tutor for Pakistani ${level} students studying ${subject}. Give clear step-by-step answers aligned with the Pakistani curriculum (Federal Board, Punjab Board, Sindh Board, Cambridge O/A Levels). Use simple English.

Format your response as HTML:
- Use <h3> for the main answer heading
- Wrap each step in: <div class="step-block"><div class="step-label">Step N</div>content</div>
- Use <div class="formula-box">formula here</div> for math formulas
- End with a short encouraging <p> tag

Be concise, accurate, and friendly.`;

  try {
    let messages;

    if (image) {
      messages = [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
          { type: 'text', text: `${systemPrompt}\n\nSolve the question shown in this image. ${question ? 'Additional context: ' + question : ''}` }
        ]
      }];
    } else {
      messages = [{
        role: 'user',
        content: `${systemPrompt}\n\nQuestion: ${question}`
      }];
    }

    const model = image ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, max_tokens: 1000, temperature: 0.7 })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Groq error' });
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response text' });

    return res.status(200).json({ answer: text });
  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
