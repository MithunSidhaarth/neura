import { NextRequest, NextResponse } from "next/server";

// Backs the InfoPanel's "Around the web" / "Videos" sections and gives
// the graph a real way to reach out past its own data -- typing or
// selecting a topic can surface actual external pages and YouTube videos
// about it, not just neurons already known to the graph.
//
// Runs server-side (Next.js route handler) for two reasons: the target
// endpoint doesn't send CORS headers a browser would accept, and this is
// the one place that owns request shaping / rate-limit-friendly headers,
// same rationale as app/api/ai/route.ts owning the Groq key.
//
// No API key required -- this parses DuckDuckGo's keyless HTML results
// pages server-side (html.duckduckgo.com, with a lite.duckduckgo.com
// fallback for when the primary endpoint gets rate-limited/soft-blocked,
// which happens more than you'd like on a shared serverless IP). It's
// screen-scraping, not a stable public API, so it degrades gracefully: on
// any parse/network failure this returns empty arrays (200, not an error)
// and the client falls back to plain "open a search for this" links,
// which always work regardless of scraping health.

export const runtime = "nodejs";

interface WebResult {
    title: string;
    url: string;
    snippet?: string;
    source?: string;
}

const DDG_HTML = "https://html.duckduckgo.com/html/";
// Lighter-weight sibling endpoint DDG serves to old/text browsers. Its bot
// checks and rate limits are handled independently from html.duckduckgo.com,
// so when the primary endpoint comes back empty (which was happening for a
// good chunk of queries -- shared serverless IPs get rate-limited there
// fairly aggressively) this gives a second, differently-throttled path
// instead of just failing the request.
const DDG_LITE = "https://lite.duckduckgo.com/lite/";
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const COMMON_HEADERS = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
};

function decodeEntities(s: string): string {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#x27;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(s: string): string {
    return decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// DuckDuckGo's HTML results wrap real URLs in a redirect
// (`//duckduckgo.com/l/?uddg=<encoded>&...`) so it can log click-throughs.
// Unwrap that to get the actual destination.
function unwrapDdgUrl(href: string): string | null {
    try {
        const full = href.startsWith("//") ? `https:${href}` : href;
        const u = new URL(full, "https://duckduckgo.com");
        const uddg = u.searchParams.get("uddg");
        if (uddg) return decodeURIComponent(uddg);
        if (/^https?:\/\//i.test(full) && !full.includes("duckduckgo.com")) return full;
        return null;
    } catch {
        return null;
    }
}

function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

// Shared "extract results out of an HTML blob" step -- both the primary
// and lite endpoints land on markup that's regex-friendly the same way,
// just with different class names for the link/snippet.
function extractResults(
    html: string,
    linkClass: string,
    snippetClass: string,
    limit: number,
    unwrapUrl: (href: string) => string | null
): WebResult[] {
    const linkRe = new RegExp(
        `<a[^>]*class="[^"]*${linkClass}[^"]*"[^>]*href="([^"]+)"[^>]*>([\\s\\S]*?)<\\/a>`,
        "g"
    );
    const snippetRe = new RegExp(
        `<[^>]*class="[^"]*${snippetClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:a|td|span|div)>`,
        "g"
    );

    const links: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) && links.length < limit * 3) {
        const url = unwrapUrl(m[1]);
        const title = stripTags(m[2]);
        if (url && title) links.push({ url, title });
    }

    const snippets: string[] = [];
    while ((m = snippetRe.exec(html)) && snippets.length < links.length) {
        snippets.push(stripTags(m[1]));
    }

    const seen = new Set<string>();
    const out: WebResult[] = [];
    for (let i = 0; i < links.length && out.length < limit; i++) {
        const { url, title } = links[i];
        const host = hostnameOf(url);
        if (!host || seen.has(url)) continue;
        seen.add(url);
        out.push({ title, url, snippet: snippets[i], source: host });
    }
    return out;
}

// Primary endpoint. POSTing the query (rather than GETing it as a query
// string) mirrors what the real html.duckduckgo.com form does and is
// noticeably less likely to get flagged/rate-limited than a bare GET,
// which was the main reason "around the web" was silently coming back
// empty for a chunk of searches.
async function ddgHtmlSearch(query: string, limit: number): Promise<WebResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(DDG_HTML, {
            method: "POST",
            headers: {
                ...COMMON_HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                Referer: "https://html.duckduckgo.com/",
                Origin: "https://html.duckduckgo.com",
            },
            body: new URLSearchParams({ q: query, kl: "us-en" }).toString(),
            signal: controller.signal,
            cache: "no-store",
        });

        if (!res.ok) return [];
        const html = await res.text();
        return extractResults(html, "result__a", "result__snippet", limit, unwrapDdgUrl);
    } catch {
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

// Fallback endpoint (the text-browser-oriented "lite" UI). It's rendered
// server-side by DDG independently of html.duckduckgo.com, so a rate-limit
// or transient block on the primary endpoint doesn't take this down too.
// Its result links are plain absolute URLs (no redirect wrapper to unwrap).
async function ddgLiteSearch(query: string, limit: number): Promise<WebResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(DDG_LITE, {
            method: "POST",
            headers: {
                ...COMMON_HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                Referer: "https://lite.duckduckgo.com/lite/",
                Origin: "https://lite.duckduckgo.com",
            },
            body: new URLSearchParams({ q: query, kl: "us-en" }).toString(),
            signal: controller.signal,
            cache: "no-store",
        });

        if (!res.ok) return [];
        const html = await res.text();
        return extractResults(html, "result-link", "result-snippet", limit, (href) => {
            if (/^https?:\/\//i.test(href)) return href;
            return unwrapDdgUrl(href);
        });
    } catch {
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

// Tries the primary endpoint first, falls back to the lite one on empty
// results -- this covers both outright request failures and the "200 OK
// but zero parsed results" case, which is what a soft rate-limit/block
// usually looks like from the caller's side.
async function ddgSearch(query: string, limit: number): Promise<WebResult[]> {
    const primary = await ddgHtmlSearch(query, limit);
    if (primary.length > 0) return primary;
    return ddgLiteSearch(query, limit);
}

export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json({ error: "Missing query." }, { status: 400 });

    // Run the general query and a YouTube-scoped query in parallel so one
    // slow/failed leg doesn't block the other.
    const [general, videoRaw] = await Promise.all([
        ddgSearch(q, 6),
        ddgSearch(`${q} site:youtube.com/watch`, 6),
    ]);

    // Some general results may already be YouTube links -- keep the web
    // list to non-video pages so the two sections don't duplicate.
    const web = general.filter((r) => !/youtube\.com|youtu\.be/i.test(r.url)).slice(0, 5);

    const videos = videoRaw
        .filter((r) => /youtube\.com\/watch|youtu\.be\//i.test(r.url))
        .slice(0, 4);

    return NextResponse.json({ web, videos });
}
