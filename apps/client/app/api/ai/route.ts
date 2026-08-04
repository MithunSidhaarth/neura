import { NextRequest, NextResponse } from "next/server";

// Single server route backing all three "AI" surfaces in the vision doc:
// topic explanation, AI-generated graph expansion, and the chat panel,
// plus both debate surfaces. Kept as one route (mode-dispatched) rather
// than several so there's one place that owns the provider key and one
// place to swap models/providers.
//
// GROQ_API_KEY must be set in `.env.local` -- it's the only key this
// route needs (see .env.local.example). It runs server-side only -- the
// key never reaches the browser.
//
// Previously the "against" side of a debate ran on Cerebras, as a
// second provider with its own quota. That was dropped after
// Cerebras's free-tier account backing this app hit its billing quota
// (402 "Payment required"), which broke both debate surfaces outright
// with no fallback. Everything now runs on Groq alone, split across two
// models instead of two providers -- see MODEL / MODEL_AGAINST below.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// "for" side of a debate, plus explain/expand/chat.
const MODEL = "llama-3.3-70b-versatile";
// "against" side of a debate. A distinct (smaller, faster) model rather
// than reusing MODEL, for two reasons: it keeps the two debate voices
// answering at comparable speed instead of the same model just talking
// to itself, and it gives the "against" side a genuinely different
// style rather than an echo of the "for" side's prompt.
//
// Trade-off worth knowing: unlike the old Cerebras split, both sides
// now draw from the same Groq account's per-minute rate-limit bucket,
// so a long live debate (`debateTurn`, one call per turn, no natural
// stopping point) can burn through it faster than before. If you see a
// 429 "Rate limit reached" error mid-debate, that's why -- it's a
// quota/pacing issue, not a code bug, and simply retrying after the
// per-minute window resets clears it.
const MODEL_AGAINST = "llama-3.1-8b-instant";

type Mode = "explain" | "expand" | "chat" | "debate" | "debateTurn";

interface ExpandedConcept {
    title: string;
    description: string;
    relation: "prerequisite" | "similarity" | "reference" | "shared_technology" | "shared_topic";
    weight: number;
}

interface DebateClaim {
    title: string;
    claim: string;
}

