import {
    Particle,
    ParticleKind,
    ParticleSystemSettings,
} from "./ParticleTypes";

import ParticleGenerator from "./ParticleGenerator";

export default class ParticleData {

    private static particles: Particle[] = [];

    private static initialized = false;

    private static settings: ParticleSystemSettings = {

        backgroundStars: 80000,

        dustParticles: 40000,

        neurons: 15000,

        foregroundParticles: 2500,

        worldRadius: 30,

        cursorRadius: 4,

        maxConnections: 8,

    };

    // --------------------------------------------------

    static initialize(){

        if(this.initialized)
            return;

        this.particles =
            ParticleGenerator.generate(
                this.settings
            );

        this.initialized = true;

    }

    // --------------------------------------------------

    static getAll():Particle[]{

        this.initialize();

        return this.particles;

    }

    // --------------------------------------------------

    static getById(
        id:number
    ){

        return this.particles[id];

    }

    // --------------------------------------------------

    static getByKind(
        kind:ParticleKind
    ):Particle[]{

        this.initialize();

        return this.particles.filter(

            p=>p.kind===kind

        );

    }

    // --------------------------------------------------

    static getNeurons(){

        return this.getByKind(
            ParticleKind.Neuron
        );

    }

    // --------------------------------------------------

    static getBackgroundStars(){

        return this.getByKind(
            ParticleKind.BackgroundStar
        );

    }

    // --------------------------------------------------

    static getDust(){

        return this.getByKind(
            ParticleKind.Dust
        );

    }

    // --------------------------------------------------

    static getForeground(){

        return this.getByKind(
            ParticleKind.Foreground
        );

    }

    // --------------------------------------------------

    static forEach(

        callback:(

            particle:Particle,

            index:number

        )=>void

    ){

        this.initialize();

        this.particles.forEach(callback);

    }

    // --------------------------------------------------

    static update(

        dt:number

    ){

        this.initialize();

        for(const particle of this.particles){

            if("update" in particle){

                (particle as any).update(dt);

            }

        }

    }

    // --------------------------------------------------

    static reset(){

        this.initialized = false;

        this.particles = [];

    }

}