"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
// The Core is the one thing in the scene that isn't a neuron: a permanent
// "seat of intelligence" at the literal origin every domain cluster is laid
// out around (see DOMAIN_RADIUS in lib/graph/layout.ts). Everything else —
// neurons, connections, signals — comes and goes with search. This doesn't;
// it's meant to read as the thing doing the searching.

function createInnerMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPulse: { value: 0 },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPos;

            // Cheap ambient distortion so the core isn't a perfectly smooth
            // ball — more like a slowly churning body of light.
            uniform float uTime;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec3 displaced = position + normal * (sin(uTime * 0.6 + position.x * 3.0 + position.y * 2.0) * 0.03);
                vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
                vViewPos = mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uPulse;
            varying vec3 vNormal;
            varying vec3 vViewPos;

            void main() {
                vec3 viewDir = normalize(-vViewPos);
                float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 2.0);

                vec3 deep = vec3(0.20, 0.42, 1.0);
                vec3 hot = vec3(0.80, 0.94, 1.0);
                vec3 color = mix(deep, hot, fresnel);

                float glow = 0.85 + fresnel * 1.6 + uPulse * 1.1;
                gl_FragColor = vec4(color * glow, 1.0);
            }
        `,
    });
}

function createCoronaMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPulse: { value: 0 },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPos;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPos = mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uPulse;
            varying vec3 vNormal;
            varying vec3 vViewPos;

            void main() {
                vec3 viewDir = normalize(-vViewPos);
                float rim = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 1.4);
                vec3 color = vec3(0.35, 0.55, 1.0);
                float alpha = rim * (0.35 + uPulse * 0.25);
                gl_FragColor = vec4(color * (1.0 + uPulse), alpha);
            }
        `,
    });
}

function createRingMaterial(speed: number, hue: THREE.Color) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uSpeed: { value: speed },
            uColor: { value: hue },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uSpeed;
            uniform vec3 uColor;
            varying vec2 vUv;

            void main() {
                // vUv.y sweeps radially across the ring band (0 = inner edge,
                // 1 = outer edge) — fade both edges so it reads as a soft
                // band, not a hard-edged disc.
                float edgeFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));

                // vUv.x sweeps the angle around the ring — segments drifting
                // around it give a "data orbiting the core" impression.
                float segments = sin(vUv.x * 40.0 - uTime * uSpeed) * 0.5 + 0.5;
                segments = pow(segments, 3.0);

                float alpha = edgeFade * (0.15 + segments * 0.55);
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
    });
}

export default function IntelligenceCore() {
    const innerRef = useRef<THREE.Mesh>(null);
    const coronaRef = useRef<THREE.Mesh>(null);
    const ring1Ref = useRef<THREE.Mesh>(null);
    const ring2Ref = useRef<THREE.Mesh>(null);
    const ring3Ref = useRef<THREE.Mesh>(null);
    const groupRef = useRef<THREE.Group>(null);

    const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.85, 5), []);
    const coronaGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.35, 3), []);
    const ringGeometry = useMemo(() => new THREE.RingGeometry(1.7, 2.3, 128, 1), []);

    const innerMaterial = useMemo(() => createInnerMaterial(), []);
    const coronaMaterial = useMemo(() => createCoronaMaterial(), []);
    const ringMaterial1 = useMemo(() => createRingMaterial(0.55, new THREE.Color("#7fd0ff")), []);
    const ringMaterial2 = useMemo(() => createRingMaterial(-0.4, new THREE.Color("#c9a8ff")), []);
    const ringMaterial3 = useMemo(() => createRingMaterial(0.28, new THREE.Color("#8fb2ff")), []);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;

        const pulse = 0.5 + Math.sin(t * 1.4) * 0.5;

        innerMaterial.uniforms.uTime.value = t;
        innerMaterial.uniforms.uPulse.value = pulse;
        coronaMaterial.uniforms.uTime.value = t;
        coronaMaterial.uniforms.uPulse.value = pulse;
        ringMaterial1.uniforms.uTime.value = t;
        ringMaterial2.uniforms.uTime.value = t;
        ringMaterial3.uniforms.uTime.value = t;

        if (groupRef.current) {
            const s = 1 + pulse * 0.06;
            groupRef.current.scale.setScalar(s);
        }

        // Each ring sits on a different fixed tilt plus its own spin rate so
        // together they read as a tumbling orbital shell around the core
        // rather than three flat coplanar circles.
        if (ring1Ref.current) {
            ring1Ref.current.rotation.set(Math.PI / 2.3, 0.3, t * 0.12);
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.set(Math.PI / 2.7, 0, t * -0.09);
        }
        if (ring3Ref.current) {
            ring3Ref.current.rotation.set(0.6, t * 0.07, 0.4);
        }
    });

    return (
        <group ref={groupRef} position={[0, 0, 0]} renderOrder={1}>
            <mesh ref={innerRef} geometry={innerGeometry} material={innerMaterial} />
            <mesh ref={coronaRef} geometry={coronaGeometry} material={coronaMaterial} />
            <mesh ref={ring1Ref} geometry={ringGeometry} material={ringMaterial1} />
            <mesh ref={ring2Ref} geometry={ringGeometry} material={ringMaterial2} />
            <mesh ref={ring3Ref} geometry={ringGeometry} material={ringMaterial3} />
        </group>
    );
}
