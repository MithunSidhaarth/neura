"use client";

import { useState } from "react";
import styles from "./SearchBar.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";
import { googleSearchUrl, youtubeSearchUrl } from "@/lib/web/client";

// "AI SEARCH" from the vision doc, scoped to what's actually implemented
// and honest about it: a client-side keyword match over the graph's
// titles/tags/types (no model, no query understanding) -- BUT unlike a
// closed local index, a query that doesn't match anything already in the
// graph can be sent straight to Wikipedia. That's what makes the graph
// "unlimited": any topic becomes a real neuron, wired to its real related
// topics, permanently part of the explorable field from then on.
export default function SearchBar() {

    const { query, expanding, expandError, aiExpanding, aiExpandError } = useEngineState();
    const [focused, setFocused] = useState(false);

    const results = engineStore.searchResults(6);
    const trimmed = query.trim();
    const exactLocalMatch = results.some(
        (r) => r.title.toLowerCase() === trimmed.toLowerCase()
    );
    const showExpandOption = trimmed.length > 1 && !exactLocalMatch && !expanding;

    const runExpand = () => {
        if (!trimmed) return;
        engineStore.expandTopic(trimmed);
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.box}>
                <span className={styles.icon} aria-hidden="true">
                    {expanding ? <span className={styles.spinner} /> : "◎"}
                </span>

                <input
                    data-neura-search
                    className={styles.input}
                    placeholder="Search the graph, or pull in any topic…"
                    value={query}
                    onChange={(e) => engineStore.setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            if (results[0] && exactLocalMatch) {
                                engineStore.select(results[0].id);
                            } else if (trimmed) {
                                runExpand();
                            }
                        }
                        if (e.key === "Escape") {
                            engineStore.setQuery("");
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                />

                {expanding && (
                    <span className={styles.status}>Reading “{expanding}”…</span>
                )}

                {focused && query.trim() && !expanding && (
                    <div className={styles.results}>
                        {results.map((n) => (
                            <button
                                key={n.id}
                                className={styles.result}
                                onMouseDown={() => engineStore.select(n.id)}
                            >
                                <span className={styles.resultTitle}>{n.title}</span>
                                <span className={styles.resultMeta}>
                                    {n.origin === "wiki" ? "wikipedia" : n.origin === "ai" ? "ai-generated" : n.type} · {n.domain}
                                </span>
                            </button>
                        ))}

                        {results.length === 0 && !showExpandOption && (
                            <div className={styles.empty}>No matches</div>
                        )}

                        {showExpandOption && (
                            <button
                                className={`${styles.result} ${styles.expandResult}`}
                                onMouseDown={runExpand}
                            >
                                <span className={styles.resultTitle}>
                                    Pull “{trimmed}” in from Wikipedia
                                </span>
                                <span className={styles.resultMeta}>
                                    new neuron · related topics included
                                </span>
                            </button>
                        )}

                        {showExpandOption && (
                            <button
                                className={`${styles.result} ${styles.expandResult}`}
                                onMouseDown={() => engineStore.aiExpandTopic(trimmed)}
                                disabled={!!aiExpanding}
                            >
                                <span className={styles.resultTitle}>
                                    {aiExpanding ? `Generating “${aiExpanding}”…` : `Expand “${trimmed}” with AI`}
                                </span>
                                <span className={styles.resultMeta}>
                                    for ideas &amp; jargon Wikipedia won&apos;t have
                                </span>
                            </button>
                        )}

                        {trimmed.length > 1 && (
                            <>
                                <a
                                    className={`${styles.result} ${styles.expandResult}`}
                                    href={googleSearchUrl(trimmed)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <span className={styles.resultTitle}>
                                        Search the web for &quot;{trimmed}&quot;
                                    </span>
                                    <span className={styles.resultMeta}>opens in a new tab</span>
                                </a>
                                <a
                                    className={`${styles.result} ${styles.expandResult}`}
                                    href={youtubeSearchUrl(trimmed)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <span className={styles.resultTitle}>
                                        Find videos about &quot;{trimmed}&quot;
                                    </span>
                                    <span className={styles.resultMeta}>on YouTube · opens in a new tab</span>
                                </a>
                            </>
                        )}
                    </div>
                )}
            </div>

            {expandError && !expanding && (
                <div className={styles.error}>{expandError}</div>
            )}
            {aiExpandError && !aiExpanding && (
                <div className={styles.error}>{aiExpandError}</div>
            )}
        </div>
    );
}
