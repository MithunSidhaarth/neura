"use client";

import { useEffect, useRef } from "react";
import styles from "./Cursor.module.css";

// Replaces the OS pointer everywhere in the app (not just over the R3F
// canvas, which already hid it for its own shader-driven glow) with a
// small neuron-like ring + core, matching the graph's own visual
// language instead of a generic arrow. Driven by direct style writes on
// refs rather than React state so it can track the pointer at native
// event rate with zero re-renders.
export default function Cursor() {

    const ringRef = useRef<HTMLDivElement>(null);
    const dotRef = useRef<HTMLDivElement>(null);

    useEffect(() => {

        if (window.matchMedia("(pointer: coarse)").matches) return; // touch devices: leave native behavior alone

        let ringX = window.innerWidth / 2;
        let ringY = window.innerHeight / 2;
        let targetX = ringX;
        let targetY = ringY;

        const move = (e: PointerEvent) => {
            targetX = e.clientX;
            targetY = e.clientY;

            if (dotRef.current) {
                dotRef.current.style.transform =
                    `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;
            }

            const target = e.target as HTMLElement | null;
            const hoverable = target?.closest(
                'button, a, input, [data-cursor="hover"]'
            );
            ringRef.current?.classList.toggle(styles.hover, !!hoverable);
        };

        const down = () => ringRef.current?.classList.add(styles.active);
        const up = () => ringRef.current?.classList.remove(styles.active);

        // The ring trails slightly behind the dot -- a small eased follow
        // gives the cursor weight, echoing the field's own drifting/
        // breathing motion instead of feeling like a flat OS overlay.
        let raf: number;
        const tick = () => {
            ringX += (targetX - ringX) * 0.18;
            ringY += (targetY - ringY) * 0.18;
            if (ringRef.current) {
                ringRef.current.style.transform =
                    `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerdown", down);
        window.addEventListener("pointerup", up);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerdown", down);
            window.removeEventListener("pointerup", up);
        };

    }, []);

    return (
        <>
            <div ref={ringRef} className={styles.ring} />
            <div ref={dotRef} className={styles.dot} />
        </>
    );
}
