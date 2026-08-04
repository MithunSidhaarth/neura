"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// A large sphere surrounding the whole scene, rendered from the inside
// (BackSide) with a soft noise-based cloud pattern. Previously capped at
// ~5% max alpha ("almost invisible, adds depth, not a visible skybox") --
// that reading doesn't match "pretty nebula" on the checklist, so this
// pass opens it up: two octave scales of fbm (broad cloud shape + finer
// wispy detail), a third brighter color stop for visible highlights where
// clouds overlap, and roughly 4x the alpha ceiling. Palette stays within
// the project's existing rule (graphite/blue/cyan, no purple, nothing
// saturated) -- "pretty" here means visible structure and depth, not a
// color change.
const RADIUS = 130;

function createNebulaMaterial() {

    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
        },
        vertexShader: `
            varying vec3 vPos;

            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec3 vPos;

            float hash(vec3 p) {
                return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
            }

            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(
                        mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
                        mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
                        mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.55;
                for (int i = 0; i < 4; i++) {
                    value += amplitude * noise(p);
                    p *= 2.02;
                    amplitude *= 0.5;
                }
                return value;
            }

            // Deep-space graphite/blue-cyan palette — no purple, no saturated color.
            const vec3 COLOR_A = vec3(0.05, 0.07, 0.10);
            const vec3 COLOR_B = vec3(0.12, 0.22, 0.30);
            const vec3 COLOR_C = vec3(0.30, 0.52, 0.62); // bright wisp highlight

            void main() {

                vec3 dir = normalize(vPos);

                // Broad cloud shape.
                float base = fbm(dir * 2.2 + vec3(0.0, uTime * 0.004, uTime * 0.003));
                float density = smoothstep(0.38, 0.80, base);

                // Finer wispy detail layered on top at a different drift
                // rate so it doesn't lock-step with the broad shape.
                float fine = fbm(dir * 5.5 + vec3(uTime * -0.006, uTime * 0.008, 0.0));
                float wisp = smoothstep(0.55, 0.85, fine) * density;

                vec3 color = mix(COLOR_A, COLOR_B, density);
                color = mix(color, COLOR_C, wisp * 0.6);

                // Opened up from the previous 0.05 ceiling so the clouds
                // actually read against the black background instead of
                // just tinting it.
                float alpha = density * 0.22 + wisp * 0.16;

                gl_FragColor = vec4(color, alpha);

                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    });

}

export default function NebulaLayer() {

    const ref = useRef<THREE.Mesh>(null);

    const material = useMemo(() => createNebulaMaterial(), []);
    const geometry = useMemo(() => new THREE.SphereGeometry(RADIUS, 32, 32), []);

    useEffect(() => {
        return () => {
            material.dispose();
            geometry.dispose();
        };
    }, [material, geometry]);

    useFrame(({ clock }) => {

        material.uniforms.uTime.value = clock.elapsedTime;

        if (!ref.current)
            return;

        // Extremely slow drift — this layer should feel static at a glance.
        ref.current.rotation.y = clock.elapsedTime * 0.001;

    });

    return (
        <mesh
            ref={ref}
            geometry={geometry}
            material={material}
            frustumCulled={false}
        />
    );

}
