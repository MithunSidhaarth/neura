"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import BackgroundStars from "./BackgroundStars";
import DustLayer from "./DustLayer";
import ParticleField from "./ParticleField";
import NeuralConnections from "./NeuralConnections";
import ForegroundLayer from "./ForegroundLayer";
import NebulaLayer from "./NebulaLayer";
import AuroraLayer from "./AuroraLayer";
import ShootingStars from "./ShootingStars";
import PickingLayer from "./PickingLayer";
import { engineStore } from "@/engine/store/EngineStore";

export default function LayeredUniverse() {

    // ParticleField and NeuralConnections share this group so the breathing
    // drift/rotation is applied once and both layers move together — if each
    // applied its own rotation independently, the connection lines would
    // slowly drift away from the neuron clusters they're supposed to link.
    const coreRef = useRef<THREE.Group>(null);

    // The cluster layout is flat in the XZ plane with very little vertical
    // spread. The camera sits on the Z axis looking straight down it, which
    // means edge-on = a flat white line with no visible depth or structure.
    // A fixed base tilt turns "looking into the disc" into "looking down at
    // the galaxy from an angle," which is what actually reveals the arms and
    // clusters instead of collapsing them onto one screen row.
    const BASE_TILT_X = THREE.MathUtils.degToRad(-52);

    // Accumulated rotation (rather than a pure function of elapsed time) so
    // that easing the drift speed toward zero doesn't jump the group to a
    // different angle -- it just slows down and stops wherever it is.
    const rotYRef = useRef(0);
    const driftRef = useRef(1);

    useFrame(({ clock }, delta) => {

        if (!coreRef.current)
            return;

        const t = clock.elapsedTime;

        // While a neuron is selected, CameraRig flies to and orbits its
        // (local-space) position. If this group kept drifting, the neuron
        // would slide out from under the camera. Easing the drift to a
        // stop when something is focused keeps local space ≈ world space
        // for as long as the camera is relying on it.
        const { selectedId } = engineStore.getState();
        const targetDrift = selectedId ? 0 : 1;
        driftRef.current += (targetDrift - driftRef.current) * 0.05;

        rotYRef.current += 0.02 * delta * driftRef.current;

        coreRef.current.rotation.y = rotYRef.current;
        coreRef.current.rotation.x = BASE_TILT_X + Math.sin(t * 0.10) * 0.03 * driftRef.current;
        coreRef.current.rotation.z = Math.sin(t * 0.15) * 0.03 * driftRef.current;

        coreRef.current.position.y = Math.sin(t * 0.25) * 0.15 * driftRef.current;
        coreRef.current.position.x = Math.cos(t * 0.18) * 0.08 * driftRef.current;
        coreRef.current.position.z = Math.sin(t * 0.12) * 0.05 * driftRef.current;

    });

    return (
        <>
            <NebulaLayer />
            <AuroraLayer />
            <BackgroundStars />
            <ShootingStars />
            <DustLayer />
            <group ref={coreRef}>
                <ParticleField />
                <NeuralConnections />
                <PickingLayer />
            </group>
            <ForegroundLayer />
        </>
    );
}
