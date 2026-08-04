"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ChatPanel.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

// The "AI chat panel" from the vision doc. Talks to /api/ai (mode: "chat"),
// which forwards to Groq server-side. When a neuron is selected, its
// title/type/description is sent along as context so answers can be
// grounded in whatever the user is currently looking at -- but this is a
// general-purpose chat, not locked to the selection.
export default function ChatPanel() {

    const { chatOpen, chatMessages, chatLoading, chatError, selectedId } = useEngineState();
    const [input, setInput] = useState("");
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [chatMessages, chatLoading]);

    if (!chatOpen) return null;

    const send = () => {
        const text = input.trim();
        if (!text) return;
        setInput("");
        engineStore.sendChatMessage(text);
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.title}>Ask Neura</span>
                <div className={styles.headerActions}>
                    {chatMessages.length > 0 && (
                        <button className={styles.iconBtn} onClick={() => engineStore.clearChat()} title="Clear chat">
                            ↺
                        </button>
                    )}
                    <button className={styles.iconBtn} onClick={() => engineStore.toggleChat(false)} title="Close">
                        ✕
                    </button>
                </div>
            </div>

            {selectedId && (
                <div className={styles.contextHint}>
                    Grounded on the selected neuron — ask about it, or anything else.
                </div>
            )}

            <div className={styles.messages} ref={listRef}>
                {chatMessages.length === 0 && !chatLoading && (
                    <div className={styles.empty}>
                        Ask about the graph, a selected neuron, or anything you&apos;re exploring.
                    </div>
                )}
                {chatMessages.map((m, i) => (
                    <div key={i} className={m.role === "user" ? styles.bubbleUser : styles.bubbleAi}>
                        {m.content}
                    </div>
                ))}
                {chatLoading && (
                    <div className={styles.bubbleAi}>
                        <span className={styles.typing}>
                            <span />
                            <span />
                            <span />
                        </span>
                    </div>
                )}
                {chatError && <div className={styles.error}>{chatError}</div>}
            </div>

            <div className={styles.inputRow}>
                <input
                    className={styles.input}
                    value={input}
                    placeholder="Ask something…"
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") send();
                    }}
                />
                <button className={styles.sendBtn} onClick={send} disabled={!input.trim() || chatLoading}>
                    ↑
                </button>
            </div>
        </div>
    );
}
