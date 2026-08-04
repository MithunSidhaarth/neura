"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const METEOR_COUNT = 3;
const TRAIL_POINTS = 8;
const FIELD_RADIUS = 140;

interface MeteorState {
    active: boolean;
    t: number;
    duration: number;
    delay: number;
    start: THREE.Vector3;
    end: THREE.Vector3;
}

function randomSkyPoint(): THREE.Vector3 {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return new THREE.Vector3(
        FIELD_RADIUS * Math.sin(phi) * Math.cos(theta),
        FIELD_RADIUS * Math.sin(phi) * Math.sin(theta),
        FIELD_RADIUS * Math.cos(phi)
    );
}

// Occasional streaks across the far background. Purely atmospheric --
// no interaction, no meaning -- but an unexplored stretch of the graph
// should still feel like something is happening out there, the way a
// real night sky rewards patient watching instead of sitting dead still.
export default function ShootingStars() {

    const meteors = useMemo<MeteorState[]>(
        () =>
            Array.from({ length: METEOR_COUNT }, () => ({
                active: false,
                t: 0,
                duration: 1.1 + Math.random() * 0.6,
                delay: Math.random() * 12,
                start: new THREE.Vector3(),
                end: new THREE.Vector3(),
            })),
        []
    );

    const geometries = useMemo(() => meteors.map(() => new THREE.BufferGeometry()), [meteors]);

    const materials = useMemo(
        () =>
            meteors.map(
                () =>
                    new THREE.LineBasicMaterial({
                        color: new THREE.Color("#cfe8f2"),
                        transparent: true,
                        opacity: 0,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                    })
            ),
        [meteors]
    );

    const lines = useMemo(
        () => meteors.map((_, i) => new THREE.Line(geometries[i], materials[i])),
        [meteors, geometries, materials]
    );

    useEffect(() => {
        return () => {
            geometries.forEach((g) => g.dispose());
            materials.forEach((m) => m.dispose());
        };
    }, [geometries, materials]);

    useFrame((_, delta) => {
        meteors.forEach((m, i) => {
            const geom = geometries[i];
            const mat = materials[i];

            if (!m.active) {
                m.delay -= delta;
                if (m.delay <= 0) {
                    m.active = true;
                    m.t = 0;
                    m.start.copy(randomSkyPoint());
                    const dir = new THREE.Vector3(
                        Math.random() - 0.5,
                        (Math.random() - 0.5) * 0.3 - 0.2,
                        Math.random() - 0.5
                    ).normalize();
                    m.end.copy(m.start).addScaledVector(dir, 26 + Math.random() * 18);
                }
                return;
            }

            m.t += delta / m.duration;
            if (m.t >= 1) {
                m.active = false;
                m.delay = 6 + Math.random() * 16;
                mat.opacity = 0;
                return;
            }

            const headT = m.t;
            const tailT = Math.max(0, m.t - 0.18);
            const positions = new Float32Array(TRAIL_POINTS * 3);
            for (let p = 0; p < TRAIL_POINTS; p++) {
                const tt = tailT + ((headT - tailT) * p) / (TRAIL_POINTS - 1);
                const pos = m.start.clone().lerp(m.end, tt);
                positions[p * 3] = pos.x;
                positions[p * 3 + 1] = pos.y;
                positions[p * 3 + 2] = pos.z;
            }
            geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geom.attributes.position.needsUpdate = true;

            const fadeIn = Math.min(1, m.t / 0.15);
            const fadeOut = Math.min(1, (1 - m.t) / 0.25);
            mat.opacity = Math.min(fadeIn, fadeOut) * 0.85;
        });
    });

    return (
        <group>
            {lines.map((line, i) => (
                <primitive key={i} object={line} frustumCulled={false} />
            ))}
        </group>
    );
}
