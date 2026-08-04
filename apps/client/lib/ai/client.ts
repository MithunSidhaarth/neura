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
