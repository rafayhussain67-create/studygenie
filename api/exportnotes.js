export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { notes, format } = req.body;
  if (!notes || !notes.length) return res.status(400).json({ error: 'No notes provided' });

  if (format === 'markdown') {
    const md = notes.map(n => {
      const date = new Date(n.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
      const tags = n.tags?.length ? `\n**Tags:** ${n.tags.join(', ')}` : '';
      return `# ${n.title || 'Untitled'}\n*${date}*${tags}\n\n${n.content}\n\n---\n`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="studygenie-notes.md"');
    return res.status(200).send(md);
  }

  if (format === 'html') {
    const notesHTML = notes.map(n => {
      const date = new Date(n.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
      const tags = n.tags?.length ? `<div style="margin-top:6px">${n.tags.map(t=>`<span style="background:#e6f7f1;color:#0d6b4a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:4px">${t}</span>`).join('')}</div>` : '';
      return `<div style="margin-bottom:32px;padding-bottom:32px;border-bottom:1px solid #e5e7eb">
        <h2 style="font-family:sans-serif;font-size:18px;color:#0f1117;margin-bottom:4px">${n.title || 'Untitled'}</h2>
        <p style="font-size:12px;color:#6b7280;margin-bottom:8px">${date}</p>${tags}
        <div style="margin-top:12px;font-size:14px;line-height:1.8;color:#374151;white-space:pre-wrap">${n.content}</div>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>My StudyGenie Notes</title></head>
<body style="font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 20px">
<div style="text-align:center;margin-bottom:40px;padding:24px;background:#1a9e6e;border-radius:12px;color:white">
  <h1 style="font-size:24px;margin-bottom:4px">✦ StudyGenie Notes</h1>
  <p style="font-size:14px;opacity:0.85">Exported on ${new Date().toLocaleDateString('en-PK', { day:'numeric',month:'long',year:'numeric' })}</p>
</div>
${notesHTML}
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="studygenie-notes.html"');
    return res.status(200).send(html);
  }

  return res.status(400).json({ error: 'Invalid format. Use markdown or html' });
}
