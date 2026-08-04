"use client";

import * as THREE from "three";
import { useSyncExternalStore } from "react";
import { LaidOutGraph, PositionedNeuron } from "@/lib/graph/layout";
import { Neuron, ConnectionType } from "@/lib/graph/types";
import { aiChat, aiDebate, aiDebateTurn, aiExpand, aiExplain, ChatMessage } from "@/lib/ai/client";

// Colors for "Debate with AI" claim/rebuttal neurons and their conflict
// edges -- module constants (not derived from anything) so the scene
// layer and the store agree on the palette without importing from each
// other.
const CLAIM_COLOR = "#ff2fb0";
const REBUTTAL_COLOR = "#16e0ff";

// Same palette, reused for live "Debate Mode" (see below) so the whole
// app has one consistent visual language for "the assertive side" vs
// "the opposing side" -- graph neurons, chat bubbles, and the scene glow
// all agree on what pink and cyan mean.
export const DEBATE_FOR_COLOR = CLAIM_COLOR;
export const DEBATE_AGAINST_COLOR = REBUTTAL_COLOR;

export interface DebateTurn {
    agent: "for" | "against";
    text: string;
}

// A small dependency-free store (no zustand/redux) so the engine has a
// single source of truth for "what's selected / searched / visited" that
// any component -- scene or UI -- can read and react to. Built on
// useSyncExternalStore, which is the React-native way to subscribe a
// component to state that lives outside React.
//
// This also now owns the "unlimited data" side of the vision doc: search
// any topic and it's pulled live from Wikipedia, turned into a real
// neuron, wired up to its actual related topics (also live, also real
// neurons), and dropped into the graph -- so the field keeps growing as
// you explore instead of being capped at the seed dataset. See
// `expandTopic` below.

export interface EngineState {
    selectedId: string | null;
    hoveredId: string | null;
    query: string;
    visitCounts: Record<string, number>;
    // Bumped every time the graph's nodes/connections change so R3F
    // components (which read the graph into GPU buffers via useMemo, not
    // React state) know to rebuild.
    graphVersion: number;
    // Wikipedia lookup in flight -- drives the search bar's loading state.
    expanding: string | null;
    expandError: string | null;

    // AI graph-expansion in flight (separate from `expanding` so the UI
    // can tell a Wikipedia fetch from a Groq generation).
    aiExpanding: string | null;
    aiExpandError: string | null;

    // AI explanation in flight, keyed by neuron id.
    explainingId: string | null;
    explainError: string | null;

    // "Debate with AI" generation in flight -- separate from aiExpanding
    // since they're triggered by different buttons and can be in flight
    // independently.
    debating: string | null;
    debateError: string | null;

    // Breadcrumb trail of the last few selected neurons, most recent last.
    history: string[];

    // Search queries the user has actually committed to (Enter / expand),
    // most recent first -- shown in the command palette.
    recentSearches: string[];

    // AI chat panel.
    chatOpen: boolean;
    chatMessages: ChatMessage[];
    chatLoading: boolean;
    chatError: string | null;

    commandPaletteOpen: boolean;

    // Right-click context menu on a neuron: null when closed.
    contextMenu: { id: string; x: number; y: number } | null;

    // "Debate Mode" -- toolbar mode where two AI agents (Groq's main
    // model arguing for the topic, a second Groq model arguing against
    // it) go back and forth live, turn by turn, rather than the one-shot
    // claim/rebuttal pairs `debateTopic()` drops onto the graph.
    debateModeOpen: boolean;
    debateModeTopic: string;
    debateModeLog: DebateTurn[];
    debateModeRunning: boolean;
    debateModeError: string | null;
    // Which side spoke most recently, and when (epoch ms) -- read every
    // frame by the nebula/aurora shaders to pulse the whole scene pink
    // or cyan as the debate swings, then fade back to the base palette.
    debateGlowSide: "for" | "against" | null;
    debateGlowAt: number;
}

const STORAGE_KEY = "neura.visitCounts";
const RECENT_KEY = "neura.recentSearches";
const MAX_HISTORY = 8;
const MAX_RECENT = 8;
const WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const WIKI_RELATED = "https://en.wikipedia.org/api/rest_v1/page/related/";
const MAX_RELATED = 6;

function loadVisitCounts(): Record<string, number> {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveVisitCounts(counts: Record<string, number>) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
    } catch {
        // localStorage unavailable (private mode, etc.) -- visit counts just
        // won't persist across reloads. Non-fatal.
    }
}

function loadRecentSearches(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveRecentSearches(list: string[]) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
        // non-fatal
    }
}

function wikiId(title: string): string {
    return "wiki:" + title.trim().toLowerCase().replace(/\s+/g, "_");
}

