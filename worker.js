// SCHOL AI image-generation proxy for Cloudflare Workers AI.
// Configure secrets before deploying:
//   npx wrangler secret put CF_ACCOUNT_ID
//   npx wrangler secret put CF_AI_TOKEN
// Deploy with: npx wrangler deploy
// Keep both secrets in Worker settings; never put them in HTML.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (url.pathname !== "/generate") return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    if (request.method !== "POST") return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: corsHeaders });
    if (!env.CF_ACCOUNT_ID || !env.CF_AI_TOKEN) return new Response(JSON.stringify({ error: "Worker secrets are not configured" }), { status: 500, headers: corsHeaders });
    try {
      const body = await request.json();
      const prompt = String(body.prompt || "").trim().slice(0, 1500);
      if (!prompt) return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400, headers: corsHeaders });
      const upstream = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.CF_AI_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      if (!upstream.ok) {
        const detail = await upstream.text();
        return new Response(JSON.stringify({ error: `Cloudflare AI returned ${upstream.status}: ${detail.slice(0, 500)}` }), { status: upstream.status, headers: corsHeaders });
      }
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return new Response(JSON.stringify({ success: true, image: btoa(binary) }), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err?.message || "Unexpected Worker error" }), { status: 500, headers: corsHeaders });
    }
  }
};
