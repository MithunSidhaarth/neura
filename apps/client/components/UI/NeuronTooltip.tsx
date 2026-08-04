"use client";

import { useEffect, useRef } from "react";
import styles from "./NeuronTooltip.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

// A small label that follows the cursor whenever a neuron is hovered --
// naming what's under the pointer without requiring a click first, the
// way hovering a star in a real sky-map app would. Pure DOM/CSS (not
// part of the R3F canvas) so it sits crisply on top of the scene's bloom
// instead of getting composited into the post-processing pass.
//
// Position is written directly to the DOM on every pointermove (same
// pattern as Cursor.tsx) so it tracks the cursor at native event rate
// without a React re-render per frame; only the *content* -- which
// neuron, if any -- is React state, driven by `hoveredId` (set from
// PickingLayer's raycast hover).
export default function NeuronTooltip() {

    const { hoveredId } = useEngineState();
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const move = (e: PointerEvent) => {
            if (!wrapRef.current) return;
            wrapRef.current.style.transform = `translate3d(${e.clientX + 20}px, ${e.clientY - 16}px, 0)`;
        };
        window.addEventListener("pointermove", move);
        return () => window.removeEventListener("pointermove", move);
    }, []);

    const node = hoveredId ? engineStore.graph.byId.get(hoveredId) : undefined;

    return (
        <div ref={wrapRef} className={`${styles.tooltip} ${node ? styles.visible : ""}`} aria-hidden="true">
            {node && (
                <>
                    <span className={styles.type}>
                        {node.neuron.origin === "wiki"
                            ? "wikipedia"
                            : node.neuron.origin === "ai"
                            ? "ai-generated"
                            : node.neuron.type}
                    </span>
                    <span className={styles.title}>{node.neuron.title}</span>
                </>
            )}
        </div>
    );
}
