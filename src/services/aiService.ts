import Anthropic from "@anthropic-ai/sdk";

export interface AiResearchResult {
  answer: string;
  citations: { title: string; url: string }[];
  officialStateLink?: string;
}

/**
 * Generates an email template based on a user's prompt.
 */
export async function generateEmailTemplate(prompt: string): Promise<{ name: string; htmlContent: string; category: string }> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI Designer is not configured. Please add VITE_ANTHROPIC_API_KEY to your environment variables.");
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Generate a professional email template for a Notary Signing Agent business.
User Request: "${prompt}"

BUSINESS DETAILS — use these real values directly in the email, do NOT use placeholders for them:
- Business Name: Integrity Closings CLT
- Notary Name: Frank Coxx
- Phone: 980-372-4103
- Email: fcoxx@integrityclosingsclt.com
- Website: https://www.integrityclosingsclt.com
- Booking URL: https://www.integrityclosingsclt.com/booking
- Service Area: Charlotte, NC and surrounding areas (Concord, Gastonia, Monroe, Matthews, Mint Hill, Salisbury, Mooresville)

RULES:
- Only use {{firstName}} as a placeholder for the recipient's first name
- Fill in ALL other details using the real business info above
- Do NOT include unsubscribe links or preference links
- The template should be responsive, modern, and high-quality HTML

Return ONLY a valid JSON object with no markdown, no code fences, just raw JSON:
{
  "name": "A short descriptive name for the template",
  "htmlContent": "The full HTML string for the email",
  "category": "One of: Marketing, Transactional, Follow-up, or Custom"
}`
      }
    ]
  });

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Could not parse AI response");
  } catch (error) {
    console.error("AI Template Generation Error:", error);
    throw new Error("Failed to generate template structure");
  }
}

/**
 * Simulates a web-backed AI research search using Gemini.
 * In a real-world scenario, this would call an API like Perplexity or use Gemini with Grounding.
 */
export async function searchAiFallback(query: string, state: string): Promise<AiResearchResult> {
  console.log(`[AI Search] Request started for query: "${query}" in state: ${state}`);
  
  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[AI Search] GEMINI_API_KEY is missing");
    throw new Error("AI search is not configured. Please add GEMINI_API_KEY to your environment variables/secrets.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a professional notary law researcher. 
    The user has a question about notary laws in the state of ${state}.
    Question: "${query}"

    Please provide:
    1. A clear, concise summary of the law or regulation (2-4 sentences).
    2. At least 2-3 specific citations or source titles that would likely contain this information (e.g., "National Notary Association", "Secretary of State Notary Handbook").
    3. If possible, a likely URL for the official state notary authority for ${state}.

    IMPORTANT: 
    - Clearly state that this is informational research and not legal advice.
    - If you are unsure, state that the user should consult their Secretary of State.
    - Format the response as JSON with the following structure:
    {
      "answer": "...",
      "citations": [{ "title": "...", "url": "..." }],
      "officialStateLink": "..."
    }
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts: [{ text: prompt }] }]
    });
    
    const text = result.text || "";
    console.log("[AI Search] Response received from Gemini");
    
    // Extract JSON from the response (Gemini sometimes wraps it in markdown blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("[AI Search] Successfully parsed JSON response");
      return parsed;
    }
    
    console.warn("[AI Search] Could not find JSON in response, returning raw text");
    return {
      answer: text,
      citations: [
        { title: "National Notary Association", url: "https://www.nationalnotary.org" },
        { title: `${state} Secretary of State`, url: "https://google.com/search?q=" + encodeURIComponent(`${state} Secretary of State Notary`) }
      ]
    };
  } catch (error) {
    console.error("[AI Search] API Error:", error);
    throw new Error("Failed to perform AI research. Please try again later.");
  }
}
