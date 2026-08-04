import * as THREE from "three";

import NeuralParticle from "./Particle";

import {
    ParticleKind,
    Particle,
    ParticleSystemSettings,
} from "./ParticleTypes";

export default class ParticleGenerator {

    static generate(
        settings: ParticleSystemSettings
    ): Particle[] {

        const particles: Particle[] = [];

        let id = 0;

        particles.push(
            ...this.generateBackgroundStars(
                id,
                settings.backgroundStars,
                settings.worldRadius * 8
            )
        );

        id += settings.backgroundStars;

        particles.push(
            ...this.generateDust(
                id,
                settings.dustParticles,
                settings.worldRadius * 4
            )
        );

        id += settings.dustParticles;

        particles.push(
            ...this.generateNeurons(
                id,
                settings.neurons,
                settings.worldRadius
            )
        );

        id += settings.neurons;

        particles.push(
            ...this.generateForeground(
                id,
                settings.foregroundParticles,
                settings.worldRadius * 0.75
            )
        );

        return particles;

    }

    // --------------------------------------------------

    private static generateBackgroundStars(
        start:number,
        count:number,
        radius:number
    ): Particle[]{

        const stars:Particle[]=[];

        for(let i=0;i<count;i++){

            stars.push(

                new NeuralParticle(

                    start+i,

                    ParticleKind.BackgroundStar,

                    this.randomSphere(radius)

                )

            );

        }

        return stars;

    }

    // --------------------------------------------------

    private static generateDust(
        start:number,
        count:number,
        radius:number
    ):Particle[]{

        const dust:Particle[]=[];

        for(let i=0;i<count;i++){

            dust.push(

                new NeuralParticle(

                    start+i,

                    ParticleKind.Dust,

                    this.randomSphere(radius)

                )

            );

        }

        return dust;

    }

    // --------------------------------------------------

    private static generateForeground(
        start:number,
        count:number,
        radius:number
    ):Particle[]{

        const fg:Particle[]=[];

        for(let i=0;i<count;i++){

            fg.push(

                new NeuralParticle(

                    start+i,

                    ParticleKind.Foreground,

                    this.randomSphere(radius)

                )

            );

        }

        return fg;

    }

    // --------------------------------------------------

    private static generateNeurons(
        start:number,
        count:number,
        radius:number
    ):Particle[]{

        const neurons:Particle[]=[];

        const clusterCount=18;

        const clusters:THREE.Vector3[]=[];

        for(let i=0;i<clusterCount;i++){

            clusters.push(

                this.randomSphere(
                    radius*0.8
                )

            );

        }

        for(let i=0;i<count;i++){

            const clusterIndex=
                Math.floor(
                    Math.random()*clusterCount
                );

            const center=
                clusters[clusterIndex];

            const local=
                this.randomSphere(2.5);

            neurons.push(

                new NeuralParticle(

                    start+i,

                    ParticleKind.Neuron,

                    center.clone().add(local),

                    clusterIndex

                )

            );

        }

        return neurons;

    }

    // --------------------------------------------------

    private static randomSphere(
        radius:number
    ):THREE.Vector3{

        const r =
            Math.cbrt(
                Math.random()
            ) * radius;

        const theta =
            Math.random() *
            Math.PI * 2;

        const phi =
            Math.acos(
                2*Math.random()-1
            );

        return new THREE.Vector3(

            r*Math.sin(phi)*Math.cos(theta),

            r*Math.sin(phi)*Math.sin(theta),

            r*Math.cos(phi)

        );

    }

}