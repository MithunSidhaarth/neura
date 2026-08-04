import type { Metadata } from "next";
import Link from "next/link";
import styles from "./contact.module.css";

export const metadata: Metadata = {
    title: "Contact — NEURA",
    description: "Get in touch with the developer of NEURA.",
};

// The two profiles below are confirmed by name/handle match. Everything
// else (email, Instagram, Telegram, ResearchGate, blog) is only linked
// through the portfolio site itself -- see the note at the bottom of
// this file for why, and swap in direct links here once confirmed.
const CHANNELS: { glyph: string; label: string; handle: string; href: string }[] = [
    {
        glyph: "in",
        label: "LinkedIn",
        handle: "Mithun Sidhaarth AM",
        href: "https://www.linkedin.com/in/mithunsidhaarth/",
    },
    {
        glyph: "🐙",
        label: "GitHub",
        handle: "@MithunSidhaarth",
        href: "https://github.com/MithunSidhaarth",
    },
];

export default function ContactPage() {
    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <Link href="/" className={styles.backLink}>
                    ← Back to the graph
                </Link>

                <div className={styles.eyebrow}>CONTACT</div>
                <h1 className={styles.title}>Get in touch.</h1>
                <p className={styles.subtitle}>
                    Questions about Neura, a bug to report, or just want to talk about the
                    build — here's how to reach the developer.
                </p>

                <div className={styles.primaryCard}>
                    <div className={styles.primaryCardText}>
                        <div className={styles.primaryCardTitle}>Mithun Sidhaarth</div>
                        <p className={styles.primaryCardBody}>
                            Full portfolio, email, and every other channel (Instagram, Telegram,
                            blog, research) live here.
                        </p>
                    </div>
                    <a
                        href="https://mithunsidhaarth.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.primaryCardLink}
                    >
                        mithunsidhaarth.in →
                    </a>
                </div>

                <div className={styles.channels}>
                    {CHANNELS.map((c) => (
                        <a
                            key={c.label}
                            href={c.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.channel}
                        >
                            <span className={styles.channelGlyph}>{c.glyph}</span>
                            <span className={styles.channelText}>
                                <span className={styles.channelLabel}>{c.label}</span>
                                <span className={styles.channelHandle}>{c.handle}</span>
                            </span>
                        </a>
                    ))}
                </div>

                <p className={styles.note}>
                    Email, Instagram, Telegram, and research links aren't listed directly here
                    yet — the portfolio site renders them client-side, so they couldn't be
                    read and verified automatically. Send over the exact handles/URLs and
                    they can be added as their own buttons above.
                </p>
            </div>
        </div>
    );
}
