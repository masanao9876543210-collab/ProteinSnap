/**
 * ProteinSnap v0.8 - Cloudflare Workers AI vision backend.
 * POST /api/analyze-food
 * Body: { image: "data:image/jpeg;base64,...", remainingProtein, goalType }
 *
 * The browser never receives an AI provider secret. Workers AI is accessed via
 * the server-side AI binding. The model returns JSON which the frontend can
 * review before saving.
 */
const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_IMAGE_CHARS = 7_000_000;

const schemaHint = `Return ONLY valid JSON with this shape:
{"title":"string","items":["food 1","food 2"],"protein":0,"calories":0,"fat":0,"carbs":0,"confidence":"high|medium|low","note":"short Japanese note"}
Rules: estimate the visible meal as served; use realistic approximate nutrition; if quantity is unclear, choose a conservative estimate. Numbers must be numeric, not strings.`;

function corsHeaders(origin) {
  const allowed = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(data, status = 200, origin = "*") {
  return Response.json(data, { status, headers: corsHeaders(origin) });
}

function cleanJson(text) {
  if (!text) return null;
  const raw = String(text).trim();
  try { return JSON.parse(raw); } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
}

function normalize(result) {
  const n = Number;
  return {
    title: String(result?.title || "食事（AI分析）").slice(0, 80),
    items: Array.isArray(result?.items) ? result.items.map(x => String(x)).slice(0, 12) : [],
    protein: Math.max(0, Math.round(n(result?.protein) || 0)),
    calories: Math.max(0, Math.round(n(result?.calories) || 0)),
    fat: Math.max(0, Math.round(n(result?.fat) || 0)),
    carbs: Math.max(0, Math.round(n(result?.carbs) || 0)),
    confidence: ["high","medium","low"].includes(result?.confidence) ? result.confidence : "medium",
    note: String(result?.note || "写真からの推定値です。記録前に数値を確認してください。").slice(0, 180),
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (url.pathname === "/health") return json({ ok: true, version: "0.8", model: MODEL }, 200, origin);

    if (request.method === "POST" && url.pathname === "/api/analyze-food") {
      try {
        if (!env.AI) return json({ error: "ai_binding_missing" }, 500, origin);
        const body = await request.json();
        if (!body?.image || typeof body.image !== "string") return json({ error: "image_required" }, 400, origin);
        if (!body.image.startsWith("data:image/")) return json({ error: "image_must_be_data_url" }, 400, origin);
        if (body.image.length > MAX_IMAGE_CHARS) return json({ error: "image_too_large" }, 413, origin);

        const remaining = Math.max(0, Math.round(Number(body.remainingProtein) || 0));
        const goal = String(body.goalType || "maintain");
        const prompt = `あなたは日本語の栄養分析アシスタントです。添付された食事写真を見て、料理名・主な食材・たんぱく質・カロリー・脂質・炭水化物を推定してください。\n\n今日の残りたんぱく質は約${remaining}g、目標は${goal}です。これは食事記録用の概算であり、医療判断ではありません。\n${schemaHint}`;

        const response = await env.AI.run(MODEL, {
          prompt,
          image: body.image,
          max_tokens: 450,
          temperature: 0.1,
        });

        const parsed = cleanJson(response?.response || response?.result || response);
        if (!parsed) return json({ error: "ai_invalid_json", raw: String(response?.response || response?.result || "").slice(0, 500) }, 502, origin);
        return json({ ...normalize(parsed), source: "cloudflare-workers-ai", model: MODEL }, 200, origin);
      } catch (error) {
        return json({ error: "ai_request_failed", message: String(error?.message || error).slice(0, 300) }, 502, origin);
      }
    }

    // Serve the ProteinSnap PWA for all non-API routes.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return json({ ok: true, app: "ProteinSnap", version: "0.8" }, 200, origin);
  }
};
