"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Slow-moving aurora curtains wrapped around the scene, sitting just
// outside NebulaLayer's cloud sphere. Where NebulaLayer reads as diffuse
// cloud, this reads as banded, directional motion -- the sky doing
// something rather than just being tinted -- which is the point: an
// empty stretch of the graph should still feel alive to fly through, not
// static. Palette stays inside the project's existing rule (graphite,
// blue, cyan, silver -- no purple, nothing saturated); the "aurora" read
// comes from the teal-green band, not from going neon.
const RADIUS = 150;

function createAuroraMaterial() {
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

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                    f.y
                );
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 4; i++) {
                    v += a * noise(p);
                    p *= 2.05;
                    a *= 0.5;
                }
                return v;
            }

            // Graphite/blue/cyan palette, plus one muted teal-green stop --
            // enough to read as "aurora" without breaking the no-neon rule.
            const vec3 CURTAIN_A = vec3(0.07, 0.20, 0.20);
            const vec3 CURTAIN_B = vec3(0.16, 0.46, 0.50);
            const vec3 CURTAIN_C = vec3(0.55, 0.86, 0.80);

            void main() {
                vec3 dir = normalize(vPos);
                float elevation = dir.y;
                float angle = atan(dir.z, dir.x);

                // Curtains live in a soft band above the "horizon" and fade
                // out before the zenith -- structured motion overhead,
                // not a uniform tint across the whole sphere.
                float band = smoothstep(-0.05, 0.35, elevation) * (1.0 - smoothstep(0.7, 1.0, elevation));

                vec2 p = vec2(angle * 2.4, elevation * 2.6 + uTime * 0.05);
                float ripple = fbm(p + vec2(uTime * 0.035, 0.0));
                float curtain = smoothstep(0.36, 0.78, ripple) * band;

                float fine = fbm(p * 2.4 - vec2(uTime * 0.09, 0.0));
                float shimmer = smoothstep(0.55, 0.92, fine) * curtain;

                vec3 color = mix(CURTAIN_A, CURTAIN_B, curtain);
                color = mix(color, CURTAIN_C, shimmer * 0.75);

                float alpha = curtain * 0.15 + shimmer * 0.12;

                gl_FragColor = vec4(color, alpha);

                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    });
}

export default function AuroraLayer() {

    const ref = useRef<THREE.Mesh>(null);
    const material = useMemo(() => createAuroraMaterial(), []);
    const geometry = useMemo(() => new THREE.SphereGeometry(RADIUS, 32, 32), []);

    useEffect(() => {
        return () => {
            material.dispose();
            geometry.dispose();
        };
    }, [material, geometry]);

    useFrame(({ clock }) => {
        material.uniforms.uTime.value = clock.elapsedTime;
        if (!ref.current) return;
        // Slightly faster and opposite direction from NebulaLayer's drift
        // so the two layers don't lock-step -- reads as independent depth.
        ref.current.rotation.y = -clock.elapsedTime * 0.0025;
    });

    return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
