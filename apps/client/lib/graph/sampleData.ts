import { GraphData } from "./types";

// Placeholder content. Structured the way the vision doc's own examples
// describe (the "Attention Is All You Need" extraction example, and the
// "Neura as a mini brain" project example) so the engine has real,
// searchable, connected data to run on. Replace with actual ingested
// content — this file is the seam where a future ingestion pipeline would
// write its output.

export const sampleGraph: GraphData = {
    neurons: [
        // --- Domain: Neura (the project, describing itself) ---
        { id: "mnem", title: "Neura", type: "domain", domain: "Neura", tags: ["project", "graph", "three.js"], description: "A living-intelligence interface: knowledge rendered as a neural graph instead of a page." },
        { id: "mnem-frontend", title: "Frontend", type: "category", domain: "Neura", tags: ["next.js", "react"], description: "The Next.js + React application shell." },
        { id: "mnem-renderer", title: "Renderer", type: "category", domain: "Neura", tags: ["three.js", "webgl"], description: "The React Three Fiber scene: camera, layers, post-processing." },
        { id: "mnem-shaders", title: "Shaders", type: "concept", domain: "Neura", tags: ["glsl", "webgl"], description: "Custom GLSL for neuron glow, signal travel, and depth fade." },
        { id: "mnem-particles", title: "Particles", type: "concept", domain: "Neura", tags: ["three.js", "buffergeometry"], description: "The neuron/dust point cloud driving the visual field." },
        { id: "mnem-simulation", title: "Simulation", type: "concept", domain: "Neura", tags: ["animation"], description: "Per-frame behavior: breathing, drift, signal propagation." },
        { id: "mnem-camera", title: "Camera", type: "concept", domain: "Neura", tags: ["three.js"], description: "Idle drift plus fly-to behavior when a neuron is focused." },
        { id: "mnem-search", title: "Search", type: "concept", domain: "Neura", tags: ["ui"], description: "Query the graph; matching neurons activate and the camera flies to them." },
        { id: "mnem-signals", title: "Signal Propagation", type: "concept", domain: "Neura", tags: ["animation"], description: "Activity spreads from a selected neuron to its direct connections." },

        // --- Domain: Artificial Intelligence (the doc's own worked example) ---
        { id: "ai", title: "Artificial Intelligence", type: "domain", domain: "Artificial Intelligence", tags: [], description: "Root domain for machine intelligence topics." },
        { id: "ml", title: "Machine Learning", type: "category", domain: "Artificial Intelligence", tags: [], description: "Systems that improve from data rather than explicit rules." },
        { id: "dl", title: "Deep Learning", type: "concept", domain: "Artificial Intelligence", tags: [], description: "Machine learning with many-layer neural networks." },
        { id: "transformers", title: "Transformers", type: "concept", domain: "Artificial Intelligence", tags: ["nlp", "sequence models"], description: "An architecture built entirely on attention, no recurrence." },
        { id: "attention", title: "Attention", type: "concept", domain: "Artificial Intelligence", tags: [], description: "A mechanism for weighing which parts of the input matter most." },
        { id: "self-attention", title: "Self-Attention", type: "concept", domain: "Artificial Intelligence", tags: [], description: "Attention applied within a single sequence, relating tokens to each other." },
        { id: "multi-head", title: "Multi-Head Attention", type: "concept", domain: "Artificial Intelligence", tags: [], description: "Several attention operations run in parallel and combined." },
        { id: "aiayn", title: "Attention Is All You Need", type: "paper", domain: "Artificial Intelligence", tags: ["google", "2017", "nlp"], description: "The 2017 paper introducing the Transformer architecture.", year: 2017 },
        { id: "encoder", title: "Encoder", type: "concept", domain: "Artificial Intelligence", tags: [], description: "The half of a Transformer that reads and represents the input." },
        { id: "decoder", title: "Decoder", type: "concept", domain: "Artificial Intelligence", tags: [], description: "The half of a Transformer that generates output, token by token." },
        { id: "positional-encoding", title: "Positional Encoding", type: "concept", domain: "Artificial Intelligence", tags: [], description: "Injects order information since attention has no built-in sense of sequence." },
        { id: "pytorch", title: "PyTorch", type: "technology", domain: "Artificial Intelligence", tags: ["framework"], description: "A widely used deep learning framework." },

        // --- Domain: Web Engineering ---
        { id: "web", title: "Web Engineering", type: "domain", domain: "Web Engineering", tags: [], description: "Building software that runs in the browser." },
        { id: "nextjs", title: "Next.js", type: "technology", domain: "Web Engineering", tags: ["react", "framework"], description: "A React framework for routing, rendering, and bundling." },
        { id: "react", title: "React", type: "technology", domain: "Web Engineering", tags: ["ui"], description: "A component-based library for building user interfaces." },
        { id: "threejs", title: "Three.js", type: "technology", domain: "Web Engineering", tags: ["webgl", "3d"], description: "A JavaScript 3D library built on WebGL." },
        { id: "webgl", title: "WebGL", type: "technology", domain: "Web Engineering", tags: ["graphics"], description: "A browser API for GPU-accelerated 2D and 3D graphics." },
        { id: "typescript", title: "TypeScript", type: "technology", domain: "Web Engineering", tags: ["language"], description: "A typed superset of JavaScript." },
        { id: "r3f", title: "React Three Fiber", type: "technology", domain: "Web Engineering", tags: ["react", "three.js"], description: "A React renderer for Three.js scene graphs." },

        // --- Domain: Knowledge & Notes ---
        { id: "notes", title: "Knowledge & Notes", type: "domain", domain: "Knowledge & Notes", tags: [], description: "The second-brain layer: ideas, research notes, and future plans." },
        { id: "second-brain", title: "Second Brain", type: "concept", domain: "Knowledge & Notes", tags: [], description: "An external, structured store of everything you've read, learned, or thought." },
        { id: "future-plans", title: "Future Plans", type: "idea", domain: "Knowledge & Notes", tags: [], description: "Ideas queued but not yet started." },
        { id: "research-notes", title: "Research Notes", type: "note", domain: "Knowledge & Notes", tags: [], description: "Working notes taken while reading or exploring a topic." },
    ],
    connections: [
        // Neura project structure
        { from: "mnem", to: "mnem-frontend", type: "parent", weight: 1 },
        { from: "mnem", to: "mnem-renderer", type: "parent", weight: 1 },
        { from: "mnem-renderer", to: "mnem-shaders", type: "parent", weight: 0.9 },
        { from: "mnem-renderer", to: "mnem-particles", type: "parent", weight: 0.9 },
        { from: "mnem-renderer", to: "mnem-camera", type: "parent", weight: 0.8 },
        { from: "mnem-particles", to: "mnem-simulation", type: "prerequisite", weight: 0.8 },
        { from: "mnem-simulation", to: "mnem-signals", type: "parent", weight: 0.8 },
        { from: "mnem-signals", to: "mnem-search", type: "reference", weight: 0.7 },
        { from: "mnem-search", to: "mnem-camera", type: "reference", weight: 0.6 },
        { from: "mnem-frontend", to: "nextjs", type: "shared_technology", weight: 0.8 },
        { from: "mnem-renderer", to: "threejs", type: "shared_technology", weight: 0.9 },
        { from: "mnem-renderer", to: "r3f", type: "shared_technology", weight: 0.9 },
        { from: "mnem-shaders", to: "webgl", type: "shared_technology", weight: 0.8 },
        { from: "mnem-frontend", to: "typescript", type: "shared_technology", weight: 0.7 },

        // AI hierarchy
        { from: "ai", to: "ml", type: "parent", weight: 1 },
        { from: "ml", to: "dl", type: "parent", weight: 0.9 },
        { from: "dl", to: "transformers", type: "prerequisite", weight: 0.9 },
        { from: "transformers", to: "attention", type: "parent", weight: 1 },
        { from: "attention", to: "self-attention", type: "parent", weight: 0.9 },
        { from: "self-attention", to: "multi-head", type: "parent", weight: 0.9 },
        { from: "transformers", to: "encoder", type: "parent", weight: 0.8 },
        { from: "transformers", to: "decoder", type: "parent", weight: 0.8 },
        { from: "transformers", to: "positional-encoding", type: "parent", weight: 0.7 },
        { from: "aiayn", to: "transformers", type: "citation", weight: 1 },
        { from: "aiayn", to: "attention", type: "citation", weight: 0.9 },
        { from: "aiayn", to: "multi-head", type: "citation", weight: 0.8 },
        { from: "dl", to: "pytorch", type: "shared_technology", weight: 0.6 },

        // Web engineering
        { from: "web", to: "nextjs", type: "parent", weight: 0.9 },
        { from: "web", to: "react", type: "parent", weight: 0.9 },
        { from: "web", to: "typescript", type: "parent", weight: 0.7 },
        { from: "nextjs", to: "react", type: "prerequisite", weight: 0.8 },
        { from: "threejs", to: "webgl", type: "prerequisite", weight: 0.8 },
        { from: "r3f", to: "react", type: "prerequisite", weight: 0.8 },
        { from: "r3f", to: "threejs", type: "prerequisite", weight: 0.9 },

        // Knowledge & notes
        { from: "notes", to: "second-brain", type: "parent", weight: 0.9 },
        { from: "notes", to: "future-plans", type: "parent", weight: 0.7 },
        { from: "notes", to: "research-notes", type: "parent", weight: 0.7 },
        { from: "research-notes", to: "aiayn", type: "reference", weight: 0.5 },
        { from: "future-plans", to: "mnem-search", type: "similarity", weight: 0.3 },
    ],
};
