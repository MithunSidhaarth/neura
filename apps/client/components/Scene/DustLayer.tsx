"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getSoftCircleTexture } from "./sprites";

const DUST_COUNT = 40000;
const DUST_RADIUS = 90;

export default function DustLayer() {
  const pointsRef = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const data = new Float32Array(DUST_COUNT * 3);

    for (let i = 0; i < DUST_COUNT; i++) {
      const r = Math.pow(Math.random(), 0.8) * DUST_RADIUS;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      data[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      data[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      data[i * 3 + 2] = r * Math.cos(phi);
    }

    return data;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color("#5F6775"),
        // A soft round sprite instead of the default square GL point, plus
        // a slightly larger base size -- the sprite's own falloff keeps it
        // from reading as a bigger hard dot, just a fluffier snowball-like
        // glow, which is the point (no pun intended).
        map: getSoftCircleTexture(),
        alphaMap: getSoftCircleTexture(),
        size: 0.11,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const t = clock.getElapsedTime();

    pointsRef.current.rotation.y = -t * 0.003;
    pointsRef.current.rotation.x = Math.sin(t * 0.05) * 0.015;
    pointsRef.current.rotation.z = Math.cos(t * 0.03) * 0.01;
  });

  return (
    <points ref={pointsRef} material={material} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
    </points>
  );
}
