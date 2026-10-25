export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI backend is not configured yet. Add GEMINI_API_KEY in Vercel Project Settings → Environment Variables." });

  try {
    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "దయచేసి మీ ప్రశ్న టైప్ చేయండి." });
    if (message.length > 4000) return res.status(413).json({ error: "ప్రశ్న 4000 అక్షరాల లోపు ఉండాలి." });

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "మీరు Mana AI Skills అనే తెలుగు నేర్చుకునే యాప్‌లో సహాయకుడు. సహజమైన, స్పష్టమైన తెలుగులో సమాధానం ఇవ్వండి. అవసరమైతే English technical terms వాడండి. ప్రశ్నకు దశలవారీగా, ఉపయోగకరంగా సమాధానం ఇవ్వండి. ఆరోగ్యం, డబ్బు, చట్టం వంటి విషయాల్లో పరిమితులను స్పష్టంగా చెప్పండి. మోసపూరిత హామీలు ఇవ్వవద్దు." }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 900 }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      const apiMessage = data?.error?.message || "";
      console.error("Gemini API error", response.status, apiMessage);
      let userMessage = "AI సేవలో తాత్కాలిక సమస్య (HTTP " + response.status + ").";
      if (response.status === 400 || response.status === 404) {
        userMessage = "Gemini మోడల్ లేదా API అభ్యర్థనలో సమస్య ఉంది (HTTP " + response.status + ").";
      } else if (response.status === 401 || response.status === 403) {
        userMessage = "Gemini API key చెల్లకపోవచ్చు లేదా దానికి అనుమతి లేదు (HTTP " + response.status + "). Vercelలో GEMINI_API_KEY సరిచూడాలి.";
      } else if (response.status === 429) {
        userMessage = "Gemini API పరిమితి లేదా కోటా పూర్తయింది (HTTP 429). కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.";
      } else if (response.status >= 500) {
        userMessage = "Gemini సర్వర్ ప్రస్తుతం స్పందించడం లేదు (HTTP " + response.status + ").";
      }
      return res.status(502).json({ error: userMessage });
    }
    const answer = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!answer) return res.status(502).json({ error: "AI నుంచి సమాధానం రాలేదు. మళ్లీ ప్రయత్నించండి." });
    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Chat API failure", error);
    return res.status(500).json({ error: "తాత్కాలిక సమస్య. మళ్లీ ప్రయత్నించండి." });
  }
}