// ---- Keyword similarity (auto-interlinking) ----
//
// This is what makes two independently-searched topics (e.g. "AI" pulled
// in on its own, then "Machine Learning" pulled in separately later)
// actually get wired together instead of sitting as disconnected islands.
// Previously, a connection only formed when one topic's own expansion
// happened to surface the other by exact title (Wikipedia's "related
// pages" for that title, or a Groq-suggested concept) -- if it didn't,
// nothing ever linked them, no matter how related they obviously are.
//
// Every neuron that enters the graph now gets compared, by keyword
// overlap over its title/tags/domain/description, against every other
// neuron already in the graph, and the strongest matches are connected
// automatically as "shared_topic" edges. Cheap, local, no network call.

const STOPWORDS = new Set([
    "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "is", "are",
    "was", "were", "with", "by", "at", "as", "it", "its", "this", "that",
    "these", "those", "from", "into", "over", "about", "using", "use", "used",
    "based", "via", "can", "also", "such", "which", "one", "two", "new",
    "most", "more", "other", "than", "then", "been", "being", "has", "have",
    "had", "not", "but", "their", "his", "her", "they", "them", "some", "any",
    "all", "often", "may", "if", "when", "where", "how", "what", "who",
    "known", "called", "often", "typically", "generally", "including",
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Weighted keyword bag for a neuron: words from the title/tags count for
// more than words from the (often much longer) description, so two
// neurons that merely share a few incidental description words don't
// outrank neurons that actually share subject-matter words in their
// names.
function neuronKeywords(neuron: Neuron): Map<string, number> {
    const bag = new Map<string, number>();
    const bump = (words: string[], weight: number) => {
        words.forEach((w) => bag.set(w, (bag.get(w) ?? 0) + weight));
    };
    bump(tokenize(neuron.title), 4);
    neuron.tags.forEach((t) => bump(tokenize(t), 4));
    bump(tokenize(neuron.domain), 1);
    // Cap how much of the description feeds in -- past the first chunk
    // it's diminishing returns and just slows scoring down.
    bump(tokenize(neuron.description).slice(0, 40), 1);
    return bag;
}

// Overlap-coefficient style score (shared weight / smaller bag's total
// weight) rather than Jaccard -- short titles like "AI" have a tiny
// keyword bag, and Jaccard's union-based denominator would unfairly tank
// their similarity to anything with a longer description. Returns
// roughly 0..1.
function keywordSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let shared = 0;
    let weightA = 0;
    const weightB = { total: 0 };
    a.forEach((w) => (weightA += w));
    b.forEach((w) => (weightB.total += w));
    a.forEach((w, k) => {
        const bw = b.get(k);
        if (bw) shared += Math.min(w, bw);
    });
    const denom = Math.min(weightA, weightB.total);
    return denom > 0 ? shared / denom : 0;
}

// Above this score, two neurons are related enough to wire up
// automatically the moment either one enters the graph.
const AUTO_LINK_SIMILARITY = 0.22;
// Below AUTO_LINK_SIMILARITY but above this, a match is close enough to
// surface as a "you might also want to link this" suggestion without
// committing to it automatically.
const SUGGEST_SIMILARITY = 0.1;
const MAX_AUTO_LINKS = 3;
const MAX_SUGGESTIONS = 5;

interface WikiSummaryPayload {
    title: string;
    type?: string;
    extract?: string;
    description?: string;
}

interface WikiRelatedPayload {
    pages?: WikiSummaryPayload[];
}

async function fetchWikiSummary(title: string): Promise<WikiSummaryPayload | null> {
    const res = await fetch(WIKI_SUMMARY + encodeURIComponent(title));
    if (!res.ok) return null;
    const json = await res.json();
    if (json.type === "disambiguation") return null;
    return json;
}

async function fetchWikiRelated(title: string): Promise<WikiSummaryPayload[]> {
    try {
        const res = await fetch(WIKI_RELATED + encodeURIComponent(title));
        if (!res.ok) return [];
        const json: WikiRelatedPayload = await res.json();
        return (json.pages ?? []).filter((p) => p.extract).slice(0, MAX_RELATED);
    } catch {
        return [];
    }
}

class Store {
    private state: EngineState = {
        selectedId: null,
        hoveredId: null,
        query: "",
        visitCounts: loadVisitCounts(),
        graphVersion: 0,
        expanding: null,
        expandError: null,
        aiExpanding: null,
        aiExpandError: null,
        explainingId: null,
        explainError: null,
        debating: null,
        debateError: null,
        history: [],
        recentSearches: loadRecentSearches(),
        chatOpen: false,
        chatMessages: [],
        chatLoading: false,
        chatError: null,
        commandPaletteOpen: false,
        contextMenu: null,
        debateModeOpen: false,
        debateModeTopic: "",
        debateModeLog: [],
        debateModeRunning: false,
        debateModeError: null,
        debateGlowSide: null,
        debateGlowAt: 0,
    };

    // Bumped on every start/stop so an in-flight debate loop can tell it's
    // been superseded and quit instead of racing a newer one.
    private debateRunToken = 0;

    private listeners = new Set<() => void>();

    // Mutable now (was a readonly one-shot layout): live-expanded topics
    // get pushed into `nodes`/`connections`/`byId` in place, so existing
    // neurons never jump around when the graph grows.
    // Everything from here on is real -- every neuron exists because a
    // topic was actually searched (via Wikipedia or, failing that, AI
    // generation in `aiExpandTopic`), and every connection is either a
    // real Wikipedia "related pages" link, a model-proposed relation, or
    // a keyword match (see `autoLinkSimilar`). Nothing here is invented
    // placeholder content. The *starting* handful of neurons below are no
    // exception -- they're real Wikipedia topics, wired up exactly the
    // way a manual search would wire them up (see `seedStarterField`) --
    // they just save the person from opening the app to a total void
    // with nothing to click.
    graph: LaidOutGraph = { nodes: [], connections: [], byId: new Map() };

    constructor() {
        this.seedStarterField();
    }

    getState = (): EngineState => this.state;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    private set(patch: Partial<EngineState>) {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach((l) => l());
    }

    // A handful of broad, genuinely interesting real topics, dropped in
    // as a loose ring so there's *something* to fly toward and click into
    // the moment the app opens -- an invitation, not a demo. Each one is
    // origin: "wiki" with a real wikiTitle, so clicking one behaves
    // exactly like clicking any topic you searched yourself: `select()`
    // sees it's a live wiki neuron with degree <= 1 and pulls in its real
    // related pages immediately, blooming outward on first click.
    private seedStarterField() {
        const starters: { title: string; teaser: string }[] = [
            { title: "Artificial intelligence", teaser: "Machines that reason, learn, and act." },
            { title: "Universe", teaser: "Everything that exists: space, time, matter, energy." },
            { title: "Human brain", teaser: "The three-pound organ running all of this." },
            { title: "Ancient Rome", teaser: "A city-state that became an empire spanning a continent." },
            { title: "Music theory", teaser: "The structure behind sound that moves people." },
            { title: "Quantum mechanics", teaser: "Where matter stops behaving the way intuition expects." },
        ];

        starters.forEach((s, i) => {
            const id = wikiId(s.title);
            this.addNeuron(
                {
                    id,
                    title: s.title,
                    type: "domain",
                    domain: "Start here",
                    tags: [],
                    description: s.teaser,
                    origin: "wiki",
                    wikiTitle: s.title,
                },
                this.starterPosition(i, starters.length)
            );
        });
    }

    // Wider and more evenly spread than `ringPosition` (which orbits
    // tightly around a specific center) -- these aren't clustered around
    // anything yet, they're the first landmarks in an empty sky.
    private starterPosition(i: number, total: number): THREE.Vector3 {
        const angle = (i / total) * Math.PI * 2 + Math.random() * 0.25;
        const elevation = (Math.random() - 0.5) * Math.PI * 0.45;
        const radius = 22 + Math.random() * 10;
        return new THREE.Vector3(
            Math.cos(angle) * Math.cos(elevation) * radius,
            Math.sin(elevation) * radius * 0.5,
            Math.sin(angle) * Math.cos(elevation) * radius
        );
    }

    select(id: string | null) {
        // Debate Mode takes over the screen deliberately (see
        // `toggleDebateMode`) -- ignore stray picks on the 3D scene
        // underneath it so a click can't reopen InfoPanel and collide
        // with the debate overlay while it's up.
        if (id && this.state.debateModeOpen) return;
        if (id) {
            const counts = {
                ...this.state.visitCounts,
                [id]: (this.state.visitCounts[id] ?? 0) + 1,
            };
            saveVisitCounts(counts);
            const history = this.state.history.filter((h) => h !== id);
            history.push(id);
            if (history.length > MAX_HISTORY) history.shift();
            this.set({ selectedId: id, visitCounts: counts, query: "", history, contextMenu: null });

            // Traversal: if this neuron came from a live Wikipedia lookup
            // and hasn't had its own neighborhood pulled in yet, fetch its
            // related topics now. This is what makes the graph genuinely
            // walkable rather than a one-level search result -- every wiki
            // neuron becomes a new jumping-off point.
            const node = this.graph.byId.get(id);
            if (node?.neuron.origin === "wiki") {
                const degree = this.graph.connections.filter(
                    (c) => c.from.neuron.id === id || c.to.neuron.id === id
                ).length;
                if (degree <= 1) {
                    this.expandTopic(node.neuron.wikiTitle ?? node.neuron.title, id);
                }
            }
        } else {
            this.set({ selectedId: null });
        }
    }

    hover(id: string | null) {
        if (id !== this.state.hoveredId) this.set({ hoveredId: id });
    }

    setQuery(query: string) {
        this.set({ query, expandError: null });
    }

    recordSearch(term: string) {
        const clean = term.trim();
        if (!clean) return;
        const list = [clean, ...this.state.recentSearches.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(
            0,
            MAX_RECENT
        );
        saveRecentSearches(list);
        this.set({ recentSearches: list });
    }

    // Live "unlimited data" search: pulls a topic and its real related
    // topics from Wikipedia and grafts them onto the graph as new,
    // traversable neurons. `originId`, when set, means we're expanding an
    // *existing* stub neuron (from a prior expansion) rather than creating
    // a fresh root -- used by `select()` above.
    async expandTopic(rawTitle: string, originId?: string) {
        const title = rawTitle.trim();
        if (!title) return;
        if (!originId) this.recordSearch(title);

        const id = wikiId(title);
        const existing = this.graph.byId.get(id);
        if (existing && !originId) {
            this.select(id);
            return;
        }

        this.set({ expanding: title, expandError: null });

        try {
            const summary = existing ? null : await fetchWikiSummary(title);
            if (!existing && !summary) {
                // No encyclopedia article -- fall through to AI generation
                // instead of dead-ending. Covers project ideas, business
                // concepts, jargon, anything Wikipedia doesn't carry.
                this.set({ expanding: null });
                await this.aiExpandTopic(title, originId);
                return;
            }

            const centerId = originId ?? id;
            if (!existing && summary) {
                this.addNeuron(
                    {
                        id,
                        title: summary.title || title,
                        type: "concept",
                        domain: "Explored",
                        tags: [],
                        description: summary.extract ?? summary.description ?? "",
                        origin: "wiki",
                        wikiTitle: summary.title || title,
                    },
                    this.spawnPosition(originId)
                );
            }

            const related = await fetchWikiRelated(summary?.title ?? title);
            const center = this.graph.byId.get(centerId);

            related.forEach((page, i) => {
                if (!page.title || !page.extract) return;
                const relId = wikiId(page.title);
                if (!this.graph.byId.has(relId)) {
                    this.addNeuron(
                        {
                            id: relId,
                            title: page.title,
                            type: "concept",
                            domain: "Explored",
                            tags: [],
                            description: page.extract,
                            origin: "wiki",
                            wikiTitle: page.title,
                        },
                        this.ringPosition(center?.position, i, related.length)
                    );
                }
                this.addConnection(centerId, relId, "similarity", 0.55);
            });

            this.set({ expanding: null });
            if (!originId) this.select(centerId);
        } catch {
            this.set({
                expanding: null,
                expandError: "Couldn't reach Wikipedia -- check your connection.",
            });
        }
    }

    // AI-generated graph expansion (Groq): used when Wikipedia has no
    // article for a topic, and directly for arbitrary ideas/notes/jargon
    // via the command palette or a neuron's context menu. Same shape as
    // `expandTopic` -- creates a center neuron (if new) plus a handful of
    // related neurons and typed, weighted connections -- but the content
    // comes from the model instead of an encyclopedia, so neurons are
    // tagged `origin: "ai"` and the UI marks them as such rather than
    // implying they're sourced fact.
    async aiExpandTopic(rawTitle: string, originId?: string) {
        const title = rawTitle.trim();
        if (!title) return;
        if (!originId) this.recordSearch(title);

        const id = wikiId(title);
        const existing = this.graph.byId.get(id);
        if (existing && !originId) {
            this.select(id);
            return;
        }

        this.set({ aiExpanding: title, aiExpandError: null });

        try {
            const centerId = originId ?? id;

            if (!existing) {
                this.addNeuron(
                    {
                        id,
                        title,
                        type: "idea",
                        domain: "Explored",
                        tags: [],
                        description: "",
                        origin: "ai",
                    },
                    this.spawnPosition(originId)
                );
            }

            const { concepts } = await aiExpand(title);
            const center = this.graph.byId.get(centerId);

            concepts.forEach((concept, i) => {
                const relId = wikiId(concept.title);
                if (relId === centerId) return;
                if (!this.graph.byId.has(relId)) {
                    this.addNeuron(
                        {
                            id: relId,
                            title: concept.title,
                            type: "idea",
                            domain: "Explored",
                            tags: [],
                            description: concept.description,
                            origin: "ai",
                        },
                        this.ringPosition(center?.position, i, concepts.length)
                    );
                }
                this.addConnection(centerId, relId, concept.relation, concept.weight);
            });

            this.set({ aiExpanding: null });
            if (!originId) this.select(centerId);
        } catch (err) {
            this.set({
                aiExpanding: null,
                aiExpandError: err instanceof Error ? err.message : "AI expansion failed.",
            });
        }
    }

    // Topic explanation (Groq): fills in a neuron's description on demand
    // -- mainly for AI-created neurons whose description came back empty,
    // or any thin/seed neuron the user wants expanded on. Mutates the
    // neuron in place and bumps graphVersion so the InfoPanel re-renders.
    async explainWithAI(id: string) {
        const node = this.graph.byId.get(id);
        if (!node) return;
        this.set({ explainingId: id, explainError: null });
        try {
            const { explanation } = await aiExplain(node.neuron.wikiTitle ?? node.neuron.title);
            node.neuron.description = explanation;
            this.set({ explainingId: null, graphVersion: this.state.graphVersion + 1 });
        } catch (err) {
            this.set({
                explainingId: null,
                explainError: err instanceof Error ? err.message : "Explanation failed.",
            });
        }
    }

    // "Debate with AI": stakes out 3-4 claims about a topic (Groq) and
    // has a second Groq model rebut each one directly, then drops each claim/
    // rebuttal as its own neuron pair -- mirrored across the topic in
    // opposing arcs -- linked by a "conflict" edge.
    // Same-side neurons (all claims, all rebuttals) are then interlinked
    // with each other via "allied" edges so each side reads as its own
    // connected cluster of same-colored neurons, not just spokes off the
    // center. Same shape as aiExpandTopic (create center if new, then
    // children + edges) but produces two colored, opposed neurons per
    // generated item instead of one.
    //
    // Internally still called "debate" (this is the same claim/rebuttal
    // mechanism as live Debate Mode below) -- only the InfoPanel button
    // label changed to "Expand topic with AI".
    async debateTopic(rawTitle: string, originId?: string) {
        const title = rawTitle.trim();
        if (!title) return;
        if (!originId) this.recordSearch(title);

        const id = wikiId(title);
        const existing = this.graph.byId.get(id);
        if (existing && !originId) {
            this.select(id);
        }

        this.set({ debating: title, debateError: null });

        try {
            const centerId = originId ?? id;

            if (!existing) {
                this.addNeuron(
                    {
                        id,
                        title,
                        type: "idea",
                        domain: "Debated",
                        tags: [],
                        description: "",
                        origin: "ai",
                    },
                    this.spawnPosition(originId)
                );
            }

            const { pairs } = await aiDebate(title);
            const center = this.graph.byId.get(centerId);

            // Collected as we go so every claim and every rebuttal can be
            // interlinked with its own side after the loop below --
            // "for" neurons form one connected cluster, "against"
            // neurons form the other.
            const claimIds: string[] = [];
            const rebuttalIds: string[] = [];

            pairs.forEach((pair, i) => {
                const claimId = wikiId(`${title}::claim::${i}::${pair.title}`);
                const rebuttalId = wikiId(`${title}::rebuttal::${i}::${pair.title}`);
                const { claimPos, rebuttalPos } = this.duoPosition(center?.position, i, pairs.length);

                if (!this.graph.byId.has(claimId)) {
                    this.addNeuron(
                        {
                            id: claimId,
                            title: pair.title,
                            type: "idea",
                            domain: "Debated",
                            tags: [],
                            description: pair.claim,
                            origin: "ai",
                            stance: { agent: "claim", color: CLAIM_COLOR },
                        },
                        claimPos
                    );
                }

                if (!this.graph.byId.has(rebuttalId)) {
                    this.addNeuron(
                        {
                            id: rebuttalId,
                            title: `Re: ${pair.title}`,
                            type: "idea",
                            domain: "Debated",
                            tags: [],
                            description: pair.rebuttal,
                            origin: "ai",
                            stance: { agent: "rebuttal", color: REBUTTAL_COLOR },
                        },
                        rebuttalPos
                    );
                }

                this.addConnection(centerId, claimId, "reference", 0.6);
                this.addConnection(centerId, rebuttalId, "reference", 0.6);
                this.addConnection(claimId, rebuttalId, "conflict", 0.9);

                claimIds.push(claimId);
                rebuttalIds.push(rebuttalId);
            });

            // Interlink every neuron with the others on its own side --
            // full mesh, not just a chain, so a "for" argument reads as
            // connected to every other "for" argument (and likewise for
            // "against"), each pair of same-side neurons wired together
            // with an "allied" edge instead of "conflict".
            const meshLink = (ids: string[]) => {
                for (let a = 0; a < ids.length; a++) {
                    for (let b = a + 1; b < ids.length; b++) {
                        this.addConnection(ids[a], ids[b], "allied", 0.5);
                    }
                }
            };
            meshLink(claimIds);
            meshLink(rebuttalIds);

            this.set({ debating: null });
            if (!originId) this.select(centerId);
        } catch (err) {
            this.set({
                debating: null,
                debateError: err instanceof Error ? err.message : "Debate generation failed.",
            });
        }
    }

    // ---- AI chat panel ----

    toggleChat(open?: boolean) {
        this.set({ chatOpen: open ?? !this.state.chatOpen, commandPaletteOpen: false, debateModeOpen: false });
    }

    clearChat() {
        this.set({ chatMessages: [], chatError: null });
    }

    async sendChatMessage(text: string) {
        const content = text.trim();
        if (!content || this.state.chatLoading) return;

        const messages: ChatMessage[] = [...this.state.chatMessages, { role: "user", content }];
        this.set({ chatMessages: messages, chatLoading: true, chatError: null, chatOpen: true });

        const selected = this.state.selectedId ? this.graph.byId.get(this.state.selectedId) : undefined;
        const context = selected
            ? `${selected.neuron.title} (${selected.neuron.type}) -- ${selected.neuron.description}`.slice(0, 600)
            : undefined;

        try {
            const { reply } = await aiChat(messages, context);
            this.set({
                chatMessages: [...messages, { role: "assistant", content: reply }],
                chatLoading: false,
            });
        } catch (err) {
            this.set({
                chatLoading: false,
                chatError: err instanceof Error ? err.message : "Chat failed.",
            });
        }
    }

    // ---- Command palette ----

    toggleCommandPalette(open?: boolean) {
        this.set({ commandPaletteOpen: open ?? !this.state.commandPaletteOpen });
    }

    // ---- Debate Mode (live, two-sided, dock toolbar) ----

    toggleDebateMode(open?: boolean) {
        const next = open ?? !this.state.debateModeOpen;
        this.set({
            debateModeOpen: next,
            chatOpen: false,
            commandPaletteOpen: false,
            // Debate Mode is a full-screen takeover, not another panel
            // competing for space -- drop any selection so InfoPanel
            // (right third of the screen) can't be open underneath it
            // and collide with the debate columns.
            selectedId: next ? null : this.state.selectedId,
        });
        if (!next) this.stopDebateMode();
    }

    async startDebateMode(rawTopic: string) {
        const topic = rawTopic.trim();
        if (!topic || this.state.debateModeRunning) return;

        const token = ++this.debateRunToken;
        this.set({
            debateModeTopic: topic,
            debateModeLog: [],
            debateModeRunning: true,
            debateModeError: null,
            debateGlowSide: null,
            debateGlowAt: 0,
        });
        await this.runDebateLoop(topic, token);
    }

    // Cancels any in-flight loop (by invalidating its token, checked
    // between turns) and lets the current turn's request finish quietly
    // in the background rather than aborting mid-fetch.
    stopDebateMode() {
        if (!this.state.debateModeRunning) return;
        this.debateRunToken++;
        this.set({ debateModeRunning: false });
    }

    // Alternates Groq's main model ("for") and a second, faster Groq
    // model ("against") turns, each one reading the transcript so far, up to a fixed cap
    // so an unattended debate can't run forever. Mirrors the shape of
    // `debateTopic`'s claim/rebuttal generation but produces a live, growing transcript
    // instead of a one-shot batch, and drives `debateGlowSide` /
    // `debateGlowAt` after every turn so the scene can react.
    private async runDebateLoop(topic: string, token: number) {
        const MAX_TURNS = 14;
        // Kept short -- the sky text and glow are meant to read as a
        // fast, live back-and-forth, not a slow reveal. The request/
        // response latency itself is already the main pacing; this just
        // stops the next line popping in before the last one has had a
        // beat to be read.
        const TURN_PAUSE_MS = 350;
        let agent: "for" | "against" = "for";

        for (let i = 0; i < MAX_TURNS; i++) {
            if (token !== this.debateRunToken) return;

            try {
                const { text } = await aiDebateTurn(topic, agent, this.state.debateModeLog);
                if (token !== this.debateRunToken) return;
                this.set({
                    debateModeLog: [...this.state.debateModeLog, { agent, text }],
                    debateGlowSide: agent,
                    debateGlowAt: Date.now(),
                });
            } catch (err) {
                if (token !== this.debateRunToken) return;
                this.set({
                    debateModeRunning: false,
                    debateModeError: err instanceof Error ? err.message : "Debate failed.",
                });
                return;
            }

            agent = agent === "for" ? "against" : "for";
            await new Promise((resolve) => setTimeout(resolve, TURN_PAUSE_MS));
        }

        if (token === this.debateRunToken) this.set({ debateModeRunning: false });
    }

    // ---- Context menu (right-click on a neuron) ----

    openContextMenu(id: string, x: number, y: number) {
        this.set({ contextMenu: { id, x, y } });
    }

    closeContextMenu() {
        if (this.state.contextMenu) this.set({ contextMenu: null });
    }

    // Places a freshly-searched root topic. Sent out into open space at a
    // healthy radius (rather than piling onto the origin) so the field
    // grows outward as you explore instead of clumping at center.
    private spawnPosition(nearId?: string): THREE.Vector3 {
        if (nearId) {
            const near = this.graph.byId.get(nearId);
            if (near) return near.position.clone();
        }
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.5) * Math.PI * 0.6;
        const radius = 20 + Math.random() * 14;
        return new THREE.Vector3(
            Math.cos(angle) * Math.cos(elevation) * radius,
            Math.sin(elevation) * radius * 0.5,
            Math.sin(angle) * Math.cos(elevation) * radius
        );
    }

    // Related topics fan out in a small ring around their center so they
    // read as "orbiting" the neuron that surfaced them.
    private ringPosition(center: THREE.Vector3 | undefined, i: number, total: number): THREE.Vector3 {
        const base = center ?? new THREE.Vector3();
        const angle = (i / Math.max(total, 1)) * Math.PI * 2;
        const radius = 3.2 + Math.random() * 1.6;
        return new THREE.Vector3(
            base.x + Math.cos(angle) * radius,
            base.y + (Math.random() - 0.5) * 2,
            base.z + Math.sin(angle) * radius
        );
    }

    // Places a claim/rebuttal pair as mirrored points on opposing arcs
    // around the debated topic -- claims sweep a semicircle on one side,
    // rebuttals sweep the mirrored semicircle on the other, so the two
    // "sides" of the debate read as opposing clusters facing each other
    // rather than just an alternating ring.
    private duoPosition(
        center: THREE.Vector3 | undefined,
        i: number,
        total: number
    ): { claimPos: THREE.Vector3; rebuttalPos: THREE.Vector3 } {
        const base = center ?? new THREE.Vector3();
        const spread = Math.PI * 0.6;
        const t = total > 1 ? i / (total - 1) : 0.5;
        const arcAngle = (t - 0.5) * spread;
        const radius = 4 + Math.random() * 1.5;
        const rise = (Math.random() - 0.5) * 2.4;

        const claimPos = new THREE.Vector3(
            base.x + Math.cos(arcAngle) * radius,
            base.y + rise,
            base.z + Math.sin(arcAngle) * radius
        );

        const oppositeAngle = arcAngle + Math.PI;
        const rebuttalPos = new THREE.Vector3(
            base.x + Math.cos(oppositeAngle) * radius,
            base.y - rise,
            base.z + Math.sin(oppositeAngle) * radius
        );

        return { claimPos, rebuttalPos };
    }

    private addNeuron(neuron: Neuron, position: THREE.Vector3) {
        const positioned: PositionedNeuron = { neuron, position };
        this.graph.nodes.push(positioned);
        this.graph.byId.set(neuron.id, positioned);
        this.set({ graphVersion: this.state.graphVersion + 1 });
        // Every new neuron -- however it got here (Wikipedia, AI
        // expansion, or a future manual "add topic") -- gets checked
        // against the rest of the graph and wired to whatever it's
        // actually related to. This is what makes cross-topic linking
        // automatic instead of depending on one search happening to
        // surface the other by exact title.
        this.autoLinkSimilar(neuron.id);
    }

    private addConnection(fromId: string, toId: string, type: ConnectionType, weight: number) {
        const from = this.graph.byId.get(fromId);
        const to = this.graph.byId.get(toId);
        if (!from || !to) return;
        const dup = this.graph.connections.some(
            (c) =>
                (c.from.neuron.id === fromId && c.to.neuron.id === toId) ||
                (c.from.neuron.id === toId && c.to.neuron.id === fromId)
        );
        if (dup) return;
        this.graph.connections.push({ from, to, type, weight });
        this.set({ graphVersion: this.state.graphVersion + 1 });
    }

    private isConnected(idA: string, idB: string): boolean {
        return this.graph.connections.some(
            (c) =>
                (c.from.neuron.id === idA && c.to.neuron.id === idB) ||
                (c.from.neuron.id === idB && c.to.neuron.id === idA)
        );
    }

    // Compares a neuron's keywords against every other neuron already in
    // the graph and auto-connects the strongest matches as "shared_topic"
    // edges. This is the piece that links topics pulled in from separate
    // searches (e.g. "AI" and "Machine Learning") once they share enough
    // real subject matter, rather than only ever linking within a single
    // expansion batch.
    private autoLinkSimilar(id: string) {
        const target = this.graph.byId.get(id);
        if (!target) return;
        const targetKeywords = neuronKeywords(target.neuron);
        if (targetKeywords.size === 0) return;

        const scored = this.graph.nodes
            .filter((n) => n.neuron.id !== id)
            .map((n) => ({ n, score: keywordSimilarity(targetKeywords, neuronKeywords(n.neuron)) }))
            .filter((r) => r.score >= AUTO_LINK_SIMILARITY)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_AUTO_LINKS);

        scored.forEach(({ n, score }) => {
            // Weight scales with how strong the keyword match is, kept in
            // the same 0.3-0.85 range as other connection types so it
            // doesn't visually dominate more deliberate links (citations,
            // prerequisites, etc).
            this.addConnection(id, n.neuron.id, "shared_topic", Math.min(0.85, 0.3 + score * 0.5));
        });
    }

    // Neurons already in the graph that look related to `id` by keyword
    // overlap but didn't clear the bar for an automatic link, and aren't
    // already connected to it. Surfaced in the InfoPanel as "Related
    // topics" -- picking one links it immediately.
    relatedSuggestions(id: string, limit = MAX_SUGGESTIONS) {
        const target = this.graph.byId.get(id);
        if (!target) return [];
        const targetKeywords = neuronKeywords(target.neuron);
        if (targetKeywords.size === 0) return [];

        return this.graph.nodes
            .filter((n) => n.neuron.id !== id && !this.isConnected(id, n.neuron.id))
            .map((n) => ({ neuron: n.neuron, score: keywordSimilarity(targetKeywords, neuronKeywords(n.neuron)) }))
            .filter((r) => r.score >= SUGGEST_SIMILARITY)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // Manually link a suggested (or any two existing) neurons -- called
    // when the user picks a "Related topic" suggestion in the InfoPanel.
    linkNeurons(fromId: string, toId: string) {
        if (fromId === toId) return;
        const from = this.graph.byId.get(fromId);
        const to = this.graph.byId.get(toId);
        if (!from || !to) return;
        const score = keywordSimilarity(neuronKeywords(from.neuron), neuronKeywords(to.neuron));
        this.addConnection(fromId, toId, "shared_topic", Math.min(0.85, 0.3 + score * 0.5));
    }

    // 1-hop neighborhood of a neuron, used to drive signal propagation --
    // the selected neuron plus everything directly connected to it.
    activeNeuronIds(): Set<string> {
        const active = new Set<string>();
        const id = this.state.selectedId;
        if (!id) return active;
        active.add(id);
        this.graph.connections.forEach((c) => {
            if (c.from.neuron.id === id) active.add(c.to.neuron.id);
            if (c.to.neuron.id === id) active.add(c.from.neuron.id);
        });
        return active;
    }

    // All neurons matching the current query (title/type/domain/tags), used
    // to highlight/fade the graph live as you type -- before you've clicked
    // any result. Unlike searchResults() this isn't limited to a shortlist:
    // every match should light up, not just the top few shown in the
    // dropdown.
    queryMatchIds(): Set<string> {
        const q = this.state.query.trim().toLowerCase();
        const ids = new Set<string>();
        if (!q) return ids;

        this.graph.nodes.forEach(({ neuron }) => {
            const hay = [neuron.title, neuron.type, neuron.domain, ...neuron.tags]
                .join(" ")
                .toLowerCase();
            if (hay.includes(q)) ids.add(neuron.id);
        });

        return ids;
    }

    searchResults(limit = 6) {
        const q = this.state.query.trim().toLowerCase();
        if (!q) return [];

        const scored = this.graph.nodes
            .map(({ neuron }) => {
                const hay = [neuron.title, neuron.type, neuron.domain, ...neuron.tags]
                    .join(" ")
                    .toLowerCase();
                let score = 0;
                if (neuron.title.toLowerCase().startsWith(q)) score += 3;
                else if (neuron.title.toLowerCase().includes(q)) score += 2;
                else if (hay.includes(q)) score += 1;
                // Frequently visited neurons rank slightly higher -- a small
                // stand-in for the vision doc's "frequently visited neurons
                // become stronger."
                score += Math.min(this.state.visitCounts[neuron.id] ?? 0, 5) * 0.05;
                return { neuron, score };
            })
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return scored.map((r) => r.neuron);
    }
}

export const engineStore = new Store();

export function useEngineState(): EngineState {
    return useSyncExternalStore(engineStore.subscribe, engineStore.getState, engineStore.getState);
}
