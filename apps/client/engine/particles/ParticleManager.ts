import * as THREE from "three";

import ParticleData from "./ParticleData";
import {
    Particle,
    ParticleKind,
    ParticleState
} from "./ParticleTypes";

export default class ParticleManager {

    private static initialized = false;

    // ------------------------------------------------

    static initialize(){

        if(this.initialized)
            return;

        ParticleData.initialize();

        this.initialized = true;

    }

    // ------------------------------------------------

    static update(dt:number){

        this.initialize();

        ParticleData.update(dt);

        this.updateEnergy(dt);

        this.updateStates(dt);

        this.applyDamping(dt);

    }

    // ------------------------------------------------

    private static updateEnergy(dt:number){

        const particles =
            ParticleData.getAll();

        for(const particle of particles){

            particle.energy +=
                (Math.random()-0.5) *
                dt *
                0.25;

            particle.energy =
                THREE.MathUtils.clamp(
                    particle.energy,
                    0.05,
                    1
                );

            particle.pulse +=
                dt *
                (
                    0.5 +
                    particle.energy
                );

            particle.glow +=
                (
                    particle.energy -
                    particle.glow
                ) *
                dt *
                3;

        }

    }

    // ------------------------------------------------

    private static updateStates(dt:number){

        const neurons =
            ParticleData.getNeurons();

        for(const neuron of neurons){

            if(
                neuron.energy > 0.8
            ){

                neuron.state =
                    ParticleState.Excited;

            }

            else if(
                neuron.energy > 0.45
            ){

                neuron.state =
                    ParticleState.Active;

            }

            else{

                neuron.state =
                    ParticleState.Sleeping;

            }

        }

    }

    // ------------------------------------------------

    private static applyDamping(dt:number){

        const particles =
            ParticleData.getAll();

        for(const p of particles){

            p.velocity.multiplyScalar(
                0.985
            );

            p.signalStrength *=
                0.992;

        }

    }

    // ------------------------------------------------

    static getAll():Particle[]{

        return ParticleData.getAll();

    }

    static getNeurons(){

        return ParticleData.getNeurons();

    }

    static getStars(){

        return ParticleData.getBackgroundStars();

    }

    static getDust(){

        return ParticleData.getDust();

    }

    static getForeground(){

        return ParticleData.getForeground();

    }

    static getByKind(
        kind:ParticleKind
    ){

        return ParticleData.getByKind(kind);

    }

}