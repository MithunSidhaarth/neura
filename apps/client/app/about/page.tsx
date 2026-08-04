import type { Metadata } from "next";
import Link from "next/link";
import styles from "./about.module.css";

export const metadata: Metadata = {
    title: "About — NEURA",
    description: "What NEURA is, the features inside it, and how it was built.",
};

const FEATURES: { glyph: string; title: string; body: string }[] = [
    {
        glyph: "◎",
        title: "Living 3D knowledge graph",
        body: "A full Three.js universe — nebula, dust, aurora and starfield layers, shader-driven neuron materials, and a custom camera rig — built on react-three-fiber rather than a flat node/edge diagram.",
    },
    {
        glyph: "🌐",
        title: "Wikipedia-powered expansion",
        body: "Click any idea to pull in the real Wikipedia article graph around it, turning encyclopedic topics into connected, explorable neurons.",
    },
    {
        glyph: "✦",
        title: "AI graph expansion",
        body: "When Wikipedia has nothing for a topic — a niche idea, a made-up concept, plain jargon — an LLM invents a handful of related concepts and weighted connections on demand.",
    },
    {
        glyph: "💬",
        title: "AI chat panel",
        body: "A conversational panel that's aware of whichever neuron is currently selected, so questions can stay grounded in the part of the graph you're looking at.",
    },
    {
        glyph: "📝",
        title: "AI topic explanation",
        body: "One click fills in a thin or empty neuron's description — useful for AI-generated concepts that only shipped with a title.",
    },
    {
        glyph: "⚔",
        title: "Expand topic with AI",
        body: "Generates 3-4 claims about a topic and has a second model rebut each one directly, dropping every claim/rebuttal pair onto the graph as a mirrored, color-coded, linked cluster.",
    },
    {
        glyph: "🎙",
        title: "Live Debate Mode",
        body: "A full-screen takeover where two AI agents argue a topic live, turn by turn, each one reading the transcript so far and rebutting the other's weakest point.",
    },
    {
        glyph: "⌘",
        title: "Command palette",
        body: "⌘K opens a keyboard-first way to jump to a neuron, pull in a new Wikipedia topic, or ask the AI to expand one — without touching the graph directly.",
    },
    {
        glyph: "🔍",
        title: "Search, context menu & picking",
        body: "A live search bar, a right-click context menu on any neuron, and a dedicated picking layer so hovering and selecting nodes in 3D space feels precise, not fiddly.",
    },
    {
        glyph: "🎥",
        title: "Around the web & videos",
        body: "Contextual live web and video results for the selected neuron, pulled from Tavily's search API rather than a static link-out.",
    },
];

const STACK = [
    "Next.js 16 (App Router)",
    "React 19",
    "TypeScript",
    "Three.js",
    "@react-three/fiber",
    "@react-three/postprocessing",
    "Tailwind CSS 4",
    "Groq (Llama 3.3 70B + Llama 3.1 8B)",
    "Wikipedia REST API",
    "Tavily Search API",
];

export default function AboutPage() {
    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <Link href="/" className={styles.backLink}>
                    ← Back to the graph
                </Link>

                <div className={styles.hero}>
                    <div className={styles.eyebrow}>NEURA</div>
                    <h1 className={styles.heroTitle}>An operating system for intelligence.</h1>
                    <p className={styles.heroSubtitle}>
                        Neura is an infinite, living knowledge graph — part encyclopedia, part
                        AI collaborator, rendered as a 3D universe you fly through rather than
                        a page you scroll. This page walks through what it can do, what it's
                        built with, and what went into building it.
                    </p>
                </div>

                <section className={styles.section}>
                    <div className={styles.sectionLabel}>FEATURES</div>
                    <h2 className={styles.sectionTitle}>Everything inside the graph</h2>
                    <p className={styles.sectionIntro}>
                        Every feature below is live in the app right now — nothing here is a
                        roadmap item.
                    </p>
                    <div className={styles.grid}>
                        {FEATURES.map((f) => (
                            <div className={styles.card} key={f.title}>
                                <span className={styles.cardGlyph}>{f.glyph}</span>
                                <h3 className={styles.cardTitle}>{f.title}</h3>
                                <p className={styles.cardBody}>{f.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionLabel}>THE BUILD</div>
                    <h2 className={styles.sectionTitle}>By the numbers</h2>
                    <p className={styles.sectionIntro}>
                        Counted straight from the repository — not rounded up for effect.
                    </p>
                    <div className={styles.statsStrip}>
                        <div className={styles.stat}>
                            {/* TODO: swap in the real build time -- this is the one number
                                here that can't be counted from the repo itself. */}
                            <div className={styles.statValue}>—</div>
                            <div className={styles.statLabel}>Time to build</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statValue}>27</div>
                            <div className={styles.statLabel}>React components</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statValue}>73</div>
                            <div className={styles.statLabel}>TypeScript files</div>
                        </div>
                        <div className={styles.stat}>
                            <div className={styles.statValue}>~7,200</div>
                            <div className={styles.statLabel}>Lines of code</div>
                        </div>
                    </div>
                    <div className={styles.statsNote}>Solo build — one developer, start to finish.</div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionLabel}>STACK</div>
                    <h2 className={styles.sectionTitle}>What it's built with</h2>
                    <div className={styles.stackList}>
                        {STACK.map((s) => (
                            <span className={styles.stackChip} key={s}>
                                {s}
                            </span>
                        ))}
                    </div>
                </section>

                <div className={styles.footer}>
                    <div className={styles.footerText}>Have questions, feedback, or a bug to report?</div>
                    <Link href="/contact" className={styles.footerLink}>
                        Get in touch →
                    </Link>
                </div>
            </div>
        </div>
    );
}
