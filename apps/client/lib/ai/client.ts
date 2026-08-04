// Thin client-side wrapper around /api/ai. Kept dependency-free (plain
// fetch) and deliberately dumb — all the real logic (prompts, parsing,
// the Groq key) lives server-side in app/api/ai/route.ts so the key is
// never exposed to the browser.

export interface AiExpandConcept {
    title: string;
    description: string;
    relation: "prerequisite" | "similarity" | "reference" | "shared_technology" | "shared_topic";
    weight: number;
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface DebatePair {
    title: string;
    claim: string;
    rebuttal: string;
}

async function post<T>(payload: Record<string, unknown>): Promise<T> {
    const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || `AI request failed (${res.status}).`);
    }
    return data as T;
}

export function aiExplain(topic: string): Promise<{ explanation: string }> {
    return post({ mode: "explain", topic });
}

export function aiExpand(topic: string): Promise<{ concepts: AiExpandConcept[] }> {
    return post({ mode: "expand", topic });
}

export function aiChat(messages: ChatMessage[], context?: string): Promise<{ reply: string }> {
    return post({ mode: "chat", messages, context });
}

export function aiDebate(topic: string): Promise<{ pairs: DebatePair[] }> {
    return post({ mode: "debate", topic });
}

// Live "Debate Mode": one turn at a time, alternating sides, each call
// reading the transcript so far. `agent` picks which model answers --
// "for" is Groq's main model (same voice as the claim side of
// `aiDebate`), "against" is a second, faster Groq model (same voice as
// the rebuttal side) -- so a single topic can grow into an open-ended
// back-and-forth instead of one fixed batch. Both sides share Groq's
// rate-limit bucket, so a very long live debate can occasionally hit a
// 429 -- see the MODEL_AGAINST comment in app/api/ai/route.ts.
export function aiDebateTurn(
    topic: string,
    agent: "for" | "against",
    history: { agent: "for" | "against"; text: string }[]
): Promise<{ text: string }> {
    return post({ mode: "debateTurn", topic, agent, history });
}
