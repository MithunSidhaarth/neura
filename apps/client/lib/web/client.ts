// Thin client-side wrapper around /api/websearch, mirroring lib/ai/client.ts --
// dumb on purpose. Real logic (the DuckDuckGo fetch + parsing) lives
// server-side so it isn't subject to browser CORS restrictions.

export interface WebResult {
    title: string;
    url: string;
    snippet?: string;
    source?: string;
}

export interface ImageResult {
    title: string;
    image: string;
    thumbnail: string;
    url: string;
    source?: string;
    width?: number;
    height?: number;
}

export interface WebSearchResponse {
    web: WebResult[];
    videos: WebResult[];
    images: ImageResult[];
}

export async function webSearch(query: string): Promise<WebSearchResponse> {
    const res = await fetch(`/api/websearch?q=${encodeURIComponent(query)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || `Web search failed (${res.status}).`);
    }
    return {
        web: Array.isArray(data.web) ? data.web : [],
        videos: Array.isArray(data.videos) ? data.videos : [],
        images: Array.isArray(data.images) ? data.images : [],
    };
}

export function googleSearchUrl(query: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function youtubeSearchUrl(query: string): string {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
