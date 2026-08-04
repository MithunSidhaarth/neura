"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { cursor } from "./CursorField";
import { GROWTH_DURATION, getNeuralGraph } from "./neuralGraph";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";
import { pulseArrive, decayPulses } from "@/engine/signals/SignalManager";

const LERP = 0.08;

function createConnectionMaterial() {

    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uCursor: { value: new THREE.Vector3() },
        },
        vertexShader: `
            uniform float uTime;

            // 0.0 at one endpoint of a segment, 1.0 at the other — lets the
            // fragment shader know where along the link a given pixel sits.
            attribute float aProgress;
            attribute float aPhase;
            attribute float aSpeed;
            attribute float aDelay;

            // Selection-driven: 1 when this edge touches the selected
            // neuron, 0 otherwise. aDim fades unrelated edges into the
            // background the same way it does for neurons.
            attribute float aActive;
            attribute float aDim;

            // "Debate with AI" conflict edges: aTension is 1 on a
            // claim<->rebuttal link and 0 on every ordinary edge; aColor
            // carries each endpoint's stance color so the fragment
            // shader can render a two-tone gradient across the segment.
            attribute float aTension;
            // "Debate with AI" allied edges: aAllied is 1 on a
            // claim<->claim or rebuttal<->rebuttal link (same-side
            // neurons interlinked with each other) and 0 otherwise.
            // Shares aColor with aTension -- the two are mutually
            // exclusive per edge, so one color attribute covers both.
            attribute float aAllied;
            attribute vec3 aColor;

            varying float vProgress;
            varying float vPhase;
            varying float vSpeed;
            varying float vDelay;
            varying float vViewZ;
            varying vec3 vWorldPosition;
            varying float vActive;
            varying float vDim;
            varying float vTension;
            varying float vAllied;
            varying vec3 vColor;

            void main() {

                vProgress = aProgress;
                vPhase = aPhase;
                vSpeed = aSpeed;
                vDelay = aDelay;
                vActive = aActive;
                vDim = aDim;
                vTension = aTension;
                vAllied = aAllied;
                vColor = aColor;

                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewZ = -mvPosition.z;

                gl_Position = projectionMatrix * mvPosition;

            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uCursor;

            varying float vProgress;
            varying float vPhase;
            varying float vSpeed;
            varying float vDelay;
            varying float vViewZ;
            varying vec3 vWorldPosition;
            varying float vActive;
            varying float vDim;
            varying float vTension;
            varying float vAllied;
            varying vec3 vColor;

            const vec3 LINK_COLOR = vec3(0.32, 0.42, 0.52);
            const vec3 SIGNAL_COLOR = vec3(0.75, 0.95, 1.0);
            const vec3 ACTIVE_COLOR = vec3(0.85, 0.98, 1.0);

            void main() {

                // --- Growth: reveal the link from one end to the other ---
                float growth = clamp((uTime - vDelay) / ${GROWTH_DURATION.toFixed(1)}, 0.0, 1.0);

                if (vProgress > growth) discard;

                // Soft bright leading edge as the connection grows outward.
                float leadingEdge = smoothstep(0.12, 0.0, growth - vProgress);

                // --- Slow overall pulsing (Phase 3) ---
                float breathe = sin(uTime * 0.6 + vPhase) * 0.5 + 0.5;
                float baseAlpha = 0.10 + breathe * 0.10;

                // --- Traveling signal pulse (Phase 4) ---
                float travel = fract(uTime * vSpeed * 0.5 + vPhase * 0.159);
                float d = abs(fract(vProgress - travel + 0.5) - 0.5);
                float signal = smoothstep(0.05, 0.0, d);

                // --- Cursor proximity glow ---
                float cursorDist = length(uCursor - vWorldPosition);
                float cursorGlow = smoothstep(4.0, 0.0, cursorDist) * 0.5;

                vec3 color = mix(LINK_COLOR, SIGNAL_COLOR, clamp(signal + cursorGlow, 0.0, 1.0));
                color += SIGNAL_COLOR * leadingEdge * 0.8;
                color = mix(color, ACTIVE_COLOR, vActive * 0.7);

                float alpha = baseAlpha + signal * 0.6 + leadingEdge * 0.5 + cursorGlow * 0.3;
                alpha += vActive * 0.5;

                // --- Conflict edges (Debate with AI): crackling two-tone
                // gradient between the claim/rebuttal colors, with a
                // strobing white-hot flashpoint where the two sides meet
                // at the midpoint. ---
                if (vTension > 0.5) {
                    float crackleA = sin(vProgress * 40.0 + uTime * 14.0) * 0.5 + 0.5;
                    float crackleB = sin(vProgress * 17.0 - uTime * 9.0) * 0.5 + 0.5;
                    float crackle = crackleA * crackleB;

                    float distFromMid = abs(vProgress - 0.5);
                    float flashpoint = smoothstep(0.16, 0.0, distFromMid);
                    float strobe = sin(uTime * 22.0) * 0.5 + 0.5;

                    vec3 conflictColor = mix(color, vColor, 0.85);
                    conflictColor += vColor * crackle * 0.5;
                    conflictColor = mix(conflictColor, vec3(1.0), flashpoint * strobe * 0.9);

                    color = conflictColor;
                    alpha += flashpoint * strobe * 0.6 + crackle * 0.15;
                } else if (vAllied > 0.5) {
                    // Same-side "Debate with AI" link (claim<->claim or
                    // rebuttal<->rebuttal): a steady tint in that side's
                    // stance color plus a gentle in-phase shimmer, but
                    // no strobe/flashpoint -- these neurons agree, so
                    // the edge should read as calm affinity rather than
                    // the crackling tension of a "conflict" edge.
                    float shimmer = sin(vProgress * 10.0 + uTime * 1.6) * 0.5 + 0.5;

                    vec3 alliedColor = mix(color, vColor, 0.65);
                    alliedColor += vColor * shimmer * 0.18;

                    color = alliedColor;
                    alpha += 0.18 + shimmer * 0.1;
                }

                // Depth fade, matching the neuron field's atmospheric falloff.
                float depthFadeOut = 1.0 - smoothstep(150.0, 350.0, vViewZ);
                float cameraFadeIn = smoothstep(1.0, 20.0, vViewZ);
                alpha *= depthFadeOut * cameraFadeIn;

                // Selection dim, same treatment as neurons.
                alpha *= mix(0.08, 1.0, vDim);

                gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));

                #include <tonemapping_fragment>
                #include <colorspace_fragment>

            }
        `,
    });

}

