# Implementation notes — where this actually stands vs. the vision doc

## Latest pass: Milestone 1 of the new production checklist — Intelligence Core + unique background stars

You sent a 17-item production to-do list and asked for milestone-by-milestone
delivery with a fresh zip after each. This pass covers the first two items;
the rest (galaxy-style particle distribution, Bézier connection curves,
routing/growth/pruning, orbits/curl-noise/parallax, semantic search + image
thumbnails, camera fly-throughs, Dream Mode, 60fps GPU-instancing pass, UX
polish) are still open and will land in the milestones after this one.

**Intelligence Core** (`components/Scene/IntelligenceCore.tsx`, new file) —
there was no central object before; the origin was just where domain
clusters happened to be laid out around (`DOMAIN_RADIUS` in
`lib/graph/layout.ts`). Added a permanent object at that origin, mounted
inside `LayeredUniverse`'s `coreRef` group (same drifting/rotating frame as
the neurons and connections, so it never slides out of alignment with the
graph):
- An inner icosahedron with a fresnel-lit shader (deep blue core → bright
  near-white rim) and a slow per-vertex sine displacement so its surface
  reads as churning light, not a static ball.
- A larger back-side-rendered corona shell, additively blended, for a soft
  outer glow.
- Three ring bands at different fixed tilts and independent spin
  rates/directions, each with an angular "segments" pattern drifting around
  the band, so the shell reads as orbiting data rather than static rings.
- A shared pulse value (sine-driven) feeds brightness and a slight uniform
  scale breathing into all of the above, and pushes color well above the
  Bloom effect's 0.35 luminance threshold so it actually blooms.
- Not yet wired to anything dynamic (search activity, Dream Mode) — it
  breathes on a constant cycle for now. Hooking its pulse rate/intensity to
  real events (a search landing, idle Dream Mode) is a natural follow-up
  once Dream Mode itself exists.

**Unique background stars** (`components/Scene/BackgroundStars.tsx`,
rewritten) — previously a single flat `THREE.PointsMaterial`: one color, one
size, one opacity for all 80,000 stars, so the sky read as flat blue-grey
noise. Replaced with a custom `ShaderMaterial` carrying five per-star
attributes:
- `aSize` — cubed random distribution so most stars are small with rare
  larger outliers, instead of a uniform size.
- `aColor` — sampled from a weighted palette of real star tints (blue-white,
  white, warm white, yellow-orange, reddish) instead of one flat blue-grey.
- `aBrightness` — a random base brightness per star.
- `aTwinklePhase` / `aTwinkleSpeed` — each star's brightness now oscillates
  on its own independent sine cycle, so the field flickers like a real sky
  instead of pulsing in lockstep (or not moving at all, as before).
- Depth is handled two ways: the existing radius sampling was rebiased
  toward the outer shell so most stars sit far away with a sparser sprinkle
  up close, and the vertex shader now dims (not just shrinks) stars further
  from the camera, so distance reads as fainter, not only smaller.
- Still uses the shared soft-circle sprite from `sprites.ts` as the point
  texture, so this keeps the existing "snowball" glow rather than
  reintroducing hard-edged squares.

