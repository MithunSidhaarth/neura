// Lightweight cross-component signal bus: NeuralConnections detects when a
// traveling pulse (see NeuralConnections.tsx's `signal`/`travel` shader
// math, mirrored here in JS) reaches a neuron, and bumps that neuron's
// arrival intensity here. ParticleField reads it back each frame to
// brighten the node it just arrived at, decaying it back to zero shortly
// after -- this is what makes signals feel like they're actually landing
// somewhere, rather than just sliding along a line and disappearing.
//
// A plain module-level Map rather than engine store state: this updates
// every frame for potentially hundreds of neurons, which is exactly the
// kind of high-frequency, non-React-relevant data useSyncExternalStore
// isn't meant for.

const arrivals = new Map<string, number>();

// How quickly an arrival flash fades, per second of decay applied.
const DECAY_PER_SECOND = 4.5;

export function pulseArrive(neuronId: string, amount: number) {
    const current = arrivals.get(neuronId) ?? 0;
    // Bump rather than overwrite -- if two signals land on the same neuron
    // in the same frame (a hub with many edges), it should flash brighter,
    // not just reset to `amount`.
    arrivals.set(neuronId, Math.min(1, current + amount));
}

export function getPulse(neuronId: string): number {
    return arrivals.get(neuronId) ?? 0;
}

// Called once per frame (from NeuralConnections, which is the single
// source of truth for pulse timing) to decay every tracked arrival.
export function decayPulses(delta: number) {
    const falloff = Math.exp(-DECAY_PER_SECOND * delta);
    arrivals.forEach((value, id) => {
        const next = value * falloff;
        if (next < 0.01) {
            arrivals.delete(id);
        } else {
            arrivals.set(id, next);
        }
    });
}
