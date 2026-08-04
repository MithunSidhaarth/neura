import * as THREE from "three";

import {
    Particle,
    ParticleKind,
    ParticleState,
    ParticleConnection,
} from "./ParticleTypes";

export default class NeuralParticle implements Particle {

    id: number;

    kind: ParticleKind;

    state: ParticleState;

    position: THREE.Vector3;

    velocity: THREE.Vector3;

    acceleration: THREE.Vector3;

    initialPosition: THREE.Vector3;

    energy: number;

    attention: number;

    pulse: number;

    glow: number;

    opacity: number;

    radius: number;

    mass: number;

    temperature: number;

    age: number;

    life: number;

    noiseOffset: number;

    cluster: number;

    signalStrength: number;

    connections: ParticleConnection[];

    constructor(

        id: number,

        kind: ParticleKind,

        position: THREE.Vector3,

        cluster = -1

    ) {

        this.id = id;

        this.kind = kind;

        this.state = ParticleState.Sleeping;

        this.position = position.clone();

        this.initialPosition = position.clone();

        this.velocity = new THREE.Vector3();

        this.acceleration = new THREE.Vector3();

        this.energy = Math.random();

        this.attention = 0;

        this.pulse = Math.random();

        this.glow = 0;

        this.opacity = 1;

        this.radius = 1;

        this.mass = 1;

        this.temperature = 0;

        this.age = 0;

        this.life = Infinity;

        this.noiseOffset = Math.random() * 1000;

        this.cluster = cluster;

        this.signalStrength = 0;

        this.connections = [];

        switch(kind){

            case ParticleKind.BackgroundStar:

                this.radius = 0.05;
                this.opacity = 0.12;
                break;

            case ParticleKind.Dust:

                this.radius = 0.08;
                this.opacity = 0.08;
                break;

            case ParticleKind.Neuron:

                this.radius = 0.18;
                this.opacity = 0.55;
                this.glow = 0.25;
                break;

            case ParticleKind.Foreground:

                this.radius = 0.28;
                this.opacity = 0.75;
                this.glow = 0.4;
                break;

        }

    }

    wake(){

        this.state = ParticleState.Active;

        this.energy = 1;

        this.glow = 1;

    }

    sleep(){

        this.state = ParticleState.Sleeping;

        this.energy *= 0.95;

    }

    excite(amount:number){

        this.signalStrength = Math.min(
            1,
            this.signalStrength + amount
        );

        this.energy = Math.min(
            1,
            this.energy + amount
        );

    }

    update(dt:number){

        this.age += dt;

        this.position.addScaledVector(
            this.velocity,
            dt
        );

        this.velocity.addScaledVector(
            this.acceleration,
            dt
        );

        this.acceleration.multiplyScalar(0);

        this.glow +=
            (this.energy - this.glow) *
            dt *
            2.5;

        this.signalStrength *= 0.985;

    }

}