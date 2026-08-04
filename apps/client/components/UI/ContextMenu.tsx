"use client";

import { useEffect } from "react";
import styles from "./ContextMenu.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

export default function ContextMenu() {

    const { contextMenu, aiExpanding } = useEngineState();

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => engineStore.closeContextMenu();
        window.addEventListener("click", close);
        window.addEventListener("scroll", close, true);
        return () => {
            window.removeEventListener("click", close);
            window.removeEventListener("scroll", close, true);
        };
    }, [contextMenu]);

    if (!contextMenu) return null;

    const node = engineStore.graph.byId.get(contextMenu.id);
    if (!node) return null;

    const { x, y, id } = contextMenu;

    return (
        <div className={styles.menu} style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.title}>{node.neuron.title}</div>
            <button className={styles.item} onClick={() => { engineStore.select(id); engineStore.closeContextMenu(); }}>
                Focus this neuron
            </button>
            <button
                className={styles.item}
                disabled={!!aiExpanding}
                onClick={() => { engineStore.aiExpandTopic(node.neuron.wikiTitle ?? node.neuron.title, id); engineStore.closeContextMenu(); }}
            >
                Search with AI
            </button>
            <button
                className={styles.item}
                onClick={() => {
                    engineStore.toggleChat(true);
                    engineStore.closeContextMenu();
                    setTimeout(() => engineStore.sendChatMessage(`Tell me more about ${node.neuron.title}.`), 50);
                }}
            >
                Ask AI about this
            </button>
            <button
                className={styles.item}
                onClick={() => { navigator.clipboard?.writeText(node.neuron.title); engineStore.closeContextMenu(); }}
            >
                Copy title
            </button>
        </div>
    );
}
