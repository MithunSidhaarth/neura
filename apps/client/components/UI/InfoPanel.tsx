"use client";

import { useEffect, useState } from "react";
import styles from "./InfoPanel.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";
import { googleSearchUrl, webSearch, WebSearchResponse, youtubeSearchUrl } from "@/lib/web/client";

const TYPE_LABELS: Record<string, string> = {
    parent: "Part of",
    prerequisite: "Builds on",
    similarity: "Similar to",
    reference: "References",
    citation: "Cites",
    shared_technology: "Shares technology with",
    shared_topic: "Shares topic with",
};

interface WikiSummary {
    extract: string;
    url: string;
}

// Live-fetches a short Wikipedia summary for the selected neuron's title,
// via Wikipedia's public REST API (no key required). This is a genuine
// network call, not fabricated content -- if there's no matching article,
// or the request fails (e.g. offline / blocked), the section is simply
// omitted rather than showing a placeholder or invented text.
function useWikipediaSummary(title: string | undefined, skip: boolean): {
    data: WikiSummary | null;
    loading: boolean;
} {
    const [data, setData] = useState<WikiSummary | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setData(null);
        if (!title || skip) return;

        let cancelled = false;
        setLoading(true);

        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (cancelled || !json || json.type === "disambiguation") return;
                if (!json.extract) return;
                setData({
                    extract: json.extract as string,
                    url: json.content_urls?.desktop?.page ??
                        `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
                });
            })
            .catch(() => {
                // No connectivity, no article, or CORS/network failure --
                // fail silently, the panel still works without it.
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [title, skip]);

    return { data, loading };
}

function wikiUrlFor(title: string): string {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

// Per-session cache keyed by title so re-selecting a neuron you've already
// looked at doesn't re-hit the search route -- the graph is explored by
// clicking back and forth between connections a lot.
const webSearchCache = new Map<string, WebSearchResponse>();

// Fetches a few live "around the web" articles and YouTube videos for the
// selected neuron's title -- the graph's own data plus a real, current
// window onto the rest of the internet, not just what's already a neuron.
function useWebSearch(title: string | undefined): {
    data: WebSearchResponse | null;
    loading: boolean;
    error: string | null;
} {
    const [data, setData] = useState<WebSearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
        if (!title) {
            setData(null);
            return;
        }

        const cached = webSearchCache.get(title);
        if (cached) {
            setData(cached);
            return;
        }

        setData(null);
        let cancelled = false;
        setLoading(true);

        webSearch(title)
            .then((res) => {
                if (cancelled) return;
                webSearchCache.set(title, res);
                setData(res);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "Web search failed.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [title]);

    return { data, loading, error };
}

// Shows the selected neuron and its direct connections -- the "neurons
// never connect randomly, every connection has a type" idea from the
// vision doc, made visible instead of just implied by a line.
export default function InfoPanel() {

    const { selectedId, expanding, aiExpanding, explainingId, explainError } = useEngineState();
    const { graph } = engineStore;
    const node = selectedId ? graph.byId.get(selectedId) : undefined;

    // Called unconditionally (rules of hooks) -- the hook itself no-ops
    // when there's no title to look up, or when this neuron already came
    // from Wikipedia (its description IS the wiki extract already, no
    // need to refetch -- we just link straight to the article).
    const isWikiOrigin = node?.neuron.origin === "wiki";
    const { data: wiki, loading: wikiLoading } = useWikipediaSummary(
        node?.neuron.title,
        isWikiOrigin
    );
    const { data: web, loading: webLoading, error: webError } = useWebSearch(node?.neuron.title);

    if (!selectedId || !node) return null;

    const connections = graph.connections
        .filter((c) => c.from.neuron.id === selectedId || c.to.neuron.id === selectedId)
        .map((c) => {
            const other = c.from.neuron.id === selectedId ? c.to : c.from;
            return { other, type: c.type, weight: c.weight };
        })
        .sort((a, b) => b.weight - a.weight);

    // Neurons already in the graph that look related by keyword overlap
    // but aren't linked yet -- picking one links it immediately and jumps
    // there. Strong matches link automatically as soon as a neuron enters
    // the graph (see EngineStore.autoLinkSimilar); this is the "close but
    // not quite" tier for the user to confirm manually.
    const suggestions = engineStore.relatedSuggestions(selectedId);

    const directWikiUrl = isWikiOrigin
        ? wikiUrlFor(node.neuron.wikiTitle ?? node.neuron.title)
        : null;

    return (
        <div className={styles.wrapper}>
            <div className={styles.panel}>
                <button className={styles.close} onClick={() => engineStore.select(null)} aria-label="Close">
                    ×
                </button>

                <div className={styles.eyebrow}>
                    {node.neuron.type} · {node.neuron.domain}
                    {node.neuron.origin === "ai" && <span className={styles.aiBadge}> · AI-generated</span>}
                </div>
                <div className={styles.title}>{node.neuron.title}</div>

                {node.neuron.description ? (
                    <div className={styles.description}>{node.neuron.description}</div>
                ) : explainingId === selectedId ? (
                    <div className={styles.wikiLoading}>Asking AI to explain this…</div>
                ) : (
                    <button className={styles.aiAction} onClick={() => engineStore.explainWithAI(selectedId)}>
                        Explain with AI
                    </button>
                )}

                {explainError && explainingId !== selectedId && (
                    <div className={styles.wikiLoading}>{explainError}</div>
                )}

                {!isWikiOrigin && connections.length < 2 && (
                    <button
                        className={styles.aiAction}
                        disabled={!!aiExpanding}
                        onClick={() => engineStore.aiExpandTopic(node.neuron.wikiTitle ?? node.neuron.title, selectedId)}
                    >
                        {aiExpanding ? "Expanding…" : "Expand with AI"}
                    </button>
                )}

                {directWikiUrl && (
                    <div className={styles.wiki}>
                        <a
                            className={styles.wikiLink}
                            href={directWikiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Read on Wikipedia ↗
                        </a>
                    </div>
                )}

                {!isWikiOrigin && (wikiLoading || wiki) && (
                    <div className={styles.wiki}>
                        <div className={styles.wikiHeading}>From Wikipedia</div>
                        {wikiLoading && !wiki && (
                            <div className={styles.wikiLoading}>Looking it up…</div>
                        )}
                        {wiki && (
                            <>
                                <div className={styles.wikiExtract}>{wiki.extract}</div>
                                <a
                                    className={styles.wikiLink}
                                    href={wiki.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Read on Wikipedia ↗
                                </a>
                            </>
                        )}
                    </div>
                )}

                <div className={styles.wiki}>
                    <div className={styles.wikiHeading}>Around the web</div>

                    {webLoading && (
                        <div className={styles.wikiLoading}>Searching the web…</div>
                    )}

                    {webError && !webLoading && (
                        <div className={styles.wikiEmpty}>Couldn&apos;t reach the web just now.</div>
                    )}

                    {web && web.web.length > 0 && (
                        <div className={styles.webList}>
                            {web.web.map((r, i) => (
                                <a
                                    key={i}
                                    className={styles.webItem}
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <span className={styles.webItemTitle}>{r.title}</span>
                                    {r.source && <span className={styles.webItemSource}>{r.source}</span>}
                                    {r.snippet && <span className={styles.webItemSnippet}>{r.snippet}</span>}
                                </a>
                            ))}
                        </div>
                    )}

                    {web && web.videos.length > 0 && (
                        <div className={styles.webList} style={{ marginTop: 12 }}>
                            {web.videos.map((v, i) => (
                                <a
                                    key={i}
                                    className={styles.webItem}
                                    href={v.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <span className={styles.webItemTitle}>
                                        <span className={styles.videoTag}>▶ VIDEO</span>
                                        {v.title}
                                    </span>
                                    {v.source && <span className={styles.webItemSource}>{v.source}</span>}
                                </a>
                            ))}
                        </div>
                    )}

                    {web && web.web.length === 0 && web.videos.length === 0 && !webLoading && !webError && (
                        <div className={styles.wikiEmpty}>No web results found.</div>
                    )}

                    {/* Always available regardless of scraping success --
                        real, immediate traversal to the open web from any
                        neuron, not just what this panel could fetch inline. */}
                    <div className={styles.webQuick}>
                        <a
                            className={styles.wikiLink}
                            href={googleSearchUrl(node.neuron.title)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Search Google ↗
                        </a>
                        <a
                            className={styles.wikiLink}
                            href={youtubeSearchUrl(node.neuron.title)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Search YouTube ↗
                        </a>
                    </div>
                </div>

                {node.neuron.tags.length > 0 && (
                    <div className={styles.tags}>
                        {node.neuron.tags.map((tag) => (
                            <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                    </div>
                )}

                {expanding && (
                    <div className={styles.wikiLoading}>Pulling in related topics…</div>
                )}

                {connections.length > 0 && (
                    <div className={styles.connections}>
                        <div className={styles.connectionsHeading}>
                            Connections
                            {isWikiOrigin && <span className={styles.connectionsHint}> · click any to travel there</span>}
                        </div>
                        {connections.map((c, i) => (
                            <button
                                key={i}
                                className={styles.connection}
                                onClick={() => engineStore.select(c.other.neuron.id)}
                            >
                                <span className={styles.connectionType}>
                                    {TYPE_LABELS[c.type] ?? c.type}
                                </span>
                                <span className={styles.connectionTitle}>{c.other.neuron.title}</span>
                            </button>
                        ))}
                    </div>
                )}

                {suggestions.length > 0 && (
                    <div className={styles.connections}>
                        <div className={styles.connectionsHeading}>
                            Related topics
                            <span className={styles.connectionsHint}> · click to link &amp; travel there</span>
                        </div>
                        {suggestions.map((s) => (
                            <button
                                key={s.neuron.id}
                                className={styles.connection}
                                onClick={() => {
                                    engineStore.linkNeurons(selectedId, s.neuron.id);
                                    engineStore.select(s.neuron.id);
                                }}
                            >
                                <span className={styles.connectionType}>+ link</span>
                                <span className={styles.connectionTitle}>{s.neuron.title}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
