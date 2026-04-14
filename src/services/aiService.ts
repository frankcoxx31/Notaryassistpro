import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AiResearchResult {
  answer: string;
  citations: { title: string; url: string }[];
  officialStateLink?: string;
}

/**
 * Simulates a web-backed AI research search using Gemini.
 * In a real-world scenario, this would call an API like Perplexity or use Gemini with Grounding.
 */
export async function searchAiFallback(query: string, state: string): Promise<AiResearchResult> {
  console.log(`[AI Search] Request started for query: "${query}" in state: ${state}`);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("[AI Search] GEMINI_API_KEY is missing");
    throw new Error("AI search is not configured. Please add GEMINI_API_KEY to your environment.");
  }

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
