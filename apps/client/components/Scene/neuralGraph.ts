import * as THREE from "three";
import { engineStore } from "@/engine/store/EngineStore";
import { PositionedConnection, PositionedNeuron } from "@/lib/graph/layout";

// Single source of truth for the "neuron cluster" layout that both
// ParticleField (the dust/nodes) and NeuralConnections (the links between
// them) draw from. Keeping this in one place is what keeps the two layers
// visually locked together as the field breathes and rotates.
//
// The graph is no longer static: EngineStore.expandTopic() grows it live
// from Wikipedia as the person searches and traverses, so this is
// recomputed by version rather than cached forever -- see
// EngineState.graphVersion. Consumers pass that version in their own
// useMemo deps so R3F rebuilds its buffers when the graph grows.

export type NeuralClusterNode = {
    position: THREE.Vector3;
    id: string;
    title: string;
    neuronType: string;
    domain: string;
};

export type NeuralConnectionEdge = {
    a: THREE.Vector3;
    b: THREE.Vector3;
    length: number;
    phase: number;
    speed: number;
    delay: number;
    fromId: string;
    toId: string;
    weight: number;
};

// Total time (seconds) it takes the connection graph to fully "grow in"
// after mount, staggered per-connection.
export const GROWTH_DURATION = 5.5;

const MAX_RADIUS = 34; // used to normalize growth delay by distance from origin

function toClusterNode(p: PositionedNeuron): NeuralClusterNode {
    return {
        position: p.position,
        id: p.neuron.id,
        title: p.neuron.title,
        neuronType: p.neuron.type,
        domain: p.neuron.domain,
    };
}

function toConnectionEdge(c: PositionedConnection): NeuralConnectionEdge {
    const a = c.from.position;
    const b = c.to.position;
    const length = a.distanceTo(b);
    return {
        a,
        b,
        length,
        phase: hashToUnit(c.from.neuron.id + c.to.neuron.id) * Math.PI * 2,
        speed: 0.12 + hashToUnit(c.to.neuron.id + c.from.neuron.id) * 0.28,
        delay:
            (Math.min(a.length(), b.length()) / MAX_RADIUS) * GROWTH_DURATION * 0.7 +
            hashToUnit(c.from.neuron.id + "|" + c.to.neuron.id) * 0.8,
        fromId: c.from.neuron.id,
        toId: c.to.neuron.id,
        weight: c.weight,
    };
}

function hashToUnit(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h % 10000) / 10000;
}

// Recomputed each call -- cheap (a few hundred nodes at most) and always
// in sync with the live-growing graph. Components that need this to
// trigger a GPU buffer rebuild should call it inside a useMemo keyed on
// `useEngineState().graphVersion`, not on mount only.
export function getNeuralGraph() {
    const { nodes, connections } = engineStore.graph;
    return {
        clusters: nodes.map(toClusterNode),
        connections: connections.map(toConnectionEdge),
    };
}
