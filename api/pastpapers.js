export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { board, subject, topic, level, sections } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const sectionConfig = sections || { mcq: 10, short: 5, long: 2 };

  const prompt = `You are an expert Pakistani exam paper setter for ${board} board.

Generate a realistic past-paper style exam for:
- Board: ${board}
- Subject: ${subject}
- Topic: ${topic}
- Level: ${level}

Create EXACTLY this structure and return ONLY valid JSON, no markdown:

{
  "title": "${subject} — ${topic} (${board} Style)",
  "board": "${board}",
  "subject": "${subject}",
  "topic": "${topic}",
  "totalMarks": 50,
  "sections": {
    "A": {
      "title": "Section A — Multiple Choice Questions",
      "marks": "${sectionConfig.mcq} marks (1 mark each)",
      "questions": [
        {
          "num": 1,
          "question": "question text",
          "options": ["A. option", "B. option", "C. option", "D. option"],
          "answer": "A",
          "explanation": "brief why"
        }
      ]
    },
    "B": {
      "title": "Section B — Short Answer Questions",
      "marks": "${sectionConfig.short * 4} marks (4 marks each)",
      "questions": [
        {
          "num": 1,
          "question": "question text",
          "marks": 4,
          "answer": "model answer in 3-4 lines",
          "keyPoints": ["point 1", "point 2"]
        }
      ]
    },
    "C": {
      "title": "Section C — Long Answer Questions",
      "marks": "${sectionConfig.long * 8} marks (8 marks each)",
      "questions": [
        {
          "num": 1,
          "question": "question text",
          "marks": 8,
          "answer": "detailed model answer",
          "keyPoints": ["point 1", "point 2", "point 3"]
        }
      ]
    }
  }
}

Rules:
- Section A: exactly ${sectionConfig.mcq} MCQs
- Section B: exactly ${sectionConfig.short} short questions
- Section C: exactly ${sectionConfig.long} long questions
- Match ${board} exam style exactly
- Questions must be from ${topic} in ${subject} for ${level} students
- Return ONLY the JSON object, nothing else`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.4
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message });

    let text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response' });
    text = text.replace(/```json|```/g, '').trim();
    const paper = JSON.parse(text);
    return res.status(200).json({ paper });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
