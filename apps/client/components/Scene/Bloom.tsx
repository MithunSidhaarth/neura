"use client";

import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

export default function BloomEffect() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.35}
        luminanceThreshold={0.35}
        luminanceSmoothing={0.75}
        mipmapBlur
        radius={0.7}
      />
      <Vignette
        offset={0.35}
        darkness={0.65}
        eskil={false}
      />
    </EffectComposer>
  );
}
