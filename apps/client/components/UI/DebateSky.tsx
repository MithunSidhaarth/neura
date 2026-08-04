"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DebateSky.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

// Debate Mode: a full-screen takeover (GlassHero/SearchBar/Breadcrumb/
// InfoPanel all step aside the moment this opens -- see their
// `debateModeOpen` guards) rather than another panel fighting the rest
// of the UI for space. FOR holds the left half, AGAINST holds the right
// half, split by a soft vertical beam down the middle. Both sides run
// on Groq (two different models -- see route.ts), not two providers.
// Lines settle in once and stay in the DOM -- older ones simply scroll
// out of a fixed-height, overflow-hidden column instead of being
// unmounted/resliced, so nothing pops or jumps as the transcript grows.
export default function DebateSky() {

    const { debateModeOpen, debateModeTopic, debateModeLog, debateModeRunning, debateModeError } = useEngineState();
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (debateModeOpen && debateModeLog.length === 0) inputRef.current?.focus();
    }, [debateModeOpen, debateModeLog.length]);

    if (!debateModeOpen) return null;

    const start = () => {
        const topic = input.trim();
        if (!topic) return;
        setInput("");
        engineStore.startDebateMode(topic);
    };

    const forTurns = debateModeLog.filter((t) => t.agent === "for");
    const againstTurns = debateModeLog.filter((t) => t.agent === "against");
    const hasStarted = debateModeLog.length > 0 || debateModeRunning;
    const nextAgent: "for" | "against" = debateModeLog.length % 2 === 0 ? "for" : "against";

    return (
        <div className={styles.stage}>
            <div className={styles.vignette} />

            {hasStarted && (
                <>
                    <div className={styles.beam} />
                    <div className={`${styles.pulseOrb} ${nextAgent === "for" ? styles.pulseOrbFor : styles.pulseOrbAgainst} ${debateModeRunning ? styles.pulseOrbActive : ""}`} />
                </>
            )}

            {/* Left half: FOR */}
            <div className={styles.columnFor}>
                <div className={styles.columnInner}>
                    {forTurns.map((t, i) => (
                        <p key={`for-${i}`} className={styles.lineFor}>
                            <span className={styles.tag}>For</span>
                            {t.text}
                        </p>
                    ))}
                    {debateModeRunning && nextAgent === "for" && (
                        <p className={`${styles.lineFor} ${styles.pending}`}>
                            <span className={styles.tag}>For</span>
                            <span className={styles.typing}><span /><span /><span /></span>
                        </p>
                    )}
                </div>
            </div>

            {/* Right half: AGAINST */}
            <div className={styles.columnAgainst}>
                <div className={styles.columnInner}>
                    {againstTurns.map((t, i) => (
                        <p key={`against-${i}`} className={styles.lineAgainst}>
                            <span className={styles.tag}>Against</span>
                            {t.text}
                        </p>
                    ))}
                    {debateModeRunning && nextAgent === "against" && (
                        <p className={`${styles.lineAgainst} ${styles.pending}`}>
                            <span className={styles.tag}>Against</span>
                            <span className={styles.typing}><span /><span /><span /></span>
                        </p>
                    )}
                </div>
            </div>

            {/* The only "chrome" -- everything else is text loose in the sky. */}
            {!hasStarted ? (
                <div className={styles.centerCard}>
                    <div className={styles.centerEyebrow}>Debate Mode</div>
                    <div className={styles.centerTitle}>Give two AIs something to argue about.</div>
                    <div className={styles.starter}>
                        <input
                            ref={inputRef}
                            className={styles.input}
                            value={input}
                            placeholder="A topic…"
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") start();
                            }}
                        />
                        <button className={styles.go} onClick={start} disabled={!input.trim()}>
                            Begin
                        </button>
                    </div>
                    <div className={styles.centerLegend}>
                        <span className={styles.legendFor}>Groq argues for</span>
                        <span className={styles.legendVs}>vs</span>
                        <span className={styles.legendAgainst}>Groq argues against</span>
                    </div>
                </div>
            ) : (
                <div className={styles.hud}>
                    <span className={styles.sideTag}>For</span>
                    <span className={styles.topicText}>{debateModeTopic}</span>
                    <span className={styles.sideTagAgainst}>Against</span>
                    {debateModeRunning ? (
                        <button className={styles.stop} onClick={() => engineStore.stopDebateMode()}>Stop</button>
                    ) : (
                        <button className={styles.stop} onClick={() => engineStore.startDebateMode(debateModeTopic)}>Again</button>
                    )}
                </div>
            )}

            <button className={styles.exit} onClick={() => engineStore.toggleDebateMode(false)} title="Exit debate mode">✕</button>

            {debateModeError && <div className={styles.error}>{debateModeError}</div>}
        </div>
    );
}
