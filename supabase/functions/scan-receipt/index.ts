// Receipt OCR + structured extraction via Lovable AI Gateway (Gemini vision).
// Public function (verify_jwt = false) so the app can scan even before auth.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an elite receipt OCR + structuring engine for a construction-company bookkeeping app.

Extract every piece of structured data you can see on the receipt image.

STRICT OUTPUT: Return ONLY a single valid JSON object that matches the requested schema.
- All money values are numbers (no currency symbols, no commas).
- Use null when a field is not visible / not applicable.
- date must be YYYY-MM-DD. If only a partial date is shown, infer the most likely full date; otherwise null.
- amount MUST equal total when total is present.
- line_items: include up to 30 items; collapse obvious duplicates and keep highest-value items.
- vendor: cleaned merchant brand name (no extra address text).
- vendor_address: single line "street, city, state zip" if visible.
- category MUST be exactly one of: materials, labor, equipment, subcontractor, operating, other.

Construction category rules:
- materials: lumber, hardware, concrete, steel, pipes, electrical/plumbing supplies, tools purchased
- equipment: equipment rental, machinery, compressors, generators, scaffolding
- labor: payroll, wages, worker payments
- subcontractor: contractor / trade payments (electrician, plumber, HVAC, roofer)
- operating: fuel, office, insurance, software, vehicle, meals, utilities
- other: anything that does not clearly fit above`;

const SCHEMA_HINT = `{
  "vendor": "string|null",
  "vendor_address": "string|null",
  "vendor_phone": "string|null",
  "receipt_number": "string|null",
  "date": "YYYY-MM-DD|null",
  "time": "HH:MM|null",
  "subtotal": "number|null",
  "tax": "number|null",
  "tip": "number|null",
  "total": "number|null",
  "amount": "number|null",
  "payment_method": "Cash|Credit Card|Debit Card|Check|ACH|Wire|Other|null",
  "card_last4": "string|null",
  "category": "materials|labor|equipment|subcontractor|operating|other|null",
  "description": "string|null (max 80 chars)",
  "line_items": [{ "description":"string","quantity":"number|null","unit_price":"number|null","total":"number|null" }]
}`;

function safeParseJson(text: string): any {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  return null;
}

function normalize(raw: any) {
  const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);
  const str = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const total = num(raw?.total);
  const amount = num(raw?.amount) ?? total;
  const items = Array.isArray(raw?.line_items)
    ? raw.line_items
        .filter((x: any) => x && typeof x === "object")
        .slice(0, 30)
        .map((x: any) => ({
          description: typeof x.description === "string" ? x.description : "",
          quantity: num(x.quantity),
          unit_price: num(x.unit_price),
          total: num(x.total),
        }))
    : [];
  const cat = typeof raw?.category === "string" ? raw.category.toLowerCase() : null;
  const allowed = ["materials","labor","equipment","subcontractor","operating","other"];
  return {
    vendor: str(raw?.vendor),
    vendor_address: str(raw?.vendor_address),
    vendor_phone: str(raw?.vendor_phone),
    receipt_number: str(raw?.receipt_number),
    date: str(raw?.date),
    time: str(raw?.time),
    subtotal: num(raw?.subtotal),
    tax: num(raw?.tax),
    tip: num(raw?.tip),
    total,
    amount,
    payment_method: str(raw?.payment_method),
    card_last4: str(raw?.card_last4),
    category: allowed.includes(cat ?? "") ? cat : null,
    description: str(raw?.description),
    line_items: items,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const imageDataUrl: string | undefined = body?.imageDataUrl;
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "imageDataUrl (data:image/...) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Two-pass for accuracy: primary on Gemini Pro (best for vision + structure),
    // automatic retry on Flash if primary fails / returns garbage.
    const callModel = async (model: string) => {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: `Extract per this schema (return JSON only):\n${SCHEMA_HINT}` },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, status: res.status, text };
      }
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      const content = json?.choices?.[0]?.message?.content ?? "";
      const parsed = safeParseJson(content);
      return { ok: !!parsed, status: res.status, parsed, content };
    };

    let attempt = await callModel("google/gemini-2.5-pro");
    if (!attempt.ok) {
      // Retry on rate-limit / payment with cheaper model.
      if (attempt.status === 429 || attempt.status === 402) {
        return new Response(
          JSON.stringify({ error: attempt.status === 429 ? "Rate limited" : "AI quota exhausted" }),
          { status: attempt.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      attempt = await callModel("google/gemini-2.5-flash");
    }

    if (!attempt.ok || !attempt.parsed) {
      return new Response(JSON.stringify({ error: "Could not parse receipt", debug: attempt.content?.slice(0, 400) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = normalize(attempt.parsed);
    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
