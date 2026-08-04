"use client";

import styles from "./Breadcrumb.module.css";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";

// Trail of the last few neurons visited this session, so the graph feels
// walkable rather than a series of disconnected jumps -- click any crumb
// to go back to it. Session-only (kept in the store, not persisted);
// visit counts (which do persist) are a separate concept.
export default function Breadcrumb() {

    const { history, selectedId } = useEngineState();

    if (history.length < 2) return null;

    return (
        <div className={styles.wrapper}>
            {history.map((id, i) => {
                const node = engineStore.graph.byId.get(id);
                if (!node) return null;
                const isLast = id === selectedId;
                return (
                    <span key={id} className={styles.crumbGroup}>
                        <button
                            className={`${styles.crumb} ${isLast ? styles.current : ""}`}
                            onClick={() => engineStore.select(id)}
                            disabled={isLast}
                        >
                            {node.neuron.title}
                        </button>
                        {i < history.length - 1 && <span className={styles.sep}>›</span>}
                    </span>
                );
            })}
        </div>
    );
}
