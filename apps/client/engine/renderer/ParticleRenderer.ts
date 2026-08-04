import * as THREE from "three";

import ParticleManager from "../particles/ParticleManager";

import {
    Particle,
    ParticleKind
} from "../particles/ParticleTypes";

export default class ParticleRenderer {

    private geometry: THREE.BufferGeometry;

    private material: THREE.ShaderMaterial;

    private points: THREE.Points;

    private scene: THREE.Scene;

    private positions!: Float32Array;

    private sizes!: Float32Array;

    private opacity!: Float32Array;

    private colors!: Float32Array;

    private count = 0;

    constructor(
        scene: THREE.Scene
    ){

        this.scene = scene;

        ParticleManager.initialize();

        const particles =
            ParticleManager.getAll();

        this.count =
            particles.length;

        this.positions =
            new Float32Array(
                this.count*3
            );

        this.colors =
            new Float32Array(
                this.count*3
            );

        this.sizes =
            new Float32Array(
                this.count
            );

        this.opacity =
            new Float32Array(
                this.count
            );

        this.geometry =
            new THREE.BufferGeometry();

        this.geometry.setAttribute(

            "position",

            new THREE.BufferAttribute(

                this.positions,

                3

            )

        );

        this.geometry.setAttribute(

            "aSize",

            new THREE.BufferAttribute(

                this.sizes,

                1

            )

        );

        this.geometry.setAttribute(

            "aOpacity",

            new THREE.BufferAttribute(

                this.opacity,

                1

            )

        );

        this.geometry.setAttribute(

            "aColor",

            new THREE.BufferAttribute(

                this.colors,

                3

            )

        );

        this.material =
            new THREE.ShaderMaterial({

                transparent:true,

                depthWrite:false,

                blending:
                    THREE.AdditiveBlending,

                uniforms:{

                    uTime:{
                        value:0
                    }

                },

                vertexShader:`

attribute float aSize;

attribute float aOpacity;

attribute vec3 aColor;

varying float vOpacity;

varying vec3 vColor;

void main(){

    vOpacity = aOpacity;

    vColor = aColor;

    vec4 mvPosition =
        modelViewMatrix*
        vec4(position,1.0);

    gl_PointSize =
        aSize*
        (250.0/-mvPosition.z);

    gl_Position=
        projectionMatrix*
        mvPosition;

}

`,

fragmentShader:`

varying float vOpacity;

varying vec3 vColor;

void main(){

    vec2 uv=
        gl_PointCoord-
        0.5;

    float d=
        length(uv);

    if(d>0.5)
        discard;

    float glow=
        smoothstep(
            0.5,
            0.0,
            d
        );

    glow*=glow;

    gl_FragColor=
        vec4(
            vColor,
            glow*vOpacity
        );

}

`

            });

        this.points =
            new THREE.Points(

                this.geometry,

                this.material

            );

        this.points.frustumCulled =
            false;

        scene.add(

            this.points

        );

        this.populateBuffers();

    }

    private populateBuffers(){

        const particles =
            ParticleManager.getAll();

        for(

            let i=0;

            i<particles.length;

            i++

        ){

            const p =
                particles[i];

            this.positions[
                i*3
            ] = p.position.x;

            this.positions[
                i*3+1
            ] = p.position.y;

            this.positions[
                i*3+2
            ] = p.position.z;

            this.sizes[i] =
                this.getSize(p);

            this.opacity[i] =
                p.opacity;

            const color =
                this.getColor(p);

            this.colors[
                i*3
            ] = color.r;

            this.colors[
                i*3+1
            ] = color.g;

            this.colors[
                i*3+2
            ] = color.b;

        }

    }    update(
        time:number,
        dt:number
    ){

        this.material.uniforms.uTime.value =
            time;

        ParticleManager.update(dt);

        const particles =
            ParticleManager.getAll();

        for(

            let i=0;

            i<particles.length;

            i++

        ){

            const p =
                particles[i];

            this.positions[
                i*3
            ] = p.position.x;

            this.positions[
                i*3+1
            ] = p.position.y;

            this.positions[
                i*3+2
            ] = p.position.z;

            this.sizes[i] =
                this.getSize(p);

            this.opacity[i] =
                p.opacity;

            const color =
                this.getColor(p);

            this.colors[
                i*3
            ] = color.r;

            this.colors[
                i*3+1
            ] = color.g;

            this.colors[
                i*3+2
            ] = color.b;

        }

        (
            this.geometry.attributes.position as THREE.BufferAttribute
        ).needsUpdate = true;

        (
            this.geometry.attributes.aSize as THREE.BufferAttribute
        ).needsUpdate = true;

        (
            this.geometry.attributes.aOpacity as THREE.BufferAttribute
        ).needsUpdate = true;

        (
            this.geometry.attributes.aColor as THREE.BufferAttribute
        ).needsUpdate = true;

    }

    private getSize(

        particle:Particle

    ){

        switch(

            particle.kind

        ){

            case ParticleKind.BackgroundStar:

                return 0.04;

            case ParticleKind.Dust:

                return 0.06;

            case ParticleKind.Foreground:

                return 0.22;

            default:

                return (
                    0.12 +
                    particle.glow *
                    0.08
                );

        }

    }

    private getColor(

        particle:Particle

    ){

        switch(

            particle.kind

        ){

            case ParticleKind.BackgroundStar:

                return new THREE.Color(

                    "#7E93AF"

                );

            case ParticleKind.Dust:

                return new THREE.Color(

                    "#505C6D"

                );

            case ParticleKind.Foreground:

                return new THREE.Color(

                    "#EAF5FF"

                );

            default:

                return new THREE.Color()

                    .lerpColors(

                        new THREE.Color(
                            "#5D789E"
                        ),

                        new THREE.Color(
                            "#FFFFFF"
                        ),

                        particle.glow

                    );

        }

    }

    getObject(){

        return this.points;

    }

    dispose(){

        this.geometry.dispose();

        this.material.dispose();

        this.scene.remove(

            this.points

        );

    }

}