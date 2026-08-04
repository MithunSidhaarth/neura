// Transient (non-reactive) flag so a camera drag doesn't also fire a
// neuron selection when the pointer happens to release over a picking
// point. This is intentionally kept outside EngineStore: it can mutate
// many times within a single frame during a drag and has no reason to
// trigger a React re-render each time.
let dragging = false;
let movedPastThreshold = false;

export const cameraDragState = {
    start() {
        dragging = true;
        movedPastThreshold = false;
    },
    markMoved() {
        movedPastThreshold = true;
    },
    end() {
        dragging = false;
    },
    get isDragging() {
        return dragging;
    },
    // Click handlers call this to decide whether a click is a real
    // selection or just the tail end of a camera drag. Reading it resets
    // the flag so it only ever swallows the one click right after a drag.
    consumeWasDrag(): boolean {
        const was = movedPastThreshold;
        movedPastThreshold = false;
        return was;
    },
};
