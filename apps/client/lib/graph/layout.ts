import * as THREE from "three";
import { GraphData, Neuron } from "./types";

export interface PositionedNeuron {
    neuron: Neuron;
    position: THREE.Vector3;
}

export interface PositionedConnection {
    from: PositionedNeuron;
    to: PositionedNeuron;
    type: string;
    weight: number;
}

export interface LaidOutGraph {
    nodes: PositionedNeuron[];
    connections: PositionedConnection[];
    byId: Map<string, PositionedNeuron>;
}

const DOMAIN_RADIUS = 17; // how far a domain's cluster center sits from the origin
const SPREAD = 7.5; // how wide a domain cluster spreads

// Places each domain's center on a Fibonacci sphere (evenly distributed
// points over a full sphere surface, not just a flat ring) so the field
// reads as one uniform volume of clusters from every camera angle instead
// of a few flat clumps sitting near the equatorial plane. Each domain's
// neurons then scatter around that center, with "parent" connections
// nudging children slightly outward from their parent so hierarchy is
// faintly visible in the layout, not just the lines.
export function layoutGraph(data: GraphData): LaidOutGraph {

    const domains = Array.from(new Set(data.neurons.map((n) => n.domain)));

    const domainCenters = new Map<string, THREE.Vector3>();

    const n = Math.max(domains.length, 1);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    domains.forEach((domain, i) => {
        // Fibonacci sphere: y sweeps -1..1 evenly, angle advances by the
        // golden angle each step so points never line up into rings.
        const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
        const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * i;

        domainCenters.set(
            domain,
            new THREE.Vector3(
                Math.cos(theta) * radiusAtY * DOMAIN_RADIUS,
                y * DOMAIN_RADIUS * 0.7,
                Math.sin(theta) * radiusAtY * DOMAIN_RADIUS
            )
        );
    });

    const parentOf = new Map<string, string>();
    data.connections
        .filter((c) => c.type === "parent")
        .forEach((c) => parentOf.set(c.to, c.from));

    const byId = new Map<string, PositionedNeuron>();

    // First pass: seed every neuron with a deterministic pseudo-random
    // position inside its domain's cluster.
    data.neurons.forEach((neuron, i) => {
        const center = domainCenters.get(neuron.domain)!;
        const rand = mulberry32(hashString(neuron.id) + i);
        const jitter = () => (rand() + rand() + rand() - 1.5) / 1.5;

        const pos = new THREE.Vector3(
            center.x + jitter() * SPREAD,
            center.y + jitter() * SPREAD * 0.6,
            center.z + jitter() * SPREAD
        );

        byId.set(neuron.id, { neuron, position: pos });
    });

    // Second pass: pull children slightly toward + past their parent so
    // hierarchy chains read as radial fans rather than pure noise.
    data.neurons.forEach((neuron) => {
        const parentId = parentOf.get(neuron.id);
        if (!parentId) return;
        const parent = byId.get(parentId);
        const self = byId.get(neuron.id);
        if (!parent || !self) return;

        self.position.lerp(parent.position, -0.25); // push outward from parent
    });

    const connections: PositionedConnection[] = data.connections
        .map((c) => {
            const from = byId.get(c.from);
            const to = byId.get(c.to);
            if (!from || !to) return null;
            return { from, to, type: c.type, weight: c.weight };
        })
        .filter((c): c is PositionedConnection => c !== null);

    return {
        nodes: Array.from(byId.values()),
        connections,
        byId,
    };
}

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h << 5) - h + s.charCodeAt(i);
        h |= 0;
    }
    return h >>> 0;
}

// Small deterministic PRNG so layout is stable across reloads instead of
// reshuffling every time the page mounts.
function mulberry32(seed: number) {
    let a = seed;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
