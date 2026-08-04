import * as THREE from "three";

export function createNeuronMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        uniforms: {
            // [17] Organized Uniforms
            uTime: { value: 0 },
            
            // Interaction
            uCursor: { value: new THREE.Vector3() },
            uCursorRadius: { value: 3.5 },
            
            // Visual tuning
            uBrightness: { value: 1.0 },
            uGlowStrength: { value: 1.4 },
            uPulseSpeed: { value: 1.2 },
            uNoiseStrength: { value: 0.18 }
        },
        vertexShader: `
            // ==========================================
            // UNIFORMS & ATTRIBUTES
            // ==========================================
            uniform float uTime;
            uniform vec3 uCursor;
            uniform float uPulseSpeed;
            uniform float uNoiseStrength;
            uniform float uCursorRadius;
            
            // [16] Signal propagation attribute (set via BufferGeometry)
            attribute float aSignal; 

            // Selection-driven dim factor: 1 = full ambient brightness,
            // toward 0 = faded into the background because something else
            // is focused. Set/eased in ParticleField.tsx from EngineStore.
            attribute float aDim;

            // Dynamic sizing based on importance (connection count),
            // computed once per neuron in ParticleField.tsx. 1.0 = a leaf
            // node's baseline size; hub neurons with lots of edges get a
            // larger multiplier so they read as more prominent.
            attribute float aSize;

            // ==========================================
            // VARYINGS
            // ==========================================
            varying float vGlow;
            varying float vViewZ;     // For atmospheric depth fade
            varying float vRandom;    // For per-particle variance
            varying float vSignal;
            varying float vDim;

            // ==========================================
            // UTILITIES (Optimized)
            // ==========================================
            float hash(vec3 p) {
                return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
            }

            // [7] Value noise is reasonably optimized here vs full 3D simplex
            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                return mix(
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            void main() {
                vec3 pos = position;
                
                // Base random value for this specific particle
                float rnd = hash(position);
                vRandom = rnd;
                vSignal = aSignal;
                vDim = aDim;
                
                // [12][13] Calculate primary pulse and secondary random flicker
                float timeOffset = uTime * uPulseSpeed + rnd * 6.28;
                float slowPulse = sin(timeOffset + position.x * 0.35 + position.y * 0.45) * 0.5 + 0.5;
                float fastFlicker = sin(uTime * 8.0 + rnd * 20.0) * 0.5 + 0.5;
                float pulse = mix(slowPulse, fastFlicker, 0.15); 
                
                // Apply noise displacement
                float n = noise(position * 0.45 + uTime * 0.15);
                
                // [1] Safe normalize position (prevents 0-length vector crash)
                float posLen = length(position);
                vec3 posDir = posLen > 0.0 ? position / posLen : vec3(0.0);
                pos += posDir * n * uNoiseStrength;

                // [14] Cursor interaction with smooth, exponential falloff
                vec3 diff = uCursor - pos;
                float dist = length(diff);
                float cursorInfluence = 1.0 - smoothstep(0.0, uCursorRadius, dist);
                cursorInfluence = pow(cursorInfluence, 2.0); // Exponential easing

                // [2] Safe normalize cursor direction
                vec3 cursorDir = dist > 0.0 ? diff / dist : vec3(0.0);
                pos += cursorDir * cursorInfluence * 0.22;

                // [4] Clamp energy strictly to [0,1] immediately
                float energy = clamp(pulse * 0.65 + cursorInfluence, 0.0, 1.0);
                vGlow = energy;

                // Project to screen
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                // [9] Store camera distance (view Z) for fragment shader
                vViewZ = -mvPosition.z;
                
                // [3][15] Distance-based point scale, strictly clamped to prevent giant particles.
                // Lowered the max clamp and the scale constant so particles that drift close to
                // the camera (galaxy radius > camera distance, so this does happen) settle into a
                // soft, bloom-friendly size instead of maxing out into a blown-out disc.
                //
                // Floor raised from 1.0 -> 3.2px: at the camera's max zoom-out distance (320,
                // see CameraRig's MAX_DIST) the old 1px floor combined with the 140 scale
                // constant meant neurons shrank to sub-2px specks that were functionally
                // invisible next to the background dust/star layers -- the graph itself
                // "disappeared" exactly when you zoomed out to see the whole thing. Neurons are
                // the actual content; they should read as individually visible dots at any zoom
                // level the camera allows, not just up close.
                float baseSize = (3.4 + energy * 3.2) * mix(0.6, 1.0, aDim) * aSize;
                gl_PointSize = clamp(baseSize * (170.0 / vViewZ), 3.2, 52.0);
            }
        `,
        fragmentShader: `
            // ==========================================
            // VARYINGS & UNIFORMS
            // ==========================================
            varying float vGlow;
            varying float vViewZ;
            varying float vRandom;
            varying float vSignal;
            varying float vDim;
            
            uniform float uBrightness;
            uniform float uGlowStrength;

            // [8] Avoid repeated vec3 constructions by declaring consts.
            // Nudged toward graphite/silver with a touch of cyan on the active state,
            // per the brief's palette (deep black, graphite, blue-white, silver, subtle cyan —
            // no saturated blue, no neon).
            // Sleep color brightened slightly (was 0.34/0.38/0.44) so idle neurons still
            // read as distinct graphite-silver dots against the dark background/other
            // decorative layers, rather than only popping once something lights them up.
            const vec3 SLEEP_COLOR = vec3(0.42, 0.47, 0.53);
            const vec3 ACTIVE_COLOR = vec3(0.72, 0.92, 0.98);
            const vec3 AWAKE_COLOR = vec3(1.0, 1.0, 1.0);

            void main() {
                // Center UV coordinates for point rendering
                vec2 uv = gl_PointCoord - 0.5;
                float d = length(uv);
                
                // Discard pixels outside the circle
                if(d > 0.5) discard;

                // Core and glow radiuses
                float core = smoothstep(0.14, 0.0, d);
                float innerGlow = smoothstep(0.34, 0.0, d);
                float outerGlow = smoothstep(0.50, 0.10, d);
                
                float halo = pow(outerGlow, 2.4);
                float glow = halo * uGlowStrength;
                
                // Combine base glow with propagated signal logic [16]
                float energy = clamp(vGlow + vSignal, 0.0, 1.0);

                // [10] Per-particle color variation
                // Shifts colors slightly based on the random hash generated in vertex
                vec3 particleSleep = mix(SLEEP_COLOR, vec3(0.30, 0.36, 0.42), vRandom);
                vec3 particleActive = mix(ACTIVE_COLOR, vec3(0.62, 0.86, 0.92), fract(vRandom * 13.37));

                // Color mapping
                vec3 color = mix(particleSleep, particleActive, energy);
                color = mix(color, AWAKE_COLOR, core);
                
                // [11] Fake 3D Sphere Normal & Fresnel/Rim Glow
                // Calculates a z-depth for a sphere based on the 2D coordinate distance
                float fakeZ = sqrt(max(0.0, 1.0 - (2.0 * d) * (2.0 * d)));
                float rim = pow(1.0 - fakeZ, 3.0) * energy;
                color += particleActive * rim * 1.5; // Add bright rim lighting

                // Base brightness adjustments
                color *= 0.75 + energy * 0.45;
                color *= uBrightness;
                
                // [5] Boost Highlights for HDR Bloom Output
                // This gives post-processing bloom values > 1.0 to grab onto — but kept
                // modest since it stacks with EffectComposer's Bloom pass; too strong here
                // and the whole field clips to solid white once particles overlap on screen.
                color += color * energy * 0.5;

                // Glow additives
                float edge = smoothstep(0.50, 0.32, d);
                glow += edge * 0.18 * energy;
                glow += innerGlow * 0.55;

                // Calculate base alpha
                float alpha = (glow + core * 0.9) * (0.45 + energy * 0.55);
                
                // [9] Atmospheric Depth fade
                // Fades out gracefully in the distance, and prevents popping near near-clip plane.
                // Widened the near fade-in range so particles drifting close to the camera ease in
                // gradually instead of visibly "popping" once they cross a hard threshold.
                //
                // Range pushed out from (150, 350) -> (900, 1600): the camera's own max zoom-out
                // distance is 320 (CameraRig's MAX_DIST), which sat almost exactly inside the old
                // fade window -- so pulling all the way out was silently fading every neuron down
                // to near-zero alpha at the same time the point-size shrank, and the whole graph
                // read as "gone." This fade should only kick in well past anything the camera can
                // actually reach, so neurons stay visible and distinct from the decorative
                // background layers across the entire usable zoom range.
                float depthFadeOut = 1.0 - smoothstep(900.0, 1600.0, vViewZ);
                float cameraFadeIn = smoothstep(1.0, 26.0, vViewZ);
                alpha *= depthFadeOut * cameraFadeIn;
                
                // Fold in the selection-driven dim factor last so it fades
                // uniformly regardless of how bright the particle otherwise is.
                alpha *= mix(0.12, 1.0, vDim);
                color *= mix(0.5, 1.0, vDim);

                alpha = clamp(alpha, 0.0, 1.0);

                gl_FragColor = vec4(color, alpha);

                // [6][18] Tone mapping and color space chunk inclusion for Three.js
                // Allows Three.js to automatically convert linear colors to sRGB if enabled in renderer
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}