"use client";

import styles from "./Dock.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

export default function Dock() {

    const { chatOpen } = useEngineState();

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
        </div>
    );
}
