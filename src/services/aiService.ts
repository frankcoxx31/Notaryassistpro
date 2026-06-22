import { auth } from "../firebase";

export interface AiResearchResult {
  answer: string;
  citations: { title: string; url: string }[];
  officialStateLink?: string;
}

/**
 * Generates an email template based on a user's prompt.
 * Calls the secure server endpoint so the Anthropic API key stays on the
 * backend (ANTHROPIC_API_KEY) and is never exposed in the browser.
 */
export async function generateEmailTemplate(prompt: string): Promise<{ name: string; htmlContent: string; category: string }> {
  const token = await auth.currentUser?.getIdToken() ?? '';
  if (!token) {
    throw new Error("You must be signed in to use the AI Designer.");
  }

  const res = await fetch('/api/ai/generate-template', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to generate template structure");
  }
  return data;
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
