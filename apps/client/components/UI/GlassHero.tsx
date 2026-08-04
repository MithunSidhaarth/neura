"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./GlassHero.module.css";
import SearchBar from "./SearchBar";
import InfoPanel from "./InfoPanel";
import { useEngineState } from "@/engine/store/EngineStore";

export default function GlassHero() {

    const [visible, setVisible] = useState(false);
    const { selectedId, debateModeOpen } = useEngineState();

    useEffect(() => {
        // Let the universe wake up first, then let the interface fade in —
        // matches the brief's "silence, then things begin waking" narrative.
        const timer = setTimeout(() => setVisible(true), 1400);
        return () => clearTimeout(timer);
    }, []);

    // Debate Mode is a full-screen takeover of its own (see DebateSky) --
    // step the search bar / wordmark / InfoPanel aside entirely rather
    // than risk them colliding with it.
    if (debateModeOpen) return null;

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
                    <div className={styles.pageLinks}>
                        <Link href="/about" className={styles.credit}>
                            About &amp; features
                        </Link>
                        <span className={styles.pageLinksDot}>·</span>
                        <Link href="/contact" className={styles.credit}>
                            Contact
                        </Link>
                    </div>
                </div>
            </div>

            <InfoPanel />
        </>
    );

}