export default function NeuralConnections() {

    const ref = useRef<THREE.LineSegments>(null);
    const { graphVersion } = useEngineState();

    const material = useMemo(() => createConnectionMaterial(), []);

    useEffect(() => {
        return () => {
            material.dispose();
        };
    }, [material]);

    const { positions, progress, phase, speed, delay, active, dim, tension, allied, edgeColor, edgeIds, edgeMeta } = useMemo(() => {

        const { connections } = getNeuralGraph();

        const posArray = new Float32Array(connections.length * 2 * 3);
        const progressArray = new Float32Array(connections.length * 2);
        const phaseArray = new Float32Array(connections.length * 2);
        const speedArray = new Float32Array(connections.length * 2);
        const delayArray = new Float32Array(connections.length * 2);
        const activeArray = new Float32Array(connections.length * 2);
        const dimArray = new Float32Array(connections.length * 2).fill(1);
        const tensionArray = new Float32Array(connections.length * 2);
        const alliedArray = new Float32Array(connections.length * 2);
        const colorArray = new Float32Array(connections.length * 2 * 3);
        const ids = connections.map((c) => [c.fromId, c.toId] as [string, string]);
        const meta = connections.map((c) => ({
            fromId: c.fromId,
            toId: c.toId,
            phase: c.phase,
            speed: c.speed,
            weight: c.weight,
        }));

        connections.forEach((c, i) => {

            const base = i * 6;

            posArray[base] = c.a.x;
            posArray[base + 1] = c.a.y;
            posArray[base + 2] = c.a.z;

            posArray[base + 3] = c.b.x;
            posArray[base + 4] = c.b.y;
            posArray[base + 5] = c.b.z;

            const vBase = i * 2;

            progressArray[vBase] = 0;
            progressArray[vBase + 1] = 1;

            phaseArray[vBase] = c.phase;
            phaseArray[vBase + 1] = c.phase;

            speedArray[vBase] = c.speed;
            speedArray[vBase + 1] = c.speed;

            delayArray[vBase] = c.delay;
            delayArray[vBase + 1] = c.delay;

            tensionArray[vBase] = c.conflict ? 1 : 0;
            tensionArray[vBase + 1] = c.conflict ? 1 : 0;

            alliedArray[vBase] = c.allied ? 1 : 0;
            alliedArray[vBase + 1] = c.allied ? 1 : 0;

            if ((c.conflict || c.allied) && c.fromColor && c.toColor) {
                colorArray[base] = c.fromColor.r;
                colorArray[base + 1] = c.fromColor.g;
                colorArray[base + 2] = c.fromColor.b;

                colorArray[base + 3] = c.toColor.r;
                colorArray[base + 4] = c.toColor.g;
                colorArray[base + 5] = c.toColor.b;
            }

        });

        return {
            positions: posArray,
            progress: progressArray,
            phase: phaseArray,
            speed: speedArray,
            delay: delayArray,
            active: activeArray,
            dim: dimArray,
            tension: tensionArray,
            allied: alliedArray,
            edgeColor: colorArray,
            edgeIds: ids,
            edgeMeta: meta,
        };

    }, [graphVersion]);

    const lastTravel = useRef<Float32Array | null>(null);

    useFrame(({ clock }, delta) => {

        const t = clock.elapsedTime;
        material.uniforms.uTime.value = t;
        material.uniforms.uCursor.value.copy(cursor);

        const { selectedId } = engineStore.getState();
        const hasSelection = selectedId !== null;
        const queryMatches = !hasSelection ? engineStore.queryMatchIds() : null;
        const hasQueryHighlight = !!queryMatches && queryMatches.size > 0;

        const geom = ref.current?.geometry;
        if (!geom) return;

        const activeAttr = geom.getAttribute("aActive") as THREE.BufferAttribute;
        const dimAttr = geom.getAttribute("aDim") as THREE.BufferAttribute;

        // Mirrors the shader's `travel` calculation so arrivals can be
        // detected on the CPU side and fed to SignalManager -- this stays
        // purely additive to the existing visual (the shader doesn't read
        // any of this back), it just lets ParticleField know when to flash.
        if (!lastTravel.current || lastTravel.current.length !== edgeMeta.length) {
            lastTravel.current = new Float32Array(edgeMeta.length).fill(-1);
        }
        const prevTravel = lastTravel.current;

        edgeMeta.forEach((edge, i) => {
            const travel = ((t * edge.speed * 0.5 + edge.phase * 0.159) % 1 + 1) % 1;
            const prev = prevTravel[i];
            // A wraparound (travel dropping back near 0 after being near 1)
            // means the pulse just completed its run and landed on `toId`.
            if (prev >= 0 && travel < prev) {
                pulseArrive(edge.toId, 0.5 + edge.weight * 0.5);
            }
            prevTravel[i] = travel;
        });
        decayPulses(delta);

        edgeIds.forEach(([fromId, toId], i) => {
            const touchesSelection = fromId === selectedId || toId === selectedId;
            let targetActive: number;
            let targetDim: number;

            if (hasSelection) {
                targetActive = touchesSelection ? 1 : 0;
                targetDim = touchesSelection ? 1 : 0.2;
            } else if (hasQueryHighlight) {
                const touchesQuery = queryMatches!.has(fromId) || queryMatches!.has(toId);
                targetActive = touchesQuery ? 1 : 0;
                targetDim = touchesQuery ? 1 : 0.2;
            } else {
                targetActive = 0;
                targetDim = 1;
            }

            const vBase = i * 2;
            for (let k = 0; k < 2; k++) {
                const idx = vBase + k;
                active[idx] += (targetActive - active[idx]) * LERP;
                dim[idx] += (targetDim - dim[idx]) * LERP;
            }
        });

        activeAttr.array.set(active);
        activeAttr.needsUpdate = true;
        dimAttr.array.set(dim);
        dimAttr.needsUpdate = true;

    });

    return (

        <lineSegments
            key={graphVersion}
            ref={ref}
            frustumCulled={false}
        >

            <bufferGeometry>

                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                    array={positions}
                    count={positions.length / 3}
                    itemSize={3}
                />

                <bufferAttribute
                    attach="attributes-aProgress"
                    args={[progress, 1]}
                    array={progress}
                    count={progress.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aPhase"
                    args={[phase, 1]}
                    array={phase}
                    count={phase.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aSpeed"
                    args={[speed, 1]}
                    array={speed}
                    count={speed.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aDelay"
                    args={[delay, 1]}
                    array={delay}
                    count={delay.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aActive"
                    args={[active, 1]}
                    array={active}
                    count={active.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aDim"
                    args={[dim, 1]}
                    array={dim}
                    count={dim.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aTension"
                    args={[tension, 1]}
                    array={tension}
                    count={tension.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aAllied"
                    args={[allied, 1]}
                    array={allied}
                    count={allied.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aColor"
                    args={[edgeColor, 3]}
                    array={edgeColor}
                    count={edgeColor.length / 3}
                    itemSize={3}
                />

            </bufferGeometry>

            <primitive
                object={material}
                attach="material"
            />

        </lineSegments>

    );

}
