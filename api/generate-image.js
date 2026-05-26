export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, type } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY) return res.status(500).json({ error: 'API key not configured' });

    // AIコメント生成
    if (type === 'comment') {
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
        }),
      });

      const rawText = await response.text();

      // デバッグ：Geminiからの生レスポンスをログ
      console.log('Gemini status:', response.status);
      console.log('Gemini response:', rawText.substring(0, 500));

      let data;
      try {
        data = JSON.parse(rawText);
      } catch(e) {
        return res.status(500).json({ error: 'Gemini parse error: ' + rawText.substring(0, 200) });
      }

      if (data.error) {
        return res.status(400).json({ error: 'Gemini error: ' + JSON.stringify(data.error) });
      }

      const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
        .replace(/\*\*/g, '')
        .replace(/([。！])/g, '$1\n')
        .trim();

      if (!text) {
        return res.status(400).json({ error: 'Empty response from Gemini: ' + rawText.substring(0, 200) });
      }

      return res.status(200).json({ text });
    }

    // 画像生成（Pollinations AI）
    if (type === 'image') {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 999999);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=640&seed=${seed}&model=flux&nologo=true`;
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error('画像の生成に失敗しました');
      const arrayBuffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return res.status(200).json({ imageBase64: base64 });
    }

    return res.status(400).json({ error: 'Invalid type: ' + type });

  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
