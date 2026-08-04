import { NextRequest, NextResponse } from "next/server";

// Single server route backing all three "AI" surfaces in the vision doc:
// topic explanation, AI-generated graph expansion, and the chat panel.
// Kept as one route (mode-dispatched) rather than three so there's one
// place that owns the Groq key and one place to swap models/providers.
//
// GROQ_API_KEY must be set in `.env.local` (see `.env.local.example`).
// This runs server-side only — the key never reaches the browser.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

type Mode = "explain" | "expand" | "chat";

interface ExpandedConcept {
    title: string;
    description: string;
    relation: "prerequisite" | "similarity" | "reference" | "shared_technology" | "shared_topic";
    weight: number;
}

async function callGroq(messages: { role: string; content: string }[], json: boolean) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error(
            "GROQ_API_KEY is not set. Add it to client/.env.local (see .env.local.example) and restart the dev server."
        );
    }

    const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.6,
            max_tokens: 1024,
            ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Groq request failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned an empty response.");
    return content;
}

// Groq's json_object mode still returns a string; models occasionally
// wrap it in a fence anyway despite the instruction not to. Strip that
// defensively rather than trusting the mode alone.
function parseJsonLoose(text: string): unknown {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
    let body: { mode: Mode; topic?: string; context?: string; messages?: { role: string; content: string }[] };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    try {
        if (body.mode === "explain") {
            const topic = (body.topic ?? "").trim();
            if (!topic) return NextResponse.json({ error: "Missing topic." }, { status: 400 });

            const content = await callGroq(
                [
                    {
                        role: "system",
                        content:
                            "You explain topics for a knowledge-graph explorer. Write 2-4 tight sentences, no headers, no bullet points, no preamble like 'Sure' or 'Certainly'. Be precise and information-dense.",
                    },
                    { role: "user", content: `Explain: ${topic}` },
                ],
                false
            );
            return NextResponse.json({ explanation: content.trim() });
        }

        if (body.mode === "expand") {
            const topic = (body.topic ?? "").trim();
            if (!topic) return NextResponse.json({ error: "Missing topic." }, { status: 400 });

            const content = await callGroq(
                [
                    {
                        role: "system",
                        content:
                            'You generate knowledge-graph expansions. Given a topic, return ONLY a JSON object of the shape {"concepts":[{"title":string,"description":string,"relation":"prerequisite"|"similarity"|"reference"|"shared_technology"|"shared_topic","weight":number}]} with 4 to 6 entries. "description" is 1-2 sentences. "weight" is 0.3-0.9, how strongly it relates. No markdown, no commentary, JSON only.',
                    },
                    { role: "user", content: `Topic: ${topic}` },
                ],
                true
            );

            const parsed = parseJsonLoose(content) as { concepts?: ExpandedConcept[] };
            const concepts = Array.isArray(parsed.concepts) ? parsed.concepts : [];
            const clean = concepts
                .filter((c) => c && typeof c.title === "string" && c.title.trim())
                .slice(0, 6)
                .map((c) => ({
                    title: c.title.trim(),
                    description: typeof c.description === "string" ? c.description.trim() : "",
                    relation: (
                        ["prerequisite", "similarity", "reference", "shared_technology", "shared_topic"] as const
                    ).includes(c.relation)
                        ? c.relation
                        : "similarity",
                    weight: typeof c.weight === "number" ? Math.min(1, Math.max(0.1, c.weight)) : 0.5,
                }));

            return NextResponse.json({ concepts: clean });
        }

        if (body.mode === "chat") {
            const messages = Array.isArray(body.messages) ? body.messages : [];
            if (messages.length === 0) return NextResponse.json({ error: "Missing messages." }, { status: 400 });

            const system = {
                role: "system",
                content:
                    "You are the AI panel inside Neura, a 3D knowledge-graph explorer. Answer conversationally and concisely (usually under 120 words unless asked for more). If graph context about the currently selected neuron is provided, use it, but don't force it into every reply." +
                    (body.context ? `\n\nCurrently selected neuron:\n${body.context}` : ""),
            };

            const content = await callGroq([system, ...messages], false);
            return NextResponse.json({ reply: content.trim() });
        }

        return NextResponse.json({ error: `Unknown mode "${body.mode}".` }, { status: 400 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown AI error.";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