async function callGroq(
    messages: { role: string; content: string }[],
    json: boolean,
    model: string = MODEL
) {
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
            model,
            messages,
            temperature: 0.6,
            // Bumped from 1024 -- the old ceiling was tight enough that a
            // full claims/rebuttals JSON batch could get cut off mid-
            // string on longer topics, which is what produced the
            // "Unterminated string in JSON" parse error downstream.
            max_tokens: 2048,
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

// json_object mode still returns a string; the model occasionally wraps
// it in a fence anyway despite the instruction not to. Strip that
// defensively rather than trusting the mode alone.
function parseJsonLoose(text: string): unknown {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
    let body: {
        mode: Mode;
        topic?: string;
        context?: string;
        messages?: { role: string; content: string }[];
        agent?: "for" | "against";
        history?: { agent: "for" | "against"; text: string }[];
    };
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
                            "You explain topics inside Neura, a 3D knowledge-graph explorer. Write a clear, informative explanation in 2-4 short paragraphs, plain prose (no markdown headers or bullet lists).",
                    },
                    { role: "user", content: `Topic: ${topic}` },
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

        if (body.mode === "debate") {
            const topic = (body.topic ?? "").trim();
            if (!topic) return NextResponse.json({ error: "Missing topic." }, { status: 400 });

            // Step 1: the "for" model stakes out 3-4 sharp, specific
            // claims about the topic -- deliberately assertive rather
            // than hedged, so there's something concrete for the
            // "against" model to actually push back on rather than
            // agree with.
            const claimsRaw = await callGroq(
                [
                    {
                        role: "system",
                        content:
                            'You generate debate claims for a knowledge-graph explorer. Given a topic, return ONLY a JSON object of the shape {"claims":[{"title":string,"claim":string}]} with 3 to 4 entries. "title" is 2-5 words naming the specific angle (not just the topic name again). "claim" is 1-2 sentences making a sharp, specific, arguable assertion about the topic -- take a real position, don\'t hedge. No markdown, no commentary, JSON only.',
                    },
                    { role: "user", content: `Topic: ${topic}` },
                ],
                true
            );

            const parsedClaims = parseJsonLoose(claimsRaw) as { claims?: DebateClaim[] };
            const claims = (Array.isArray(parsedClaims.claims) ? parsedClaims.claims : [])
                .filter((c) => c && typeof c.title === "string" && typeof c.claim === "string")
                .slice(0, 4);

            if (claims.length === 0) {
                return NextResponse.json({ error: "Failed to generate debate claims." }, { status: 502 });
            }

            // Step 2: the "against" model rebuts each claim directly, in
            // the same order and count, so pairing back up on the client
            // is exact positional matching rather than fuzzy title-matching.
            // Runs on MODEL_AGAINST -- see the comment on that constant.
            const rebuttalsRaw = await callGroq(
                [
                    {
                        role: "system",
                        content:
                            'You are a sharp, direct debate opponent inside a knowledge-graph explorer. You will be given a numbered list of claims about a topic. Return ONLY a JSON object of the shape {"rebuttals":[string,...]} with EXACTLY one rebuttal per claim, in the same order. Each rebuttal is 1-2 sentences that directly counters that specific claim -- not a generic disagreement. No markdown, no commentary, JSON only.',
                    },
                    {
                        role: "user",
                        content: `Topic: ${topic}\n\nClaims:\n${claims
                            .map((c, i) => `${i + 1}. ${c.title}: ${c.claim}`)
                            .join("\n")}`,
                    },
                ],
                true,
                MODEL_AGAINST
            );

            const parsedRebuttals = parseJsonLoose(rebuttalsRaw) as { rebuttals?: string[] };
            const rebuttals = Array.isArray(parsedRebuttals.rebuttals) ? parsedRebuttals.rebuttals : [];

            const pairs = claims.map((c, i) => ({
                title: c.title.trim(),
                claim: c.claim.trim(),
                rebuttal: typeof rebuttals[i] === "string" && rebuttals[i].trim()
                    ? rebuttals[i].trim()
                    : "No rebuttal generated for this claim.",
            }));

            return NextResponse.json({ pairs });
        }

        if (body.mode === "debateTurn") {
            const topic = (body.topic ?? "").trim();
            const agent = body.agent === "for" || body.agent === "against" ? body.agent : null;
            if (!topic) return NextResponse.json({ error: "Missing topic." }, { status: 400 });
            if (!agent) return NextResponse.json({ error: "Missing or invalid agent." }, { status: 400 });

            // Bound the transcript sent to either model -- enough for a
            // coherent back-and-forth, not so much that a long debate
            // blows the context window or the response time.
            const history = (Array.isArray(body.history) ? body.history : []).slice(-8);
            const transcript = history.length
                ? history.map((h) => `${h.agent === "for" ? "FOR" : "AGAINST"}: ${h.text}`).join("\n")
                : "(no turns yet -- you are opening the debate)";

            const basePrompt =
                `You are the ${agent === "for" ? "FOR" : "AGAINST"} side of a live, two-AI debate ` +
                `inside a 3D knowledge-graph app. Argue ${agent === "for" ? "FOR" : "AGAINST"} the topic. ` +
                "Write ONE debate turn: 2-3 sharp sentences, confident and specific, no hedging. " +
                "If there's a prior turn from the other side, engage with it directly -- rebut its " +
                "weakest point rather than restating your own case in a vacuum. Never repeat a point " +
                "you or the opponent already made. No labels, no preamble, just the argument.\n\n" +
                `Topic: ${topic}\n\nTranscript so far:\n${transcript}`;

            // Same voice/model split as the batch "debate" mode above --
            // "for" on MODEL, "against" on MODEL_AGAINST, both via Groq.
            const turnRaw = await callGroq(
                [
                    {
                        role: "system",
                        content:
                            'Return ONLY a JSON object of the shape {"text": string} containing your next debate turn. No markdown, no commentary, JSON only.',
                    },
                    { role: "user", content: basePrompt },
                ],
                true,
                agent === "for" ? MODEL : MODEL_AGAINST
            );

            const parsedTurn = parseJsonLoose(turnRaw) as { text?: string };
            const text = typeof parsedTurn.text === "string" ? parsedTurn.text.trim() : "";
            if (!text) return NextResponse.json({ error: "Empty debate turn generated." }, { status: 502 });

            return NextResponse.json({ text });
        }

        return NextResponse.json({ error: `Unknown mode "${body.mode}".` }, { status: 400 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown AI error.";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
