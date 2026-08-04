"use client";

import styles from "./Dock.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

export default function Dock() {

    const { chatOpen, debateModeOpen } = useEngineState();

    const focusSearch = () => {
        const el = document.querySelector<HTMLInputElement>('[data-neura-search]');
        el?.focus();
    };

    return (
        <div className={styles.dock}>
            <button className={styles.item} onClick={focusSearch} title="Search">
                <span className={styles.glyph}>◎</span>
                <span className={styles.label}>Search</span>
            </button>

            <button
                className={styles.item}
                onClick={() => engineStore.toggleCommandPalette(true)}
                title="Command palette"
            >
                <span className={styles.glyph}>⌘</span>
                <span className={styles.label}>Commands</span>
                <span className={styles.shortcut}>⌘K</span>
            </button>

            <button
                className={`${styles.item} ${chatOpen ? styles.active : ""}`}
                onClick={() => engineStore.toggleChat()}
                title="AI chat"
            >
                <span className={styles.glyph}>✦</span>
                <span className={styles.label}>Ask AI</span>
            </button>

            <button
                className={`${styles.item} ${debateModeOpen ? styles.active : ""}`}
                onClick={() => engineStore.toggleDebateMode()}
                title="Debate Mode — two AIs argue a topic live"
            >
                <svg className={styles.glyphSvg} width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M3 5.5C3 4.67 3.67 4 4.5 4H11a1 1 0 011 1v7a1 1 0 01-1 1H7.8L4.4 15.8A.6.6 0 013.5 15.3V13H4.5A1.5 1.5 0 013 11.5V5.5z"
                        fill="#ff2fb0"
                        fillOpacity="0.85"
                    />
                    <path
                        d="M21 8.5c0-.83-.67-1.5-1.5-1.5H13a1 1 0 00-1 1v7a1 1 0 001 1h3.2l3.4 2.8a.6.6 0 00.9-.5V16h.5c.83 0 1.5-.67 1.5-1.5V8.5z"
                        fill="#16e0ff"
                        fillOpacity="0.85"
                    />
                </svg>
                <span className={styles.label}>Debate</span>
            </button>
        </div>
    );
}
