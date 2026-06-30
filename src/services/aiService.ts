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
 * AI-backed notary-law research.
 * Calls the secure server endpoint so the Gemini API key (GEMINI_API_KEY)
 * stays on the backend and is never exposed in the browser bundle.
 */
export async function searchAiFallback(query: string, state: string): Promise<AiResearchResult> {
  const token = await auth.currentUser?.getIdToken() ?? '';
  if (!token) {
    throw new Error("You must be signed in to use AI research.");
  }

  const res = await fetch('/api/ai/notary-research', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, state }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to perform AI research.");
  }
  return data;
}
