// Core data model for the Neura graph.
//
// This is intentionally content-agnostic: it does not assume any specific
// person's projects, employers, or history. The sample dataset in
// `sampleData.ts` is seeded with generic/technical concepts (plus the
// Neura project describing itself) so the engine has something real to
// render and search, without inventing biographical claims. Swap
// `sampleData.ts` for real ingested content once there's a source for it.

export type NeuronType =
    | "domain"
    | "category"
    | "concept"
    | "technology"
    | "project"
    | "paper"
    | "skill"
    | "note"
    | "idea";

export type ConnectionType =
    | "parent"
    | "prerequisite"
    | "similarity"
    | "reference"
    | "citation"
    | "shared_technology"
    | "shared_topic";

export interface Neuron {
    id: string;
    title: string;
    type: NeuronType;
    domain: string; // top-level cluster this neuron belongs to
    tags: string[];
    description: string;
    year?: number;
    // Present when this neuron was created at runtime rather than from
    // the hand-written seed dataset: "wiki" for a live Wikipedia lookup,
    // "ai" for a Groq-generated concept (used when Wikipedia has no
    // article for the topic, or for topics that aren't encyclopedic —
    // project ideas, business concepts, notes). Lets the store know it
    // can fetch this neuron's own related topics on demand instead of
    // re-fetching seed neurons that already have their real connections.
    origin?: "wiki" | "ai";
    wikiTitle?: string;
}

export interface GraphConnection {
    from: string;
    to: string;
    type: ConnectionType;
    // 0..1 — how strongly the two neurons relate. Drives line brightness
    // and how far a search/selection signal propagates.
    weight: number;
}

export interface GraphData {
    neurons: Neuron[];
    connections: GraphConnection[];
}
