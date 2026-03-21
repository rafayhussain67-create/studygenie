export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, subject, level, image, board, mode, eli5, quickAnswer } = req.body;

  // ── PAST PAPER DETECTION ──────────────────────────────────
  // Detect if student is asking for a specific past paper
  // Patterns: 9709/mj/23/22, 9709_s23_qp_22, "9709 may june 2023 paper 2"
  function detectPastPaper(q) {
    if (!q) return null;
    const text = q.toLowerCase();

    // Pattern 1: Cambridge code format like 9709/mj/23/22 or 9709/s23/22
    const slashMatch = q.match(/(\d{4})[\/](mj|oj|ms|on|fm|s|w|m)(\d{2})[\/](\d{1,2})[\/]?(\d)?/i);
    if (slashMatch) {
      const syllabus = slashMatch[1];
      const sessionRaw = slashMatch[2].toLowerCase();
      const year = slashMatch[3];
      const paper = slashMatch[4];
      const variant = slashMatch[5] || '';
      let session = sessionRaw;
      if (sessionRaw === 'mj' || sessionRaw === 's') session = 's';
      else if (sessionRaw === 'oj' || sessionRaw === 'on' || sessionRaw === 'w') session = 'w';
      else if (sessionRaw === 'fm' || sessionRaw === 'm') session = 'm';
      return { syllabus, session, year, paper, variant, type: 'cambridge' };
    }

    // Pattern 2: underscore format 9709_s23_qp_22
    const underMatch = q.match(/(\d{4})_(s|w|m)(\d{2})_qp_(\d{1,2})/i);
    if (underMatch) {
      return { syllabus: underMatch[1], session: underMatch[2].toLowerCase(), year: underMatch[3], paper: underMatch[4], variant: '', type: 'cambridge' };
    }

    // Pattern 3: natural language "9709 may june 2023 paper 22"
    const naturalMatch = q.match(/(\d{4}).*?(may.?june|oct.?nov|feb.?march|m.?j|o.?n|f.?m).*?(20)?(\d{2}).*?paper.?(\d{1,2})/i);
    if (naturalMatch) {
      const syllabus = naturalMatch[1];
      const sessionWord = naturalMatch[2].toLowerCase();
      const year = naturalMatch[4];
      const paper = naturalMatch[5];
      let session = 's';
      if (sessionWord.includes('oct') || sessionWord.includes('nov') || sessionWord.includes('o')) session = 'w';
      else if (sessionWord.includes('feb') || sessionWord.includes('mar') || sessionWord.includes('f')) session = 'm';
      return { syllabus, session, year, paper, variant: '', type: 'cambridge' };
    }

    return null;
  }

  const paperInfo = detectPastPaper(question);
  if (paperInfo && !image) {
    const { syllabus, session, year, paper, variant } = paperInfo;
    const paperCode = variant ? paper.padStart(1,'0') + variant : paper.padStart(2,'0');
    const filename = \`\${syllabus}_\${session}\${year}_qp_\${paperCode}.pdf\`;
    const msFilename = \`\${syllabus}_\${session}\${year}_ms_\${paperCode}.pdf\`;
    
    const sessionName = session === 's' ? 'May/June 20' + year : session === 'w' ? 'Oct/Nov 20' + year : 'Feb/March 20' + year;
    
    // PapaCambridge search URL
    const searchUrl = \`https://pastpapers.papacambridge.com/?dir=CAIE/AS+and+A+Level\`;
    const qpUrl = \`https://pastpapers.papacambridge.com/papers/caie/\${filename}\`;
    
    const html = \`<h3>📋 Past Paper Found</h3>
<div class="step-block">
  <div class="step-label">Paper Details</div>
  Syllabus: <strong>\${syllabus}</strong> · Session: <strong>\${sessionName}</strong> · Paper: <strong>\${paper}</strong>
</div>
<div class="step-block">
  <div class="step-label">Download Links</div>
  <a href="https://pastpapers.papacambridge.com/papers/caie/\${filename}" target="_blank" rel="noopener" style="color:var(--green);font-weight:700">📄 Question Paper (\${filename})</a><br><br>
  <a href="https://pastpapers.papacambridge.com/papers/caie/\${msFilename}" target="_blank" rel="noopener" style="color:var(--green);font-weight:700">✅ Mark Scheme (\${msFilename})</a>
</div>
<div class="step-block">
  <div class="step-label">Can't find it?</div>
  <a href="https://pastpapers.papacambridge.com/" target="_blank" rel="noopener" style="color:var(--green)">Search on PapaCambridge →</a> or <a href="https://www.ilmkidunya.com/papers/" target="_blank" rel="noopener" style="color:var(--green)">ilmkidunya (Pakistani boards) →</a>
</div>
<p>Once you have the paper, you can upload it here using the 📷 camera/image button and I'll solve the questions for you!</p>\`;
    
    return res.status(200).json({ answer: html });
  }
  // ── END PAST PAPER DETECTION ─────────────────────────────
  if (!question && !image) return res.status(400).json({ error: 'No question provided' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Build mode-specific instructions
  let modeInstructions = '';
  if (eli5) {
    modeInstructions = '\n\nIMPORTANT: Explain like the student is 10 years old. Use very simple words, fun analogies, and short sentences. Avoid technical jargon. Use emojis sparingly.';
  } else if (quickAnswer) {
    modeInstructions = '\n\nIMPORTANT: Give a QUICK answer only — 3-4 lines max. Just the key point and one brief explanation. No step-by-step.';
  } else if (mode === 'detailed') {
    modeInstructions = '\n\nIMPORTANT: Be very detailed and comprehensive. Include extra context, real-world applications, common mistakes to avoid, and exam tips for Pakistani boards.';
  } else if (mode === 'urdu') {
    modeInstructions = '\n\nIMPORTANT: Write ALL explanations in Urdu language (Nastaliq script). Keep HTML tags in English but all text content must be in Urdu.';
  }

  const systemPrompt = `You are StudyGenie, an AI tutor for Pakistani ${level} students studying ${subject}.${modeInstructions}

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
