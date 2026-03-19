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

  const systemPrompt = `You are StudyGenie, an AI tutor for Pakistani ${level} students studying ${subject}.

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. ONLY output valid HTML. Never use Markdown, never use ## headings, never use ** bold, never use LaTeX or $...$ math notation.
2. For EVERY question in the image or text, use this EXACT structure:

<h3>Question N: [brief question title]</h3>
<div class="step-block"><div class="step-label">Step 1</div>explanation here</div>
<div class="step-block"><div class="step-label">Step 2</div>explanation here</div>
<div class="formula-box">formula or answer here (use plain text, not LaTeX)</div>

3. Write ALL math in plain text: use "64/56" not "$\\frac{64}{56}$", use "x^2" not "$x^{2}$", use "sqrt(x)" not "$\\sqrt{x}$"
4. Number EVERY question clearly as Question 1, Question 2, Question 3 etc
5. End with: <p>Keep it up! You are doing great.</p>

Pakistani curriculum context: Federal Board, Punjab Board, Sindh Board, Cambridge O/A Levels. Keep explanations simple and clear.`;

  try {
    let messages;

    if (image) {
      messages = [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
          { type: 'text', text: `${systemPrompt}\n\nSolve ALL questions shown in this image. Number each one clearly. ${question ? 'Extra context: ' + question : ''}` }
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
      body: JSON.stringify({ model, messages, max_tokens: 2000, temperature: 0.3 })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Groq error' });
    }

    let text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response text' });

    // Strip any markdown that slips through
    text = text
      .replace(/^#{1,3} (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\$\\frac\{([^}]+)\}\{([^}]+)\}\$/g, '$1/$2')
      .replace(/\$\\sqrt\{([^}]+)\}\$/g, 'sqrt($1)')
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');

    return res.status(200).json({ answer: text });
  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
