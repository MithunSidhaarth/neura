"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getSoftCircleTexture } from "./sprites";

const FOREGROUND_COUNT = 2500;
const FOREGROUND_RADIUS = 28;

// This is the layer closest to the camera, which is exactly why its old
// plain-square points were the most visible offender in "particles are
// square when zoomed in" -- sizeAttenuation blows these up the most since
// they're the nearest particles to the lens.
export default function ForegroundLayer() {
  const pointsRef = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const data = new Float32Array(FOREGROUND_COUNT * 3);

    for (let i = 0; i < FOREGROUND_COUNT; i++) {
      const r = Math.pow(Math.random(), 1.8) * FOREGROUND_RADIUS;
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
        color: new THREE.Color("#D9ECFF"),
        map: getSoftCircleTexture(),
        alphaMap: getSoftCircleTexture(),
        size: 0.16,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const t = clock.getElapsedTime();

    pointsRef.current.rotation.y = t * 0.01;
    pointsRef.current.rotation.x = Math.sin(t * 0.08) * 0.02;
    pointsRef.current.rotation.z = Math.cos(t * 0.06) * 0.015;
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
      </bufferGeometry>
    </points>
  );
}
