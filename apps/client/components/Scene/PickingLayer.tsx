"use client";

import { ThreeEvent, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getNeuralGraph } from "./neuralGraph";
import { engineStore, useEngineState } from "@/engine/store/EngineStore";
import { cameraDragState } from "@/engine/camera/dragState";

// An invisible points layer sitting exactly on each neuron's center,
// separate from the 15k-particle dust cloud. Raycasting against the dust
// (which is displaced per-vertex on the GPU, not the CPU-side positions)
// would be unreliable; this gives click/hover a stable, exact target per
// neuron regardless of how the visual field is displaced.
export default function PickingLayer() {

    const { raycaster } = useThree();
    const ref = useRef<THREE.Points>(null);
    const { graphVersion } = useEngineState();

    useEffect(() => {
        raycaster.params.Points = { threshold: 0.9 };
    }, [raycaster]);

    const { positions, ids } = useMemo(() => {
        const { clusters } = getNeuralGraph();
        const array = new Float32Array(clusters.length * 3);
        clusters.forEach((c, i) => {
            array[i * 3] = c.position.x;
            array[i * 3 + 1] = c.position.y;
            array[i * 3 + 2] = c.position.z;
        });
        return { positions: array, ids: clusters.map((c) => c.id) };
    }, [graphVersion]);

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (e.index === undefined) return;
        engineStore.hover(ids[e.index]);
    };

    const handlePointerOut = () => {
        engineStore.hover(null);
    };

    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        // A camera drag (orbit/pan) that happens to end on top of a neuron
        // shouldn't also select it -- only a genuine click does.
        if (cameraDragState.consumeWasDrag()) return;
        if (e.index === undefined) return;
        engineStore.select(ids[e.index]);
    };

    const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        e.nativeEvent.preventDefault();
        if (cameraDragState.consumeWasDrag()) return;
        if (e.index === undefined) return;
        engineStore.openContextMenu(ids[e.index], e.nativeEvent.clientX, e.nativeEvent.clientY);
    };

    return (
        <points
            key={graphVersion}
            ref={ref}
            onPointerMove={handlePointerMove}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    array={positions}
                    count={positions.length / 3}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={1.4}
                transparent
                opacity={0}
                depthWrite={false}
                sizeAttenuation
            />
        </points>
    );
}
