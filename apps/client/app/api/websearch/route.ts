import { NextRequest, NextResponse } from "next/server";

// Backs the InfoPanel's "Around the web" / "Videos" sections -- pulls
// live results for whatever topic/neuron is selected so the graph can
// reach past its own data.
//
// Previously this scraped DuckDuckGo's keyless HTML results pages
// (html.duckduckgo.com / lite.duckduckgo.com). That needed no API key
// but was fragile by nature -- screen-scraping, not a stable public
// API -- and got soft-rate-limited on shared serverless IPs often
// enough that "Around the web" would silently come back empty. Tavily
// is built for exactly this (LLM/agent-facing search, generous free
// tier, no scraping fragility), so this route now calls it directly.
//
// TAVILY_API_KEY must be set in `.env.local` (see .env.local.example).
// Runs server-side only -- the key never reaches the browser.

export const runtime = "nodejs";

interface WebResult {
    title: string;
    url: string;
    snippet?: string;
    source?: string;
}

interface TavilyResult {
    title?: string;
    url?: string;
    content?: string;
}

const TAVILY_URL = "https://api.tavily.com/search";

function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

// One Tavily call, shaped into WebResult[]. `includeDomains`/`excludeDomains`
// let the two calls below both reuse this -- one scoped to YouTube for the
// "Videos" section, one excluding it so the general "Around the web" list
// doesn't duplicate those links.
async function tavilySearch(
    apiKey: string,
    query: string,
    limit: number,
    opts: { includeDomains?: string[]; excludeDomains?: string[] }
): Promise<WebResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(TAVILY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                query,
                max_results: limit,
                search_depth: "basic",
                include_domains: opts.includeDomains,
                exclude_domains: opts.excludeDomains,
            }),
            signal: controller.signal,
            cache: "no-store",
        });

        if (!res.ok) return [];
        const data = await res.json();
        const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];

        return results
            .filter((r) => r.title && r.url)
            .slice(0, limit)
            .map((r) => ({
                title: r.title as string,
                url: r.url as string,
                snippet: r.content ? r.content.slice(0, 220) : undefined,
                source: hostnameOf(r.url as string),
            }));
    } catch {
        // Timeout, network failure, or malformed response -- degrade to
        // an empty list (200, not an error) so the client falls back to
        // plain "open a search for this" links, same as before.
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json({ error: "Missing query." }, { status: 400 });

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "TAVILY_API_KEY is not set. Add it to client/.env.local (see .env.local.example)." },
            { status: 502 }
        );
    }

    // Run the general query and a YouTube-scoped query in parallel so one
    // slow leg doesn't block the other.
    const [web, videos] = await Promise.all([
        tavilySearch(apiKey, q, 5, { excludeDomains: ["youtube.com", "youtu.be"] }),
        tavilySearch(apiKey, q, 4, { includeDomains: ["youtube.com"] }),
    ]);

    return NextResponse.json({ web, videos });
}
