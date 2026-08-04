import * as THREE from "three";

// WebGL's default gl.POINTS primitive is a flat square -- fine at a
// distance where it's a couple of pixels, but unmistakably a square once
// the camera gets close enough for sizeAttenuation to blow a point up
// (DustLayer, BackgroundStars, ForegroundLayer all use plain
// THREE.PointsMaterial with no sprite texture, which is exactly that
// default square). This generates one shared soft radial-gradient sprite
// -- bright core fading smoothly to fully transparent at the edge, like a
// snowball's glow rather than a hard dot -- and every plain-points layer
// uses it as `map` so their particles read as soft round orbs at any zoom
// level instead of squares.
let cached: THREE.Texture | null = null;

export function getSoftCircleTexture(): THREE.Texture | undefined {
    // Guard for the server-side render pass (no `document` in Node) --
    // harmless to skip there since nothing WebGL actually paints during
    // SSR anyway; the client-side render pass that follows hydration will
    // call this again with a real `document` and pick up the real sprite.
    if (typeof document === "undefined") return undefined;
    if (cached) return cached;

    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
    );
    // Soft, fluffy falloff -- a wide mid-tone band rather than a sharp
    // core-to-edge cliff, which is what reads as a "snowball" glow
    // instead of a crisp dot.
    gradient.addColorStop(0.0, "rgba(255,255,255,1.0)");
    gradient.addColorStop(0.22, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.32)");
    gradient.addColorStop(0.78, "rgba(255,255,255,0.08)");
    gradient.addColorStop(1.0, "rgba(255,255,255,0.0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.premultiplyAlpha = false;
    cached = texture;
    return texture;
}
