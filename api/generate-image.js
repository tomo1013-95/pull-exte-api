export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { prompt, type } = await req.json();
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    // AIコメント生成（Gemini 2.5 Flash）
    if (type === 'comment') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 800,
              temperature: 0.7
            },
            thinkingConfig: {
              thinkingBudget: 0
            }
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = text.replace(/\*\*/g, '').replace(/([。！])/g, '$1\n').trim();
      return new Response(JSON.stringify({ text: clean }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 画像生成（Pollinations AI - 無料・登録不要）
    if (type === 'image') {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 999999);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=576&height=768&seed=${seed}&model=flux&nologo=true`;

      // URLから画像を取得してbase64に変換
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error('画像の生成に失敗しました');

      const arrayBuffer = await imgRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      return new Response(JSON.stringify({ imageBase64: base64 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid type');

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
