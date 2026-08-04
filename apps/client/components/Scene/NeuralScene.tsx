"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Universe from "./Universe";
import CameraRig from "./CameraRig";
import CursorField from "./CursorField";
import LayeredUniverse from "./LayeredUniverse";
import BloomEffect from "./Bloom";
import { engineStore } from "@/engine/store/EngineStore";
import { cameraDragState } from "@/engine/camera/dragState";

export default function NeuralScene() {
  return (
    <Canvas
      dpr={[1,2]}
      shadows={false}
      onPointerMissed={() => {
        if (cameraDragState.consumeWasDrag()) return;
        engineStore.select(null);
      }}
      gl={{
        antialias:true,
        alpha:false,
        powerPreference:"high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.95,
      }}
      camera={{
        position:[0,0,18],
        fov:45,
        near:0.1,
        far:1000,
      }}
    >
      <Universe />
      <CameraRig />
      <CursorField />
      <LayeredUniverse />
      <BloomEffect />
    </Canvas>
  );
}