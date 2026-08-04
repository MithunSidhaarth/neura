"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./CommandPalette.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

// Global Ctrl+K / Cmd+K command palette. Not a second search index --
// it drives the same store as the search bar and neuron context menu, so
// "jump to a neuron", "pull in a new topic", "ask AI to expand a topic",
// and "open the chat panel" all live in one keyboard-first place instead
// of being scattered across separate widgets.
export default function CommandPalette() {

    const { commandPaletteOpen, recentSearches, aiExpanding } = useEngineState();
    const [input, setInput] = useState("");

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                engineStore.toggleCommandPalette();
            }
            if (e.key === "Escape") {
                engineStore.toggleCommandPalette(false);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        if (commandPaletteOpen) setInput("");
    }, [commandPaletteOpen]);

    const trimmed = input.trim();

    const localMatches = useMemo(() => {
        if (!trimmed) return [];
        return engineStore.searchResults(5);
    }, [trimmed]);

    if (!commandPaletteOpen) return null;

    const close = () => engineStore.toggleCommandPalette(false);

    const jumpTo = (id: string) => {
        engineStore.select(id);
        close();
    };

    const expandWiki = () => {
        if (!trimmed) return;
        engineStore.expandTopic(trimmed);
        close();
    };

    const expandAi = () => {
        if (!trimmed) return;
        engineStore.aiExpandTopic(trimmed);
        close();
    };

    const openChat = (seed?: string) => {
        engineStore.toggleChat(true);
        close();
        if (seed) setTimeout(() => engineStore.sendChatMessage(seed), 50);
    };

    return (
        <div className={styles.backdrop} onClick={close}>
            <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
                <div className={styles.inputRow}>
                    <span className={styles.icon}>⌘</span>
                    <input
                        autoFocus
                        className={styles.input}
                        placeholder="Search, expand a topic, or ask AI…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                if (localMatches[0]) jumpTo(localMatches[0].id);
                                else if (trimmed) expandWiki();
                            }
                        }}
                    />
                    <kbd className={styles.kbd}>esc</kbd>
                </div>

                <div className={styles.list}>
                    {trimmed && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>Jump to</div>
                            {localMatches.map((n) => (
                                <button key={n.id} className={styles.row} onClick={() => jumpTo(n.id)}>
                                    <span className={styles.rowTitle}>{n.title}</span>
                                    <span className={styles.rowMeta}>{n.type} · {n.domain}</span>
                                </button>
                            ))}
                            {localMatches.length === 0 && (
                                <div className={styles.rowMuted}>No matching neurons</div>
                            )}
                        </div>
                    )}

                    {trimmed && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>Bring in a new topic</div>
                            <button className={styles.row} onClick={expandWiki}>
                                <span className={styles.rowTitle}>Pull &ldquo;{trimmed}&rdquo; from Wikipedia</span>
                                <span className={styles.rowMeta}>real article + related topics</span>
                            </button>
                            <button className={styles.row} onClick={expandAi} disabled={!!aiExpanding}>
                                <span className={styles.rowTitle}>
                                    {aiExpanding ? `Generating "${aiExpanding}"…` : `Expand "${trimmed}" with AI`}
                                </span>
                                <span className={styles.rowMeta}>Groq-generated concepts, for ideas Wikipedia won&apos;t have</span>
                            </button>
                            <button className={styles.row} onClick={() => openChat(`Explain: ${trimmed}`)}>
                                <span className={styles.rowTitle}>Ask AI to explain &ldquo;{trimmed}&rdquo;</span>
                                <span className={styles.rowMeta}>opens the chat panel</span>
                            </button>
                        </div>
                    )}

                    {!trimmed && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>Quick actions</div>
                            <button className={styles.row} onClick={() => openChat()}>
                                <span className={styles.rowTitle}>Open AI chat</span>
                            </button>
                        </div>
                    )}

                    {!trimmed && recentSearches.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>Recent searches</div>
                            {recentSearches.map((term) => (
                                <button key={term} className={styles.row} onClick={() => setInput(term)}>
                                    <span className={styles.rowTitle}>{term}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
