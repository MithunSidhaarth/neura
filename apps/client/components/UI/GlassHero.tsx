"use client";

import { useEffect, useState } from "react";
import styles from "./GlassHero.module.css";
import SearchBar from "./SearchBar";
import InfoPanel from "./InfoPanel";
import { useEngineState } from "@/engine/store/EngineStore";

export default function GlassHero() {

    const [visible, setVisible] = useState(false);
    const { selectedId } = useEngineState();

    useEffect(() => {
        // Let the universe wake up first, then let the interface fade in —
        // matches the brief's "silence, then things begin waking" narrative.
        const timer = setTimeout(() => setVisible(true), 1400);
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <SearchBar />

            {/* The wordmark intro steps aside once a neuron is selected so
                it doesn't collide with the InfoPanel describing that neuron. */}
            <div className={styles.wrapper}>
                <div
                    className={`${styles.panel} ${visible && !selectedId ? styles.visible : ""}`}
                >
                    <div className={styles.eyebrow}>NEURA</div>
                    <div className={styles.title}>An operating system for intelligence.</div>
                    <a
                        href="https://mithunsidhaarth.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.credit}
                    >
                        Developed by Mithun Sidhaarth
                    </a>
                </div>
            </div>

            <InfoPanel />
        </>
    );

}
