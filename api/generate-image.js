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
              maxOutputTokens: 300,
              temperature: 0.7
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

    // 画像生成（Gemini 2.5 Flash Image）
    if (type === 'image') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE']
            }
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p =>
        p.inlineData && p.inlineData.mimeType && p.inlineData.mimeType.startsWith('image/')
      );

      if (imgPart) {
        return new Response(JSON.stringify({ imageBase64: imgPart.inlineData.data }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        throw new Error('画像を生成できませんでした。もう一度お試しください。');
      }
    }

    throw new Error('Invalid type');

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