Same caveat as every pass in this environment: no network access, so this
is `tsc --noEmit` syntax-checked against the two changed/new files (module
resolution errors for `three`/`react`/`@react-three/fiber` are expected
without `node_modules` here and aren't real issues) — not build-tested.
Please `yarn install && yarn dev` and look before judging the tuning
(ring tilt angles, pulse speed, star tint weights, twinkle speed range are
all easy to nudge in the two files above).

## Earlier pass: empty sky at start, neurons only from real searches

Explicit request: start with nothing but the star field, and only create
a neuron (and its connections) when a topic is actually searched.

Previously `EngineStore`'s `graph` was initialized from
`layoutGraph(sampleGraph)` — a hand-written 32-neuron seed dataset
(`lib/graph/sampleData.ts`, the Mnemosyne/Transformers/Attention content
from earlier passes) that populated the field on load, before you'd
searched anything. That's what you were seeing pre-populated in the
screenshots. Changed the initial `graph` to `{ nodes: [], connections:
[], byId: new Map() }` — a genuinely empty graph — and dropped the
`sampleGraph` import. `sampleData.ts` and `layoutGraph()` itself are
still in the repo (unused by the running app now) rather than deleted,
consistent with how earlier passes have left dead scaffolding in place
rather than remove code that wasn't asked about.

Nothing else needed to change for this — it turned out the search →
neuron → connections pipeline you're describing was already exactly how
`EngineStore.expandTopic()`/`aiExpandTopic()` work (Wikipedia summary +
related pages, or an AI-generated fallback when Wikipedia has nothing,
each wired up with real typed/weighted connections): the only thing
standing between that and "empty sky, everything comes from search" was
the pre-seeded starting data. Camera, particle field, connections, and
picking layer were all already reading the graph's live node/connection
arrays rather than assuming a fixed seed count, so they handle zero
nodes at load without any special-casing — verified by reading through
each one rather than assuming.

Syntax-checked with `tsc --noResolve`, not run — same caveat as every
pass in this environment.

## Earlier pass: nebula was there but effectively invisible

Asked directly "is the nebula there?" — yes, `NebulaLayer.tsx` was
mounted the whole time (a giant backside-rendered sphere with fbm cloud
noise, in `LayeredUniverse.tsx`), but a previous pass had deliberately
capped it at ~5% max alpha with a comment saying it should read as
"depth, not decoration." That's a defensible call, but it doesn't match
"pretty nebula" on the checklist, and it's almost certainly why it
didn't show up in your screenshot — it was there but not doing anything
you could actually see.

Opened it up: added a second, finer-frequency fbm octave layered on top
of the original broad cloud shape (so it reads as wispy detail, not one
uniform blob), a third brighter color stop for highlights where clouds
overlap, and raised the alpha ceiling roughly 4x. Palette is unchanged —
still the existing graphite/blue/cyan rule, no purple, nothing
saturated; "pretty" here means actually visible structure, not a color
change.

Same build caveat as every pass — syntax-checked with `tsc --noResolve`,
not run. If it comes in too strong or too subtle once you can see it,
the two `alpha` terms and the `COLOR_C` mix strength near the bottom of
`NebulaLayer.tsx`'s fragment shader are the values to nudge.

## Earlier pass: circular "snowball" particles + UI/UX re-verification

You sent the UI/UX and VISUALS sections of the checklist again with one
concrete complaint attached: particles turn into visible squares when
zoomed in, and you want a softer "snowball" look instead.

**Root cause**: `DustLayer.tsx`, `BackgroundStars.tsx`, and
`ForegroundLayer.tsx` (in that order, foreground being the worst offender
since it's the layer nearest the camera) were all using plain
`THREE.PointsMaterial` with no sprite texture. WebGL's default point
primitive is a flat square; it's invisible at a few pixels but obviously
square once `sizeAttenuation` blows a point up as the camera gets close.
`ParticleField.tsx`'s neuron shader was never affected — it already
discards pixels outside a circle in its fragment shader.

**Fix**: added `components/Scene/sprites.ts`, a single shared soft
radial-gradient sprite (bright core → wide soft mid-tone → fully
transparent edge, generated once via canvas) used as both `map` and
`alphaMap` on all three plain-points materials. That's the "snowball"
part — a fluffy glowing falloff rather than a hard-edged dot, let alone a
square. Guarded for the SSR render pass (no `document` in Node) by
returning `undefined` there; the client-side hydration pass picks up the
real texture, so nothing breaks in the initial server-rendered HTML.

**UI/UX**: went back through `SearchBar.module.css` and the layout font
setup rather than assume the earlier passes' claims were still accurate.
The glassmorphism (backdrop blur + saturate, inset highlight, layered
shadow, focus-state transitions) and the Geist typeface are genuinely
there and hold up — command palette, dock, breadcrumb, context menu,
floating info panel are all real components wired into `page.tsx`, not
stubs. One small miss found and fixed: `app/layout.tsx` still had the
default `create-next-app` page title/description; that's now "Mnemosyne
— An operating system for intelligence." Nothing else in that section
needed rework — re-implementing already-working glassmorphism/command-
palette code from scratch would just risk regressing it for no reason.

Same caveat as every pass so far: no network access here, so this is
`tsc --noResolve` syntax-checked only, not build-tested — please
`yarn dev` and look before assuming the sprite/gradient tuning is exactly
right for your taste; gradient stops and opacity values in `sprites.ts`
are easy to nudge if the snowball look needs to be softer/harder.

## Earlier pass: neurons were rendering as dust blobs, not nodes

Feedback after the camera-control pass, with a screenshot: the field
still read as a handful of dense, packed star-clusters instead of a
sparse, legible spider web, even though the layout math underneath was
already spreading each neuron to its own distinct position.

The actual bug was in `ParticleField.tsx`, not the layout: it held a
fixed budget of 15,000 GPU points and, for every frame, scattered them
in a random gaussian blob *around* each neuron's position rather than
drawing one point *at* each neuron's position. With ~30-150 real neurons
in the graph, that's on the order of a hundred-plus overlapping dust
specks per neuron — so every neuron rendered as a fuzzy clump, and
several nearby clumps visually fused into the single dense blob you saw.
The connection lines (`NeuralConnections.tsx`) were already drawing from
real per-neuron positions and were correct the whole time; the graph
was there, it just wasn't visible through the dust.

Fixed by making the neuron field 1 GPU point per neuron, at its literal
graph position:
- `ParticleField.tsx` now sizes its buffers to `clusters.length` instead
  of a fixed 15,000, and writes each neuron's real position directly —
  no jitter, no blob.
- Added importance-based sizing (checklist item that was previously
  unimplemented): each neuron's point size now scales with its
  connection count (`aSize` attribute, `sqrt`-scaled so a hub doesn't
  swallow the screen), so well-connected concepts read as visually more
  prominent, per "NEURONS: Dynamic sizing based on importance."
  `NeuronMaterial.ts` was updated to consume that attribute and its max
  point-size clamp was raised (22 → 40) so a genuine hub node has room
  to stand out.
- `DustLayer.tsx` and `BackgroundStars.tsx` — the actual atmospheric
  layers you said you like — are untouched; they're a separate, unrelated
  decorative pass and were never part of the graph-density problem.

What this doesn't change: `lib/graph/layout.ts`'s Fibonacci-sphere domain
placement, which was already spreading domains uniformly through the
volume rather than clumping near one plane. That logic looked fine on
inspection; the packed appearance was entirely a rendering artifact, not
a positioning one. If it still reads as clustered by domain rather than
"uniform all over" once you can actually see individual nodes, that's
the next thing to tune (spread the intra-domain jitter further, or flatten
the domain groupings entirely) — flagging it now rather than guessing at
a fix you haven't seen yet.

Same caveat as last pass: no network access here, so this is
`tsc --noResolve` syntax-checked only, not build-tested. Please
`yarn dev` and look before assuming it's exactly right.

## Earlier pass: user-controlled camera (the checklist item that was actually missing)

You sent over the full GRAPH / NEURONS / CONNECTIONS / CAMERA / UI-UX / VISUALS
checklist and asked for all of it. Most of it — infinite live-expanding
graph, semantic-ish connections, weighted/typed edges, signal propagation,
command palette, dock, breadcrumb, context menu, glassmorphism panels,
bloom, particles, nebula, stars, custom cursor — was already built in the
passes documented below. Going through the checklist item by item against
the actual code, the one substantive gap was **CAMERA**: `CameraRig.tsx`
only ever auto-orbited on a timer and flew to a selected neuron — there was
no mouse/touch input wired to it at all, so "smooth panning," "infinite
pan & zoom," and "inertia & momentum" weren't real yet, just idle drift.

This pass adds actual input-driven camera control, done at the DOM level
(pointer events on the canvas, not R3F's synthetic event system, since it
needs to track drags that start over empty space):

- **Orbit** — left-drag (or one-finger touch drag) rotates the view around
  the current focus point, clamped in elevation so you can't flip over the
  pole.
- **Pan** — shift-drag, right-drag, or two-finger touch drag translates the
  focus point itself, and it's unclamped, so panning really is infinite.
- **Zoom** — mouse wheel, or pinch on touch, with distance clamped to a
  wide-but-finite range (3–320 units) so you can't zoom through the origin
  or out into nothing.
- **Inertia** — releasing mid-drag keeps the last frame's velocity going
  and decays it (0.9/frame friction) instead of stopping dead, for orbit,
  pan, and zoom alike.
- **Focus transitions preserved** — selecting a neuron still eases the
  camera to it exactly as before; the new pan offset resets on each new
  selection (so the new neuron re-centers) while your orbit angle and zoom
  level carry over, and the idle ambient wobble is damped down (not
  removed) while you're actively dragging so it doesn't fight your input.
- **A drag doesn't get misread as a click** — `engine/camera/dragState.ts`
  is a small transient flag (deliberately outside `EngineStore`, since it
  changes many times a frame and shouldn't trigger re-renders) that
  `PickingLayer`'s click/context-menu handlers and `NeuralScene`'s
  `onPointerMissed` all check, so ending a drag over a neuron doesn't
  select it and ending a drag over empty space doesn't deselect your
  current focus.

Everything else on the checklist was re-verified against the running code
rather than re-implemented from scratch — no reason to rewrite working
signal propagation or the command palette. The two items still genuinely
partial: "progressive loading of nearby neurons" only triggers on
selecting a neuron (not on camera proximity/panning into empty space), and
"automatic graph reorganization on search" is visit-count-weighted search
*ranking*, not neurons physically re-arranging in the scene. Both are
real but narrower than the checklist phrasing implies — flagging that
directly rather than quietly calling them done.

I couldn't install dependencies or run a dev server in this environment
(no network access), so this wasn't build-tested end to end — the new
files were checked with `tsc --noResolve` for syntax/structural errors
only. Worth a `yarn install && yarn dev` smoke test on your end before
relying on it.

## This pass: Groq AI integration, command palette, dock, breadcrumb, context menu

You handed over a checklist of ~100 items ("implement all of these"). Being
straight about it up front: several of those sections (a real backend/
database, PDF/video/GitHub ingestion, automatic knowledge extraction from
uploaded content, a business dashboard, a digital twin, timeline mode, a
learning-path generator, GPU LOD/frustum-culling/spatial-indexing
performance work) are not things a frontend-only pass can honestly deliver
as "done" — they need persistent storage, ingestion pipelines, and
substantially more engineering than fits in one change. Nothing below
claims otherwise. What *is* real and working in this pass:

- **AI is now actually integrated** (`app/api/ai/route.ts`) — a server
  route that calls Groq (`llama-3.3-70b-versatile`) and keeps
  `GROQ_API_KEY` server-side only (never sent to the browser). Copy
  `.env.local.example` to `.env.local` and fill in a key from
  console.groq.com. Three modes:
  - **Topic explanation** — `InfoPanel`'s "Explain with AI" button fills
    in a thin/empty neuron's description on demand.
  - **AI-generated graph expansion** — `EngineStore.aiExpandTopic()`
    asks the model for 4-6 related concepts (with a typed relation and a
    weight each), creates real neurons and connections from the JSON it
    returns, and now runs automatically whenever `expandTopic` (the
    Wikipedia path) can't find an article for a query — so search no
    longer dead-ends on anything that isn't encyclopedic (project ideas,
    jargon, business concepts). These neurons are tagged
    `origin: "ai"` and visibly labeled "AI-generated" in the info panel
    and search results, not presented as sourced fact.
  - **AI chat panel** (`components/UI/ChatPanel.tsx`) — a floating
    panel, toggled from the dock or `Ask AI about this` in a neuron's
    context menu, that sends the conversation plus (if a neuron is
    selected) its title/type/description as context to Groq.
- **Command palette** (`components/UI/CommandPalette.tsx`) — Ctrl+K /
  Cmd+K opens a modal with local neuron jump-to, "pull in from
  Wikipedia," "expand with AI," "ask AI to explain," and a recent-
  searches list (persisted to `localStorage`, same pattern as the
  existing visit-count tracking).
- **Dock** (`components/UI/Dock.tsx`) — bottom-center glass dock:
  focus search, open command palette, toggle chat.
- **Breadcrumb** (`components/UI/Breadcrumb.tsx`) — trail of the last
  8 neurons visited this session (`EngineStore.state.history`), click
  any crumb to jump back. Session-only, not persisted.
- **Context menu** (`components/UI/ContextMenu.tsx` +
  `PickingLayer.tsx`'s new `onContextMenu` handler) — right-click a
  neuron for focus / expand with AI / ask AI about it / copy title.
- **Weighted, typed AI connections** — `aiExpandTopic` reuses the same
  `GraphConnection` shape as the Wikipedia path (`type`, `weight`), so
  AI-sourced edges render with the existing signal-propagation and
  line-brightness logic, no special-casing needed in the scene layer.

### What this pass explicitly does not touch
Everything the two passes before it already flagged as not built is
still not built: no backend/persistence beyond `localStorage`, no
PDF/GitHub/video ingestion, no business/CRM mode, no multi-agent
visualization, no true self-reorganizing graph, no GPU LOD/frustum
culling. See "What's explicitly not built" further down — that list is
unchanged by this pass except where noted above.


The vision doc describes a full product: an AI ingestion pipeline that reads
anything you feed it (PDFs, repos, notes, invoices...) and automatically
turns it into neurons and typed connections, live sync with GitHub/email/
calendar, a business-CRM mode, multi-agent visualization, and a graph that
learns and reorganizes over time. That's a backend + AI system + several
integrations — realistically months of work, not something that can
honestly be handed over as one finished zip. This pass does **not** claim
to deliver that. What it does deliver is a real step toward it, scoped to
what's tractable as a frontend-only change to the existing Next.js/R3F app.

## Latest pass: unlimited live data, custom cursor, uniform field

This is the pass that makes the graph actually open-ended instead of
capped at the seed dataset, per the "neurons are useless except for show"
feedback:

- **Any search is a real neuron now** (`EngineStore.expandTopic`) — typing
  a topic that isn't already in the graph and hitting Enter (or picking
  the "Pull '<x>' in from Wikipedia" row) fetches its live Wikipedia
  summary, creates a real neuron for it, fetches its actual related pages
  (`/api/rest_v1/page/related/<title>`), creates neurons for those too,
  and wires them all up with real `similarity` connections. Nothing here
  is placeholder data — if Wikipedia has no article for the query, or the
  network call fails, that's reported (`expandError`), not papered over.
- **Traversal keeps going** — selecting a Wikipedia-sourced neuron that
  hasn't had its own neighborhood pulled in yet automatically fetches
  *its* related topics too (`select()` triggers `expandTopic` for
  under-connected wiki neurons). Practically: click into any neuron,
  click one of its connections, click one of *those* connections — the
  graph keeps growing outward for as long as Wikipedia has more to give.
  This is the actual implementation of "unlimited data," not a fixed demo
  set with a Wikipedia link bolted on.
- **The graph is now mutable at runtime** — `EngineStore.graph` went from
  a one-shot `layoutGraph()` result to something `expandTopic` pushes new
  nodes/connections into directly, plus a `graphVersion` counter so the
  R3F layers (`ParticleField`, `PickingLayer`, `NeuralConnections`, all of
  which build GPU buffers in `useMemo`) know to rebuild when it grows.
  `CameraRig` already read the graph fresh every frame, so fly-to for
  brand-new neurons needed no changes.
- **Custom cursor** (`components/UI/Cursor.tsx`) — a small ring + core
  dot in the graph's own cyan palette replaces the OS pointer everywhere
  in the app (previously only the canvas hid it), with a trailing ease on
  the ring and a hover/active state for buttons and links. Disables
  itself on touch/coarse pointers rather than drawing a desktop cursor on
  a phone.
- **More uniform field** (`lib/graph/layout.ts`) — domain cluster centers
  moved from a flat ring (`layoutGraph`'s old `angle`-only placement,
  which put everything near one equatorial plane and read as 2-3 flat
  blobs once the camera tilted) to a Fibonacci sphere distribution, so
  clusters sit evenly across the whole volume instead of clumping into a
  few corners. Live-expanded topics spawn at a randomized spherical
  position/radius for the same reason (`Store.spawnPosition`).
- **Search bar UX** — shows a spinner + "Reading '<topic>'…" while a
  Wikipedia fetch is in flight, a dedicated "pull this in" result row
  when the query doesn't match anything local, and a visible error state
  if the lookup fails, instead of silently doing nothing.

## Earlier pass: Wikipedia linking + UI sizing

- **Wikipedia** (`InfoPanel.tsx`) — when a neuron is selected, the panel
  now does a real client-side fetch to Wikipedia's public REST summary
  API (`en.wikipedia.org/api/rest_v1/page/summary/<title>`) keyed off the
  neuron's title. If an article exists, its extract and a "Read on
  Wikipedia" link are shown; if not (most of the sample dataset's
  project-internal neurons, e.g. "Renderer" or "Signal Propagation",
  won't match), the section is simply omitted — nothing is invented.
  Real topics from the AI hierarchy (Transformers, Attention, PyTorch...)
  will generally resolve. This needs outbound network access from the
  browser at runtime; it's not bundled or cached.
- **Search bar and info panel enlarged** — both were sized for a much
  smaller amount of content than they now hold. Search bar: 420px → 640px,
  14px → 17px input text, larger result rows. Info panel: 340px → 460px,
  larger max-height (480px → 720px), bigger title/body/tag type.
- Neuron click-to-inspect was already wired end to end (`PickingLayer.tsx`
  → `EngineStore.select()` → `InfoPanel`) — pointer `onClick` fires for
  touch taps as well as mouse clicks, so this covered touch already. What
  was missing was Wikipedia enrichment and adequate panel size, both
  addressed above.

## What changed in this pass

The scene used to be a purely decorative particle field: 140 cluster
centers placed by a random spiral, connected to their nearest neighbors,
with no data behind any of it — clicking did nothing, and nothing in the
field corresponded to anything real.

It's now backed by an actual graph data model and is interactive:

- **`lib/graph/`** — a real `Neuron` / `GraphConnection` data model
  (`types.ts`), a seed dataset (`sampleData.ts`), and a layout algorithm
  (`layout.ts`) that places neurons in 3D grouped by domain, with children
  nudged outward from their parents so hierarchy is faintly visible in the
  layout itself.
- **`engine/store/EngineStore.ts`** — a small dependency-free store
  (`useSyncExternalStore`, no zustand/redux) holding selection, hover,
  search query, and per-neuron visit counts (persisted to
  `localStorage` as a stand-in for the vision doc's "frequently visited
  neurons become stronger").
- **Click + hover selection** (`PickingLayer.tsx`) — an invisible picking
  layer sitting exactly on each neuron's true position, separate from the
  displaced dust cloud, so raycasting is exact.
- **Search** (`SearchBar.tsx`) — client-side keyword match over title/tags/
  type/domain. This is *not* an AI/semantic search — no model is involved,
  it's substring + prefix scoring. Selecting a result drives the same
  selection state as clicking a neuron directly.
- **Signal propagation** — selecting a neuron marks it and its direct
  connections as "active": those neurons brighten, their edges glow and
  thicken, and everything else in the field dims. This is real per-frame
  state driving the existing (previously unused) `aSignal` shader
  attribute, not a canned animation.
- **Camera fly-to** (`CameraRig.tsx`) — the camera eases from ambient idle
  drift to orbiting the selected neuron, and the field's own breathing
  rotation eases to a stop while focused so the target doesn't drift out
  from under the camera.
- **Info panel** (`InfoPanel.tsx`) — shows the selected neuron's
  description and its typed connections ("Builds on", "Cites", "Shares
  technology with"...), each clickable to jump to that neuron.

The sample dataset intentionally does **not** invent biographical content
(fake projects, employers, history). It's the vision doc's own worked
examples — the Transformers/Attention hierarchy from its "EXAMPLE"
section, plus Mnemosyne describing its own architecture (per the "PROJECT
VISUALIZATION" section) — so the graph has real, connected, searchable
content without fabricating a life story. Swap `lib/graph/sampleData.ts`
for real content once there's a source for it.

## What's explicitly not built

- **AI ingestion** — nothing reads a PDF/repo/note and extracts concepts.
  `sampleData.ts` is hand-written and is the seam a future ingestion step
  would write into.
- **Backend / persistence** — no database, no API. The graph lives in a
  static TS file; the only persisted state is visit counts in
  `localStorage`.
- **Live data** (GitHub commits, email, calendar) — not connected.
- **Business mode / CRM** — not built.
- **Multi-agent visualization** — not built.
- **True "learning" graph reorganization** — visit counts are tracked and
  nudge search ranking, but neurons don't actually migrate position or
  decay visually over time yet.

## Cleanup note

`engine/particles/`, `engine/renderer/`, and most of the rest of
`engine/` (outside the new `engine/store/EngineStore.ts`) are leftover
scaffolding from an earlier `.ps1`-generated pass — they're not imported
by `app/page.tsx` and aren't part of the running app (`components/Scene/`
is). They were left in place rather than deleted, since removing code
that wasn't asked about didn't seem right — but they're dead weight and a
likely source of confusion; worth deleting in a follow-up if they're
confirmed unused.
