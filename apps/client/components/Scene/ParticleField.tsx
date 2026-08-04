"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createNeuronMaterial } from "./NeuronMaterial";
import { cursor } from "./CursorField";
import { getNeuralGraph } from "./neuralGraph";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";
import { getPulse } from "@/engine/signals/SignalManager";

export let neuronPositions: Float32Array | null = null;

const LERP = 0.08; // per-frame ease toward target signal/dim, ~a few frames to settle

// One GPU point per *neuron*, sitting exactly on its real graph position --
// not a scattered dust cloud per neuron. The previous version spent its
// entire particle budget (15,000 points) scattering a gaussian blob around
// each neuron's position, which is why a neuron with a handful of
// connections rendered as a fuzzy star cluster instead of a single
// readable node: with a few dozen neurons in the graph, that's a few
// hundred particles per neuron overlapping into one blob, and the whole
// field read as a handful of dense clumps instead of a sparse, legible
// spider web. Ambient "there's a universe out here" density still comes
// from DustLayer/BackgroundStars, which are unrelated decorative layers --
// this one is the actual graph, so its particle count == neuron count.
export default function ParticleField() {

    const ref = useRef<THREE.Points>(null);
    const { graphVersion } = useEngineState();

    const material = useMemo(
        () => createNeuronMaterial(),
        []
    );

    // Dispose the shader material on unmount to avoid leaking GPU resources
    // across hot reloads / route changes.
    useEffect(() => {
        return () => {
            material.dispose();
        };
    }, [material]);

    const { positions, signals, dims, sizes, clusterIds } = useMemo(() => {

        const { clusters, connections } = getNeuralGraph();
        const count = clusters.length;

        const array = new Float32Array(count * 3);
        const signalArray = new Float32Array(count);
        const dimArray = new Float32Array(count).fill(1);
        // Baseline of 1.6 rather than 1 -- neurons are the actual graph
        // content and should read as clearly larger than the decorative
        // BackgroundStars field even before any importance bonus is
        // applied. See NeuronMaterial.ts for the matching baseSize bump.
        // Bumped 3.6 -> 4.2 alongside the NeuronMaterial point-size floor/
        // depth-fade fix, so individual neurons stay legibly separate dots
        // even when the camera is pulled all the way out.
        const NEURON_BASE_SIZE = 4.2;
        const sizeArray = new Float32Array(count).fill(NEURON_BASE_SIZE);

        // Dynamic sizing based on importance: how many connections touch
        // each neuron. A hub concept (lots of edges) should read as a
        // bigger, more prominent node than a leaf.
        const degree = new Map<string, number>();
        connections.forEach((c) => {
            degree.set(c.fromId, (degree.get(c.fromId) ?? 0) + 1);
            degree.set(c.toId, (degree.get(c.toId) ?? 0) + 1);
        });

        clusters.forEach((cluster, i) => {
            array[i * 3] = cluster.position.x;
            array[i * 3 + 1] = cluster.position.y;
            array[i * 3 + 2] = cluster.position.z;
            signalArray[i] = 0;

            const d = degree.get(cluster.id) ?? 0;
            // sqrt so a handful of extra edges doesn't blow a node up --
            // it should read as "a bit more important," not dominate the
            // field.
            sizeArray[i] = NEURON_BASE_SIZE + Math.min(Math.sqrt(d), 5) * 0.5;
        });

        neuronPositions = array;

        return {
            positions: array,
            signals: signalArray,
            dims: dimArray,
            sizes: sizeArray,
            clusterIds: clusters.map((c) => c.id),
        };

    }, [graphVersion]);

    useFrame(({ clock }) => {

        material.uniforms.uTime.value = clock.elapsedTime;
        material.uniforms.uCursor.value.copy(cursor);

        // Drive per-neuron signal/dim toward this frame's target based on
        // the current selection. Selected neuron + its direct connections
        // ("1-hop neighborhood") glow; everything else dims slightly when a
        // selection exists, and returns to full ambient brightness when it
        // doesn't -- this is what makes search/click feel like it's waking
        // up part of the graph rather than just highlighting a dot.
        const { selectedId } = engineStore.getState();
        const active = engineStore.activeNeuronIds();
        const hasSelection = selectedId !== null;
        const queryMatches = !hasSelection ? engineStore.queryMatchIds() : null;
        const hasQueryHighlight = !!queryMatches && queryMatches.size > 0;

        const geom = ref.current?.geometry;
        if (!geom) return;

        const signalAttr = geom.getAttribute("aSignal") as THREE.BufferAttribute;
        const dimAttr = geom.getAttribute("aDim") as THREE.BufferAttribute;

        for (let i = 0; i < clusterIds.length; i++) {
            const id = clusterIds[i];
            const isActive = active.has(id);
            const isSelected = id === selectedId;
            const isQueryMatch = queryMatches?.has(id) ?? false;

            let targetSignal: number;
            let targetDim: number;

            if (hasSelection) {
                targetSignal = isSelected ? 1 : isActive ? 0.55 : 0;
                targetDim = isActive ? 1 : 0.15;
            } else if (hasQueryHighlight) {
                targetSignal = isQueryMatch ? 0.85 : 0;
                targetDim = isQueryMatch ? 1 : 0.15;
            } else {
                targetSignal = 0;
                targetDim = 1;
            }

            // A pulse that just arrived at this node briefly overrides the
            // baseline signal regardless of selection state -- it should
            // read as "something just landed here" even while dimmed.
            targetSignal = Math.max(targetSignal, getPulse(id));

            signals[i] += (targetSignal - signals[i]) * LERP;
            dims[i] += (targetDim - dims[i]) * LERP;
        }

        signalAttr.array.set(signals);
        signalAttr.needsUpdate = true;
        dimAttr.array.set(dims);
        dimAttr.needsUpdate = true;

    });

    return (

        <points
            key={graphVersion}
            ref={ref}
            frustumCulled={false}
        >

            <bufferGeometry>

                <bufferAttribute
                    attach="attributes-position"
                    array={positions}
                    count={positions.length / 3}
                    itemSize={3}
                />

                <bufferAttribute
                    attach="attributes-aSignal"
                    array={signals}
                    count={signals.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aDim"
                    array={dims}
                    count={dims.length}
                    itemSize={1}
                />

                <bufferAttribute
                    attach="attributes-aSize"
                    array={sizes}
                    count={sizes.length}
                    itemSize={1}
                />

            </bufferGeometry>

            <primitive
                object={material}
                attach="material"
            />

        </points>

    );

}
