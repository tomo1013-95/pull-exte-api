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

    // AIコメント生成（Gemini Flash）
    if (type === 'comment') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
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

    // 画像生成（Gemini Imagen3 Fast）
    if (type === 'image') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '3:4',
              personGeneration: 'allow_adult',
              negativePrompt: 'illustration, anime, cartoon, blurry, distorted, low quality',
            }
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const imageData = data.predictions?.[0]?.bytesBase64Encoded;
      if (!imageData) throw new Error('画像を生成できませんでした');
      return new Response(JSON.stringify({ imageBase64: imageData }), {
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
