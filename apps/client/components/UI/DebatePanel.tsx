"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DebatePanel.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

// "Debate Mode": the dock's live counterpart to the per-neuron "Debate
// with AI" action. Two agents -- Groq arguing FOR the topic, Gemini
// arguing AGAINST it -- take turns in an open transcript instead of a
// one-shot batch of claim/rebuttal pairs. The panel itself leans into
// the two-color language (pink/cyan) that `debateTopic()` already uses
// for claim/rebuttal neurons; NebulaLayer/AuroraLayer pick up the same
// two colors and pulse the whole scene with whichever side just spoke,
// so the debate reads as something happening to the sky, not just in a
// chat box.
export default function DebatePanel() {

    const { debateModeOpen, debateModeTopic, debateModeLog, debateModeRunning, debateModeError } = useEngineState();
    const [input, setInput] = useState("");
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [debateModeLog, debateModeRunning]);

    if (!debateModeOpen) return null;

    const start = () => {
        const topic = input.trim();
        if (!topic) return;
        engineStore.startDebateMode(topic);
    };

    const hasLog = debateModeLog.length > 0;
    const nextAgent: "for" | "against" = debateModeLog.length % 2 === 0 ? "for" : "against";

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.title}>Debate Mode</span>
                <div className={styles.headerActions}>
                    {debateModeRunning && (
                        <button className={styles.iconBtn} onClick={() => engineStore.stopDebateMode()} title="Stop debate">
                            ◼
                        </button>
                    )}
                    <button className={styles.iconBtn} onClick={() => engineStore.toggleDebateMode(false)} title="Close">
                        ✕
                    </button>
                </div>
            </div>

            <div className={styles.legend}>
                <span className={styles.legendFor}>● FOR — Groq</span>
                <span className={styles.legendAgainst}>● AGAINST — Gemini</span>
            </div>

            {!hasLog && !debateModeRunning ? (
                <div className={styles.starter}>
                    <div className={styles.empty}>
                        Give two AIs a topic and let them argue it out, live -- one for, one against.
                    </div>
                    <div className={styles.inputRow}>
                        <input
                            className={styles.input}
                            value={input}
                            placeholder="A topic to debate…"
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") start();
                            }}
                            autoFocus
                        />
                        <button className={styles.sendBtn} onClick={start} disabled={!input.trim()}>
                            Start
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className={styles.topicBar}>{debateModeTopic}</div>
                    <div className={styles.messages} ref={listRef}>
                        {debateModeLog.map((turn, i) => (
                            <div
                                key={i}
                                className={turn.agent === "for" ? styles.bubbleFor : styles.bubbleAgainst}
                            >
                                <span className={styles.bubbleTag}>{turn.agent === "for" ? "FOR" : "AGAINST"}</span>
                                {turn.text}
                            </div>
                        ))}
                        {debateModeRunning && (
                            <div className={nextAgent === "for" ? styles.bubbleFor : styles.bubbleAgainst}>
                                <span className={styles.bubbleTag}>{nextAgent === "for" ? "FOR" : "AGAINST"}</span>
                                <span className={styles.typing}>
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </div>
                        )}
                        {debateModeError && <div className={styles.error}>{debateModeError}</div>}
                    </div>
                    {!debateModeRunning && (
                        <div className={styles.inputRow}>
                            <input
                                className={styles.input}
                                value={input}
                                placeholder="Debate another topic…"
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") start();
                                }}
                            />
                            <button className={styles.sendBtn} onClick={start} disabled={!input.trim()}>
                                Start
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
