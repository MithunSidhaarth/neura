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
    | "shared_topic"
    // A claim/rebuttal pair from "Debate with AI" -- rendered distinctly
    // (crackling two-tone edge) rather than as an ordinary relation,
    // since it represents disagreement rather than affinity.
    | "conflict"
    // Links two neurons on the *same* side of a "Debate with AI" (two
    // claims, or two rebuttals) -- rendered as a steady edge tinted in
    // that side's stance color, so all claims read as one interlinked
    // pink cluster and all rebuttals as one interlinked cyan cluster,
    // distinct from the crackling "conflict" edge between opposing sides.
    | "allied";

// Present on claim/rebuttal neurons created by "Debate with AI"
// (EngineStore.debateTopic). Lets the renderer tint each side of a
// debate its own color without the scene layer needing to know
// anything about debates -- it just reads `stance.color`.
export interface NeuronStance {
    agent: "claim" | "rebuttal";
    color: string;
}

export interface Neuron {
    id: string;
    title: string;
    type: NeuronType;
    domain: string; // top-level cluster this neuron belongs to
    tags: string[];
    description: string;
    year?: number;
    stance?: NeuronStance;
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
