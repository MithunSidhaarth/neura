"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getSoftCircleTexture } from "./sprites";

const STAR_COUNT = 80000;
const STAR_RADIUS = 180;

// A handful of real star tints (cool blue-white giants, warm yellow/orange
// dwarfs, the occasional reddish star) mixed by weight so the field reads
// as a real sky's color variety rather than one uniform blue-grey haze.
const STAR_TINTS: [THREE.Color, number][] = [
    [new THREE.Color("#bcd7ff"), 0.22], // hot blue-white
    [new THREE.Color("#eaf2ff"), 0.34], // white
    [new THREE.Color("#fff4e0"), 0.22], // warm white
    [new THREE.Color("#ffd9a0"), 0.14], // yellow-orange
    [new THREE.Color("#ffb38a"), 0.08], // reddish
];

function pickTint(): THREE.Color {
    const r = Math.random();
    let acc = 0;
    for (const [color, weight] of STAR_TINTS) {
        acc += weight;
        if (r <= acc) return color;
    }
    return STAR_TINTS[0][0];
}

function createStarMaterial(map: THREE.Texture | undefined) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uMap: { value: map ?? null },
        },
        vertexShader: `
            attribute float aSize;
            attribute vec3 aColor;
            attribute float aBrightness;
            attribute float aTwinklePhase;
            attribute float aTwinkleSpeed;

            uniform float uTime;

            varying vec3 vColor;
            varying float vBrightness;
            varying float vFade;

            void main() {
                vColor = aColor;

                // Twinkle: each star oscillates brightness on its own phase
                // and speed rather than in lockstep, so the field flickers
                // like a real sky instead of pulsing as one block.
                float twinkle = 0.65 + 0.35 * sin(uTime * aTwinkleSpeed + aTwinklePhase);
                vBrightness = aBrightness * twinkle;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                // Depth: farther stars (more negative mvPosition.z) get both
                // a smaller screen size (standard perspective attenuation)
                // and a slight extra dimming, so distance reads as more than
                // just "smaller dot" -- it reads as "fainter, further away."
                float dist = -mvPosition.z;
                vFade = clamp(1.0 - (dist / 260.0) * 0.5, 0.35, 1.0);

                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = aSize * (300.0 / dist);
            }
        `,
        fragmentShader: `
            uniform sampler2D uMap;
            varying vec3 vColor;
            varying float vBrightness;
            varying float vFade;

            void main() {
                vec4 tex = texture2D(uMap, gl_PointCoord);
                float alpha = tex.a * vBrightness * vFade;
                gl_FragColor = vec4(vColor * vBrightness, alpha);
            }
        `,
    });
}

export default function BackgroundStars() {
    const pointsRef = useRef<THREE.Points>(null!);

    const { positions, sizes, colors, brightness, twinklePhase, twinkleSpeed } = useMemo(() => {
        const positions = new Float32Array(STAR_COUNT * 3);
        const sizes = new Float32Array(STAR_COUNT);
        const colors = new Float32Array(STAR_COUNT * 3);
        const brightness = new Float32Array(STAR_COUNT);
        const twinklePhase = new Float32Array(STAR_COUNT);
        const twinkleSpeed = new Float32Array(STAR_COUNT);

        for (let i = 0; i < STAR_COUNT; i++) {
            // Depth: sample radius with a bias toward the outer shell (sqrt
            // distribution) so most stars sit far away like a real sky, with
            // a sparser sprinkling of "near" stars in front.
            const r = STAR_RADIUS * (0.35 + 0.65 * Math.sqrt(Math.random()));
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Size: mostly small, with a rare bright/large outlier -- a
            // squared random skews the distribution toward the small end.
            const sizeRoll = Math.random();
            sizes[i] = 0.4 + Math.pow(sizeRoll, 3) * 3.2;

            const tint = pickTint();
            colors[i * 3] = tint.r;
            colors[i * 3 + 1] = tint.g;
            colors[i * 3 + 2] = tint.b;

            brightness[i] = 0.3 + Math.random() * 0.85;
            twinklePhase[i] = Math.random() * Math.PI * 2;
            twinkleSpeed[i] = 0.3 + Math.random() * 1.7;
        }

        return { positions, sizes, colors, brightness, twinklePhase, twinkleSpeed };
    }, []);

    const material = useMemo(() => createStarMaterial(getSoftCircleTexture()), []);

    useFrame(({ clock }) => {
        if (!pointsRef.current) return;

        const t = clock.getElapsedTime();

        material.uniforms.uTime.value = t;

        pointsRef.current.rotation.y = t * 0.0015;
        pointsRef.current.rotation.x = Math.sin(t * 0.02) * 0.01;
        pointsRef.current.rotation.z = Math.cos(t * 0.015) * 0.01;
    });

    return (
        <points ref={pointsRef} material={material} frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                    array={positions}
                    count={positions.length / 3}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-aSize"
                    args={[sizes, 1]}
                    array={sizes}
                    count={sizes.length}
                    itemSize={1}
                />
                <bufferAttribute
                    attach="attributes-aColor"
                    args={[colors, 3]}
                    array={colors}
                    count={colors.length / 3}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-aBrightness"
                    args={[brightness, 1]}
                    array={brightness}
                    count={brightness.length}
                    itemSize={1}
                />
                <bufferAttribute
                    attach="attributes-aTwinklePhase"
                    args={[twinklePhase, 1]}
                    array={twinklePhase}
                    count={twinklePhase.length}
                    itemSize={1}
                />
                <bufferAttribute
                    attach="attributes-aTwinkleSpeed"
                    args={[twinkleSpeed, 1]}
                    array={twinkleSpeed}
                    count={twinkleSpeed.length}
                    itemSize={1}
                />
            </bufferGeometry>
        </points>
    );
}
